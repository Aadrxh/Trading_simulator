import { pool } from "../db.js";
import { addOrderToBook, orderBook } from "../state/orderBook.js";
import { getNextSeq } from "../state/seq.js";

// 🔥 PLACE ORDER
export async function placeOrder({ user_id, symbol, type, side, price, quantity }) {

  // 🔥 SECURITY: validate SELL before inserting
  if (side === "SELL") {
    const pos = await pool.query(
      `SELECT quantity FROM positions WHERE user_id=$1 AND symbol=$2`,
      [user_id, symbol]
    );

    const available = parseFloat(pos.rows[0]?.quantity || 0);

    if (available < quantity) {
      throw new Error("Insufficient asset to sell");
    }
  }

  const result = await pool.query(
    `INSERT INTO orders (user_id, symbol, type, side, price, quantity, status)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN')
     RETURNING *`,
    [user_id, symbol, type, side, price || null, quantity]
  );

  const order = result.rows[0];

  if (order.type === "LIMIT") {
    addOrderToBook(order);
  }

  console.log("BOOK AFTER ADD:", {
    buys: orderBook.BUY.get(order.symbol),
    sells: orderBook.SELL.get(order.symbol)
  });

  return order;
}

export async function matchOrders(symbol, price, broadcast) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const buys = orderBook.BUY.get(symbol) || [];
    const sells = orderBook.SELL.get(symbol) || [];

    let i = 0;
    let j = 0;

    while (i < buys.length && j < sells.length) {
      const bestBuy = buys[i];
      const bestSell = sells[j];

      if (bestBuy.user_id === bestSell.user_id) break;
      if (parseFloat(bestBuy.price) < parseFloat(bestSell.price)) break;

      const tradeQty = Math.min(
        parseFloat(bestBuy.remaining_quantity),
        parseFloat(bestSell.remaining_quantity)
      );

      if (!tradeQty || tradeQty <= 0) break;

      const tradePrice = parseFloat(bestSell.price ?? bestBuy.price ?? price);
      if (!tradePrice || tradePrice <= 0) break;

      // 🔥 seller validation
      const sellerPos = await client.query(
        `SELECT quantity FROM positions WHERE user_id=$1 AND symbol=$2`,
        [bestSell.user_id, symbol]
      );

      const sellerQty = parseFloat(sellerPos.rows[0]?.quantity || 0);

      if (sellerQty < tradeQty) {
        sells.splice(j, 1);

        await client.query(
          `UPDATE orders SET status='REJECTED' WHERE id=$1`,
          [bestSell.id]
        );

        continue;
      }

      bestBuy.remaining_quantity -= tradeQty;
      bestSell.remaining_quantity -= tradeQty;

      // trade insert
      await client.query(
        `INSERT INTO trades (symbol, price, quantity, buyer_id, seller_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [symbol, tradePrice, tradeQty, bestBuy.user_id, bestSell.user_id]
      );

      // balances
      await client.query(
        `UPDATE balances SET usd = usd - $1 WHERE user_id=$2`,
        [tradeQty * tradePrice, bestBuy.user_id]
      );

      await client.query(
        `UPDATE balances SET usd = usd + $1 WHERE user_id=$2`,
        [tradeQty * tradePrice, bestSell.user_id]
      );

      // buyer position
      await client.query(`
        INSERT INTO positions (user_id, symbol, quantity, avg_price)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id, symbol)
        DO UPDATE SET
          quantity = positions.quantity + EXCLUDED.quantity,
          avg_price = (
            (positions.quantity * positions.avg_price + EXCLUDED.quantity * EXCLUDED.avg_price)
            / (positions.quantity + EXCLUDED.quantity)
          )
      `, [bestBuy.user_id, symbol, tradeQty, tradePrice]);

      // seller position
      await client.query(`
        UPDATE positions
        SET quantity = quantity - $1
        WHERE user_id=$2 AND symbol=$3
      `, [tradeQty, bestSell.user_id, symbol]);

      // remove orders
      if (bestBuy.remaining_quantity <= 0) {
        buys.splice(i, 1);
        await client.query(`UPDATE orders SET status='FILLED' WHERE id=$1`, [bestBuy.id]);
      } else i++;

      if (bestSell.remaining_quantity <= 0) {
        sells.splice(j, 1);
        await client.query(`UPDATE orders SET status='FILLED' WHERE id=$1`, [bestSell.id]);
      } else j++;

      // 🔥 TRADE BROADCAST
      broadcast({
        type: "trade",
        data: { symbol, price: tradePrice, quantity: tradeQty, time: Date.now() }
      });

      // 🔥 PORTFOLIO BROADCAST FOR BOTH USERS
      for (const uid of [bestBuy.user_id, bestSell.user_id]) {
        const result = await client.query(`
          SELECT b.usd, p.symbol, p.quantity, p.avg_price
          FROM balances b
          LEFT JOIN positions p ON b.user_id = p.user_id
          WHERE b.user_id = $1
        `, [uid]);

        const balance = parseFloat(result.rows[0]?.usd || 0);

        const positions = result.rows
          .filter(r => r.symbol)
          .map(r => ({
            symbol: r.symbol,
            quantity: parseFloat(r.quantity),
            avg_price: parseFloat(r.avg_price)
          }));

        broadcast({
          type: "portfolio",
          user_id: uid, // 🔥 IMPORTANT
          data: { balance, positions }
        });
      }
    }

    orderBook.BUY.set(symbol, buys);
    orderBook.SELL.set(symbol, sells);

    const seq = getNextSeq();

    broadcast({
      type: "orderbook",
      seq,
      data: {
        symbol,
        buys: buys.map(o => ({ ...o })),
        sells: sells.map(o => ({ ...o }))
      }
    });

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Match error:", err.message);
  } finally {
    client.release();
  }
}