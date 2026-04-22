import express from "express";
import { placeOrder } from "../services/orderService.js";
import { validateOrder } from "../utils/validate.js";

const router = express.Router();

// 🔥 PLACE ORDER
router.post("/", async (req, res) => {
  try {
    const error = validateOrder(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const order = await placeOrder(req.body);

    res.json(order);
  } catch (err) {
    console.error("Order error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;