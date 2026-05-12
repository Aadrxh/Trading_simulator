import { pool } from "../db.js";
import { orderBook } from "../state/orderBook.js";

export async function loadOrderBookFromDB() {
  const result = await pool.query(`
    SELECT * FROM orders
    WHERE status = 'OPEN'
  `);

  for (const order of result.rows) {
    const sideMap =
      order.side === "BUY" ? orderBook.BUY : orderBook.SELL;

    if (!sideMap.has(order.symbol)) {
      sideMap.set(order.symbol, []);
    }

    sideMap.get(order.symbol).push({
      ...order,
      remaining_quantity:
        order.remaining_quantity ?? order.quantity
    });
  }
  // sort after load
  for (const [symbol, buys] of orderBook.BUY.entries()) {
    buys.sort((a, b) => b.price - a.price);
  }

  for (const [symbol, sells] of orderBook.SELL.entries()) {
    sells.sort((a, b) => a.price - b.price);
  }
  console.log("OrderBook restored from DB");
}