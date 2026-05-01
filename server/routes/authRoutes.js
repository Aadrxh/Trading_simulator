import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

const JWT_SECRET = "supersecret"; // later move to env

// 🔥 REGISTER
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password)
       VALUES ($1,$2)
       RETURNING id`,
      [email, hashed]
    );

    res.json({ user_id: result.rows[0].id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM users WHERE email=$1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { user_id: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;