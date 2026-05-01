import jwt from "jsonwebtoken";
import {pool} from "../db.js";
import { decodeBase64 } from "bcryptjs";

const JWT_SECRET = "supersecret";

export function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded; // { user_id }

    next();

  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}