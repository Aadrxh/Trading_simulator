import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import { backfillStore, isBackfillDone } from "../state/store.js";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET;

export function initClientWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws, req) => {
    try {

      //wait for backfill
      while (!isBackfillDone) {
        await new Promise(res => setTimeout(res, 200));
      }

      //history send
      const allData = [];

      for (const candles of backfillStore.values()) {
        if (!candles || candles.length === 0) continue;

        allData.push(...candles);
      }

      ws.send(JSON.stringify({
        type: "history",
        data: allData
      }));

      // auth
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        console.log("WS connected without token");
        return;
      }
      let decoded;

      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        console.log("Invalid WS token");
        return;
      }
      const userId = decoded.user_id;

      //loading portfolio immediately
      const result = await pool.query(`
        SELECT
          b.usd,
          p.symbol,
          p.quantity,
          p.avg_price
        FROM balances b
        LEFT JOIN positions p
          ON b.user_id = p.user_id
        WHERE b.user_id = $1
      `, [userId]);

      const balance = Number(result.rows[0]?.usd || 0);

      const positions = result.rows
        .filter(r => r.symbol)
        .map(r => ({
          symbol: r.symbol,
          quantity: Number(r.quantity),
          avg_price: Number(r.avg_price)
        }));

      //send initial portfolio
      ws.send(JSON.stringify({
        type: "portfolio",
        user_id: userId,
        data: {
          balance,
          positions
        }
      }));
      
      const tradesResult = await pool.query(`
        SELECT *
        FROM trades
        WHERE buyer_id = $1
          OR seller_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [userId]);

      ws.send(JSON.stringify({
        type: "tradeHistory",
        data: tradesResult.rows
      }));

    } catch (err) {
      console.error("Initial WS error:", err);
    }
  });

  return wss;
}