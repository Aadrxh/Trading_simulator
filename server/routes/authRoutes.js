import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: "Invalid email"
      });
    }

    if (
      password.length < 6 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return res.status(400).json({
        error:
          "Weak password"
      });
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE email=$1`,
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "User already exists"
      });
    }

    const hashed =
      await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users (email, password)
      VALUES ($1,$2)
      RETURNING id,email
      `,
      [cleanEmail, hashed]
    );
    const user = result.rows[0];

    // starter balance
    await pool.query(
      `
      INSERT INTO balances (user_id, usd)
      VALUES ($1, 100000)
      `,
      [user.id]
    );

    // starter assets
    await pool.query(
      `
      INSERT INTO positions (
        user_id,
        symbol,
        quantity,
        avg_price
      )
      VALUES
      ($1,'BINANCE:BTCUSDT',1,2000),
      ($1,'BINANCE:ETHUSDT',10,150),
      ($1,'BINANCE:SOLUSDT',100,20),
      ($1,'BINANCE:DOGEUSDT',10000,0.1)
      `,
      [user.id]
    );

    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token });

  } catch (err) {
    console.error(
      "REGISTER ERROR:",
      err
    );

    res.status(500).json({
      error: "Server error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }
    const cleanEmail =
      email.trim().toLowerCase();

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: "Invalid email"
      });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email=$1`,
      [cleanEmail]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        error: "User not found"
      });
    }

    const valid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!valid) {
      return res.status(400).json({
        error: "Invalid password"
      });
    }

    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    console.error(
      "LOGIN ERROR:",
      err
    );

    res.status(500).json({
      error: "Server error"
    });
  }
});

export default router;