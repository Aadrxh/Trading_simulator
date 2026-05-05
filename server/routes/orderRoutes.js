import express from "express";
import { placeOrder } from "../services/orderService.js";
import { validateOrder } from "../util/validate.js";
import { orderBook } from "../state/orderBook.js";
// import {triggerMatch} from "../services/matchingEngine.js";
import { getPrice } from "../state/priceStore.js";
import { auth } from "../middleware/auth.js";
import { getNextSeq } from "../state/seq.js";

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

      // 🔒 SECURITY CHECK
      if (!req.user || !req.user.user_id) {
        return res.status(401).json({ error: "Unauthorized: user not found" });
      }

      // 🔥 FIX: use correct field from token
      const orderData = {
        ...req.body,
        user_id: req.user.user_id
      };

      console.log("USER FROM AUTH:", req.user); //debug

      const order = await placeOrder(orderData);

       //here was matchorder before instead of triggermatch
      res.json(order);

      const buys = orderBook.BUY.get(order.symbol) || [];
      const sells = orderBook.SELL.get(order.symbol) || [];

      console.log("SENDING ORDERBOOK:", { //debug
        symbol: order.symbol,
        buys,
        sells
      });

      // 🔥 REALISTIC: immediate book update WITH GLOBAL SEQ
      const seq = getNextSeq();

      broadcast({
        type: "orderbook",
        seq,
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