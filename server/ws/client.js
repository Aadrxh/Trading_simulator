import { WebSocketServer } from "ws";
import { backfillStore, isBackfillDone } from "../state/store.js";

export function initClientWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws) => {
    try {
      while (!isBackfillDone) {
        await new Promise(res => setTimeout(res, 200));
      }

      const allData = [];

      for (const candles of backfillStore.values()) {
        if (!candles || candles.length === 0) continue;
        allData.push(...candles);
      }

      ws.send(JSON.stringify({
        type: "history",
        data: allData
      }));

    } catch (err) {
      console.error("Initial fetch error:", err);
    }
  });

  return wss;
}