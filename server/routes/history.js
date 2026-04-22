import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { symbol, before } = req.query;

    if (!symbol || !before) {
      return res.status(400).json({ error: "Missing params" });
    }

    console.log("HISTORY REQ:", symbol, before);

    const result = await pool.query(`
        SELECT
            FLOOR(EXTRACT(EPOCH FROM bucket)) AS time,
            symbol,
            FIRST(price, time) AS open,
            MAX(price) AS high,
            MIN(price) AS low,
            LAST(price, time) AS close
        FROM (
            SELECT
            time_bucket('1 minute', time) AS bucket,
            symbol,
            price,
            time
            FROM ticks
            WHERE symbol = $1
            AND time < to_timestamp($2)
        ) sub
        GROUP BY bucket, symbol
        ORDER BY bucket DESC
        LIMIT 1000
    `, [symbol, before]);

    res.json(result.rows.reverse());
  } catch (err) {
    console.error("HISTORY ERROR:", err.message);
    res.status(500).json({ error: "server error" });
  }
});

export default router;