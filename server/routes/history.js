import express from "express";
import { pool } from "../db.js";
import {auth} from "../middleware/auth.js";

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

// Get trade history for a symbol
router.get("/trades/:symbol", auth, async (req, res) => {
  try {
    const { symbol } = req.params;

    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT *
       FROM trades
       WHERE symbol=$1
       AND (
         buyer_id=$2
         OR seller_id=$2
       )
       ORDER BY created_at DESC
       LIMIT 50`,
      [symbol, userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Trade history error:", err);

    res.status(500).json({
      error: "Failed to fetch trades"
    });
  }
});

export default router;