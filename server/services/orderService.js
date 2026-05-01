import { pool } from "../db.js";
import { addOrderToBook, orderBook } from "../state/orderBook.js";

// 🔥 GLOBAL SEQ (FIX — was resetting before)
let orderbookSeq = 0;

// 🔥 PLACE ORDER
export async function placeOrder({ user_id, symbol, type, side, price, quantity }) {
  const result = await pool.query(
    `INSERT INTO orders (user_id, symbol, type, side, price, quantity, status)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN')
     RETURNING *`,
    [user_id, symbol, type, side, price || null, quantity]
  );
  const order=result.rows[0];

  if(order.type==="LIMIT"){
    addOrderToBook(order);
  }

  console.log("BOOK AFTER ADD:", { //debug
    buys: orderBook.BUY.get(order.symbol),
    sells: orderBook.SELL.get(order.symbol)
  });

  return order;
}

export async function matchOrders(symbol, price,broadcast) { //on every tick recieved from binance
  const client = await pool.connect();

  try {
    await client.query("BEGIN"); //starts a transaction

    // 🔥 IMPORTANT CHANGE:
    // ❌ removed DB-driven matching loop (was causing inconsistencies)
    // ✔ using in-memory orderBook instead

    const buys = orderBook.BUY.get(symbol) || [];
    const sells = orderBook.SELL.get(symbol) || [];

    while (buys.length && sells.length) {
      const bestBuy = buys[0];
      const bestSell = sells[0];
      
      //prevent self trade
      if (bestBuy.user_id === bestSell.user_id) {
        console.log("⚠️ Skipping self trade:", bestBuy.user_id);

        //moving one side forward to avoid infinite loop
        sells.shift();

        continue;
      }

      // stop if no match
      if (parseFloat(bestBuy.price) < parseFloat(bestSell.price)) break;

      const tradeQty = Math.min(
        parseFloat(bestBuy.remaining_quantity),
        parseFloat(bestSell.remaining_quantity)
      );

      const tradePrice = parseFloat(bestSell.price ?? bestBuy.price ?? price);
      if (!tradePrice || tradePrice <= 0) {
        console.log("❌ Invalid trade price", {
          bestBuy: bestBuy.price,
          bestSell: bestSell.price,
          fallback: price
        });
        continue;
      }

      bestBuy.remaining_quantity -= tradeQty;
      bestSell.remaining_quantity -= tradeQty;

      //insert
      await client.query(
        `INSERT INTO trades (symbol, price, quantity, buyer_id, seller_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          symbol,
          tradePrice,
          tradeQty,
          bestBuy.user_id,
          bestSell.user_id
        ]
      );

      //balance update
      await client.query(
        `UPDATE balances SET usd = usd - $1 WHERE user_id=$2`,
        [tradeQty * tradePrice, bestBuy.user_id]
      );

      await client.query(
        `UPDATE balances SET usd = usd + $1 WHERE user_id=$2`,
        [tradeQty * tradePrice, bestSell.user_id]
      );

      //positions update
      await client.query(`
        INSERT INTO positions (user_id, symbol, quantity, avg_price)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id, symbol)
        DO UPDATE SET
          quantity = positions.quantity + $3,
          avg_price = (
            (positions.quantity * positions.avg_price + $3 * $4)
            / (positions.quantity + $3)
          )
      `, [bestBuy.user_id, symbol, tradeQty, tradePrice]);

      await client.query(`
        UPDATE positions
        SET quantity = quantity - $1
        WHERE user_id=$2 AND symbol=$3
      `, [tradeQty, bestSell.user_id, symbol]);


      //remove satisfied orders
      if (bestBuy.remaining_quantity <= 0) {
        buys.shift(); //removes first element of the array
        await client.query(`UPDATE orders SET status='FILLED' WHERE id=$1`, [bestBuy.id]);
      }

      if (bestSell.remaining_quantity <= 0) {
        sells.shift();
        await client.query(`UPDATE orders SET status='FILLED' WHERE id=$1`, [bestSell.id]);
      }
      broadcast({
        type: "trade",
        data: {
          symbol,
          price: tradePrice,
          quantity: tradeQty,
          time: Date.now()
        }
      });
    }

    if (buys.length > 0) {
      orderBook.BUY.set(symbol, buys);
    } else {
      orderBook.BUY.delete(symbol);
    }

    if (sells.length > 0) {
      orderBook.SELL.set(symbol, sells);
    } else {
      orderBook.SELL.delete(symbol);
    }

    const finalBuys = orderBook.BUY.get(symbol) || [];
    const finalSells = orderBook.SELL.get(symbol) || [];

    //fix by ai
    orderbookSeq++;

    broadcast({
      type: "orderbook",
      seq: orderbookSeq,
      data: {
        symbol,
        buys: finalBuys.map(o => ({ ...o })),
        sells: finalSells.map(o => ({ ...o }))
      }
    });

    // portfolio update
    const result = await client.query(`
      SELECT b.usd, p.symbol, p.quantity, p.avg_price
      FROM balances b
      LEFT JOIN positions p ON b.user_id = p.user_id
      WHERE b.user_id = $1
    `, [1]);

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
      data: {
        balance,
        positions
      }
    });

    await client.query("COMMIT"); //lock released

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Match error:", err.message);
  } finally {
    client.release();
  }
}