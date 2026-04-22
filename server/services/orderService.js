import { pool } from "../db.js";

// 🔥 PLACE ORDER
export async function placeOrder({ user_id, symbol, type, side, price, quantity }) {
  const result = await pool.query(
    `INSERT INTO orders (user_id, symbol, type, side, price, quantity, status)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN')
     RETURNING *`,
    [user_id, symbol, type, side, price || null, quantity]
  );

  return result.rows[0];
}

export async function matchOrders(symbol, price) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔥 LOCK ORDERS (CRITICAL)
    const orders = await client.query(
      `SELECT * FROM orders
       WHERE symbol=$1 AND status='OPEN'
       FOR UPDATE`,
      [symbol]
    );

    for (const order of orders.rows) {
      let shouldExecute = false;

      if (order.type === "MARKET") {
        shouldExecute = true;
      }

      if (order.type === "LIMIT") {
        if (order.side === "BUY" && price <= order.price) {
          shouldExecute = true;
        }
        if (order.side === "SELL" && price >= order.price) {
          shouldExecute = true;
        }
      }

      if (!shouldExecute) continue;
      const balance = await client.query(
            `SELECT usd FROM balances WHERE user_id=$1 FOR UPDATE`,
            [order.user_id]
            );

            if (!balance.rows.length) continue;

            const cost = price * order.quantity;

            if (order.side === "BUY" && balance.rows[0].usd < cost) {
            console.log("❌ Insufficient funds:", order.user_id);
            continue;
            }

      // 🔥 EXECUTE ORDER
      await client.query(
        `UPDATE orders SET status='FILLED' WHERE id=$1`,
        [order.id]
      );

      
      // 🔥 UPDATE BALANCE (BASIC VERSION)
      if (order.side === "BUY") {
        await client.query(
          `UPDATE balances
           SET usd = usd - $1
           WHERE user_id=$2`,
          [price * order.quantity, order.user_id]
        );
      } else {
        await client.query(
          `UPDATE balances
           SET usd = usd + $1
           WHERE user_id=$2`,
          [price * order.quantity, order.user_id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Match error:", err.message);
  } finally {
    client.release();
  }
}