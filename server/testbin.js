import express from "express";
import http from "http";
import helmet from "helmet";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import { pool } from "./db.js";
import historyRoute from "./routes/history.js";
import { initClientWS } from "./ws/client.js";
import { connectBinance } from "./ws/binance.js";
import orderRoutes from "./routes/orderRoutes.js";
import { createMatchingEngine } from "./services/matchingEngine.js";
import { matchOrders } from "./services/orderService.js";
import { orderBook } from "./state/orderBook.js";
import { backfill, cleanupOldData } from "./services/backfill.js";

const app = express();

// 🔥 FIX: apply security + cors BEFORE routes
app.use(helmet());
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// routes AFTER cors
app.use("/auth", authRoutes);
app.use("/history", historyRoute);

const server = http.createServer(app);

const wss = initClientWS(server);

// 🔥 DEFINE BROADCAST HERE (GLOBAL)
const broadcast = (data) => {
  wss.clients.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  });
};

const triggerMatch = createMatchingEngine(matchOrders, orderBook, broadcast);

app.use("/orders", orderRoutes(triggerMatch, broadcast));

async function start() {
  await cleanupOldData(pool);
  await backfill();

  connectBinance(wss, triggerMatch);

  server.listen(3000, () => {
    console.log("🚀 Binance test server running");
  });
}

start();