import { WebSocket } from "ws";
import { pool } from "../db.js";
import { symbols, lastSaved, lastSentCandle, THROTTLE_MS } from "../state/store.js";
import { matchOrders } from "../services/orderService.js";

export function connectBinance(wss) {
  const streams = symbols
    .map(s => s.split(":")[1].toLowerCase() + "@trade")
    .join("/");

  const binanceWS = new WebSocket(
    `wss://stream.binance.com:9443/stream?streams=${streams}`
  );

  binanceWS.on("open", () => {
    console.log("📡 Binance WS connected");
  });

  binanceWS.on("message", async (msg) => {
    try {
      const parsed = JSON.parse(msg);
      const trade = parsed.data;

      const symbol = "BINANCE:" + trade.s;
      const price = parseFloat(trade.p);
      const now = Date.now();

      if (lastSaved.get(symbol) && now - lastSaved.get(symbol) < THROTTLE_MS) {
        return;
      }

      lastSaved.set(symbol, now);

      await pool.query(
        "INSERT INTO ticks (time, symbol, price) VALUES ($1, $2, $3)",
        [new Date(), symbol, price]
      );
      await matchOrders(symbol, price);
      
      const result = await pool.query(`
        SELECT
          FLOOR(EXTRACT(EPOCH FROM bucket)) AS time,
          FIRST(price, time) AS open,
          MAX(price) AS high,
          MIN(price) AS low,
          LAST(price, time) AS close
        FROM (
          SELECT time_bucket('1 minute', time) AS bucket, price, time
          FROM ticks
          WHERE symbol = $1
        ) sub
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT 1;
      `, [symbol]);

      if (!result.rows.length) return;

      const latest = result.rows[0];
      const prev = lastSentCandle.get(symbol);

      if (
        prev &&
        latest.time === prev.time &&
        latest.open == prev.open &&
        latest.high == prev.high &&
        latest.low == prev.low &&
        latest.close == prev.close
      ) return;

      lastSentCandle.set(symbol, { ...latest });

      const message = JSON.stringify({
        type: "candle",
        data: {
          symbol,
          time: latest.time,
          open: Number(latest.open),
          high: Number(latest.high),
          low: Number(latest.low),
          close: Number(latest.close),
        }
      });

      wss.clients.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      });

    } catch (err) {
      console.error("WS error:", err.message);
    }
  });

  binanceWS.on("close", () => {
    console.log("⚠️ Reconnecting Binance...");
    setTimeout(() => connectBinance(wss), 2000);
  });
}