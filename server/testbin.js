import express from "express";
import http from "http";
import helmet from "helmet";
import cors from "cors";

import { pool } from "./db.js";
import historyRoute from "./routes/history.js";
import { initClientWS } from "./ws/client.js";
import { connectBinance } from "./ws/binance.js";
import { backfill, cleanupOldData } from "./services/backfill.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"]
}));

app.use("/history", historyRoute);

const server = http.createServer(app);

const wss = initClientWS(server);

async function start() {
  await cleanupOldData(pool);
  await backfill();

  connectBinance(wss);

  server.listen(3000, () => {
    console.log("🚀 Binance test server running");
  });
}

start();