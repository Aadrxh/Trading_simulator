import express from "express";
import { placeOrder, matchOrders } from "../services/orderService.js";
import { validateOrder } from "../util/validate.js";
import { orderBook } from "../state/orderBook.js";
// import {triggerMatch} from "../services/matchingEngine.js";
import { getPrice } from "../state/priceStore.js";
import { auth } from "../middleware/auth.js";

export default function orderRoutes(triggerMatch,broadcast) {
  const router = express.Router();

  // // 🔥 BROADCAST FUNCTION
  // const broadcast = (data) => {
  //   wss.clients.forEach(ws => {
  //     if (ws.readyState === 1) {
  //       ws.send(JSON.stringify(data));
  //     }
  //   });
  // };


  router.post("/",auth,async (req, res) => {
    try {
      const error = validateOrder(req.body);
      if (error) return res.status(400).json({ error });

      const order = await placeOrder(req.body);

       //here was matchorder before instead of triggermatch
      res.json(order);

      const buys = orderBook.BUY.get(order.symbol) || [];
      const sells = orderBook.SELL.get(order.symbol) || [];

      console.log("SENDING ORDERBOOK:", { //debug
        symbol: order.symbol,
        buys: orderBook.BUY.get(order.symbol),
        sells: orderBook.SELL.get(order.symbol)
      });
      broadcast({
        type: "orderbook",
        data: {
          symbol: order.symbol,
          buys: buys.map(o => ({ ...o })),
          sells: sells.map(o => ({ ...o }))
        }
      });

      const marketPrice = getPrice(order.symbol);

      if (marketPrice !== undefined) {
        triggerMatch(order.symbol, marketPrice);
      }

    } catch (err) {
      console.error("FULL ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}