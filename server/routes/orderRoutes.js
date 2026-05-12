import express from "express";
import { auth } from "../middleware/auth.js";
import { placeOrder } from "../services/orderService.js";

// import {
//   triggerMatch
// } from "../services/matchingEngine.js";

export default function orderRoutes(broadcast,triggerMatch) {
  const router = express.Router();

  router.post("/", auth, async (req, res) => {
    try {
      const {
        symbol,
        type,
        side,
        price,
        quantity
      } = req.body;

      if (!symbol || !type || !side || !quantity) {
        return res.status(400).json({
          error: "Missing fields"
        });
      }

      const placed = await placeOrder(
        {
          user_id: req.user.user_id,
          symbol,
          type,
          side,
          price,
          quantity
        },
        broadcast
      );

      //immediate matching
      await triggerMatch(
        symbol,
        price || 0
      );
      res.json(placed);

    } catch (err) {
        res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
}