import express from "express";
import { placeOrder, matchOrders } from "../services/orderService.js";
import { validateOrder } from "../util/validate.js";
import { orderBook } from "../state/orderBook.js";

export default function orderRoutes(wss) {
  const router = express.Router();

  // 🔥 BROADCAST FUNCTION
  const broadcast = (data) => {
    wss.clients.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
      }
    });
  };

  router.post("/", async (req, res) => {
    try {
      const error = validateOrder(req.body);
      if (error) return res.status(400).json({ error });

      const order = await placeOrder(req.body);

      // 🔥 MATCH IMMEDIATELY
      await matchOrders(order.symbol, order.price, broadcast);

      // 🔥 SEND UPDATED ORDERBOOK
      const buys = orderBook.BUY.get(order.symbol) || [];
      const sells = orderBook.SELL.get(order.symbol) || [];

      broadcast({
        type: "orderbook",
        data: {
          symbol: order.symbol,
          buys: buys.slice(0, 10),
          sells: sells.slice(0, 10)
        }
      });

      res.json(order);

    } catch (err) {
      console.error("FULL ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}