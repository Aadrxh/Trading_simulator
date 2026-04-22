import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";

import { pool } from "./db.js";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: "http://localhost:5173"
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map<ip, Set<ws>>
const ipConnections = new Map();
const MAX_PER_IP = 5;

function getIP(req) {
  return req.socket.remoteAddress;
}

const symbols = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:DOGEUSDT"
];

const lastSentCandle = new Map(); // map for several symbols/stocks

const lastSaved = new Map();
const THROTTLE_MS = 1000; // controlling the ticks

//cleanup immediately on startup
async function cleanupOldData() {
  try {
    await pool.query(`
      DELETE FROM ticks
      WHERE time < NOW() - INTERVAL '6 days'
    `);
    console.log("🧹 Initial cleanup done");
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
}

// deleting all the data before 7 latest days to save space
// doing every hour
setInterval(async () => {
  try {
    await pool.query(`
      DELETE FROM ticks
      WHERE time < NOW() - INTERVAL '6 days'
    `);
    console.log("🧹 Old data cleaned");
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
}, 60 * 60 * 1000);


//BACKFILL (7 DAYS)
async function backfill() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sixDaysAgo = now - 6 * 24 * 60 * 60;

    for (const symbol of symbols) {
      console.log("Backfilling:", symbol);

      let current = sixDaysAgo;

      while (current < now) {
        const next = current + 24 * 60 * 60; // divided into chunks to avoid truncation

        const res = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=1&from=${current}&to=${next}&token=${process.env.API_KEY}`
        );

        const data = await res.json();

        if (data.s !== "ok" || !data.t || data.t.length === 0) {
          console.warn("No data for", symbol, current);
          current = next;
          continue;
        }

        const values = [];
        const placeholders = [];

        for (let i = 0; i < data.t.length; i++) {
          const time = new Date(data.t[i] * 1000);
          const price = data.c[i];

          values.push(time, symbol, price);

          const index = i * 3;
          placeholders.push(`($${index + 1}, $${index + 2}, $${index + 3})`);
        }

        if (values.length > 0) {
          await pool.query(
            `INSERT INTO ticks (time, symbol, price)
             VALUES ${placeholders.join(",")}
             ON CONFLICT DO NOTHING`,
            values
          );
        }

        current = next;
      }
    }

    console.log("Backfill complete");
  } catch (err) {
    console.error("Backfill error:", err);
  }
}

wss.on("connection", async (ws, req) => {
  const origin = req.headers.origin;

  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    ws.close(1008, "Invalid origin");
    return;
  }

  const ip = getIP(req);

  if (!ipConnections.has(ip)) {
    ipConnections.set(ip, new Set());
  }

  const connections = ipConnections.get(ip);

  if (connections.size >= MAX_PER_IP) {
    ws.close(1008, "Too many connections");
    return;
  }

  connections.add(ws);

  
  try {
    const result = await pool.query(`
      SELECT * FROM (
        SELECT
          time_bucket('1 minute', time) AS bucket,
          symbol,
          FIRST(price, time) AS open,
          MAX(price) AS high,
          MIN(price) AS low,
          LAST(price, time) AS close,
          ROW_NUMBER() OVER (
            PARTITION BY symbol
            ORDER BY time_bucket('1 minute', time) DESC
          ) as rn
        FROM ticks
        GROUP BY bucket, symbol
      ) sub
      WHERE rn <= 800 -- just a random to get maximum but also not too much
      ORDER BY symbol, bucket ASC 
    `);

    ws.send(JSON.stringify({
      type: "history",
      data: result.rows
    }));
  } catch (err) {
    console.error("Initial fetch error:", err);
  }

  // heartbeat 
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("close", () => {
    connections.delete(ws);

    if (connections.size === 0) {
      ipConnections.delete(ip);
    }
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// single broadcast to all users
let finnhubWS;

function connectFinnhub() {
  finnhubWS = new WebSocket(`wss://ws.finnhub.io?token=${process.env.API_KEY}`);

  finnhubWS.on("open", () => {
    console.log("📡 Finnhub connected");

    symbols.forEach(symbol => {
      finnhubWS.send(JSON.stringify({
        type: "subscribe",
        symbol
      }));
    });
  });

  finnhubWS.on("message", async (msg) => {
    console.log("RAW:", msg.toString()); 
    try {
      const data = JSON.parse(msg);
      if (!data.data) return;

      for (const tick of data.data) {
        const symbol = tick.s;
        const price = tick.p;
        const now = Date.now();

        // 🔥 THROTTLING
        if (lastSaved.get(symbol) && now - lastSaved.get(symbol) < THROTTLE_MS) {
          continue;
        }

        lastSaved.set(symbol, now);

        await pool.query(
          "INSERT INTO ticks (time, symbol, price) VALUES ($1, $2, $3)",
          [new Date(), symbol, price]
        );

        const result = await pool.query(`
          SELECT
            time_bucket('1 minute', time) AS bucket,
            FIRST(price, time) AS open,
            MAX(price) AS high,
            MIN(price) AS low,
            LAST(price, time) AS close
          FROM ticks
          WHERE symbol = $1
          GROUP BY bucket
          ORDER BY bucket DESC
          LIMIT 1;
        `, [symbol]);

        if (!result.rows.length) continue;

        const latest = result.rows[0];
        const prev = lastSentCandle.get(symbol);

        if (
          prev &&
          latest.bucket === prev.time &&
          latest.open == prev.open &&
          latest.high == prev.high &&
          latest.low == prev.low &&
          latest.close == prev.close
        ) continue;

        lastSentCandle.set(symbol, { ...latest });

        const message = JSON.stringify({
          type: "candle",
          data: {
            symbol,
            time: latest.bucket,
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
          }
        });

        wss.clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });
      }

    } catch (err) {
      console.error("WS error:", err.message);
    }
  });

  // 🔥 reconnect
  finnhubWS.on("close", () => {
    console.log("⚠️ Finnhub disconnected. Reconnecting...");
    setTimeout(connectFinnhub, 2000);
  });
  finnhubWS.on("error", (err) => {
    console.error("Finnhub WS error:", err.message);
  });
}

const PORT = process.env.PORT || 3000;

async function startServer() {
  await cleanupOldData();
  await backfill();

  connectFinnhub();

  server.listen(PORT ,() => {
    console.log("🚀 Server running on port 3000");
  });
}

startServer();