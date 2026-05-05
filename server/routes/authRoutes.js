import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();
const JWT_SECRET = "supersecret";

// 🔥 REGISTER
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password)
       VALUES ($1,$2)
       RETURNING id`,
      [username, hashed]
    );

    const user_id = result.rows[0].id;

    // 🔥 GIVE STARTING USD BALANCE
    await pool.query(
      `INSERT INTO balances (user_id, usd)
       VALUES ($1, $2)`,
      [user_id, 100000] // 💰 100k USD
    );

    // 🔥 GIVE STARTER ASSET (so SELL works)
    await pool.query(
      `INSERT INTO positions (user_id, symbol, quantity, avg_price)
       VALUES ($1, $2, $3, $4)`,
      [user_id, "BINANCE:BTCUSDT", 1, 2000] // 1 BTC @ 2000
    );

    const token = jwt.sign({ user_id }, JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ token });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// 🔥 LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM users WHERE username=$1`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ user_id: user.id }, JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ token });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;