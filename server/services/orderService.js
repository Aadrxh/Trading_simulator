// server/services/orderService.js

//formatting this file remaining
import { pool } from "../db.js";
import { orderBook } from "../state/orderBook.js";
import { sendPortfolioUpdate } from "../util/sendPortfolioUpdate.js";

// 🔥 PLACE ORDER
export async function placeOrder(order, broadcast) {

  const {
    user_id,
    symbol,
    type,
    side,
    price,
    quantity
  } = order;

  // 🔥 SECURITY VALIDATION
  if (!user_id || !symbol || !type || !side || !quantity) {
    throw new Error("Missing required fields");
  }

  const safeQty = Number(quantity);
  const safePrice = price ? Number(price) : null;

  if (Number.isNaN(safeQty) || safeQty <= 0) {
    throw new Error("Invalid quantity");
  }

  if (type === "LIMIT") {
    if (Number.isNaN(safePrice) || safePrice <= 0) {
      throw new Error("Invalid price");
    }
  }

  // 🔥 BUY BALANCE CHECK
  if (side === "BUY") {

    const balRes = await pool.query(
      `
      SELECT usd
      FROM balances
      WHERE user_id = $1
      `,
      [user_id]
    );

    const usd = Number(balRes.rows[0]?.usd || 0);

    const needed =
      type === "MARKET"
        ? safeQty * 1000000
        : safeQty * safePrice;

    if (usd < needed) {
      throw new Error("Insufficient USD balance");
    }
  }

  // 🔥 SELL POSITION CHECK
  if (side === "SELL") {

    const posRes = await pool.query(
      `
      SELECT quantity
      FROM positions
      WHERE user_id = $1
        AND symbol = $2
      `,
      [user_id, symbol]
    );

    const owned = Number(posRes.rows[0]?.quantity || 0);

    if (owned < safeQty) {
      throw new Error("Insufficient asset to sell");
    }
  }

  // 🔥 INSERT ORDER
  const result = await pool.query(
    `
    INSERT INTO orders (
      user_id,
      symbol,
      type,
      side,
      price,
      quantity,
      remaining_quantity,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::numeric,
      $6::numeric,
      $7::numeric,
      'OPEN'
    )
    RETURNING *
    `,
    [
      user_id,
      symbol,
      type,
      side,
      safePrice,
      safeQty,
      safeQty
    ]
  );

  const newOrder = result.rows[0];

  // 🔥 MARKET ORDERS EXECUTE IMMEDIATELY
  if (type === "MARKET") {

    await executeMarketOrder(
      newOrder,
      broadcast
    );

    return newOrder;
  }

  // 🔥 INIT MAPS
  if (!orderBook.BUY.has(symbol)) {
    orderBook.BUY.set(symbol, []);
  }

  if (!orderBook.SELL.has(symbol)) {
    orderBook.SELL.set(symbol, []);
  }

  // 🔥 ADD TO BOOK
  if (side === "BUY") {

    orderBook.BUY.get(symbol).push(newOrder);

    // highest bid first
    orderBook.BUY.get(symbol).sort(
      (a, b) => Number(b.price) - Number(a.price)
    );

  } else {

    orderBook.SELL.get(symbol).push(newOrder);

    // lowest ask first
    orderBook.SELL.get(symbol).sort(
      (a, b) => Number(a.price) - Number(b.price)
    );
  }

  return newOrder;
}

// 🔥 MARKET ORDER EXECUTION
async function executeMarketOrder(
  marketOrder,
  broadcast
) {

  const oppositeBook =
    marketOrder.side === "BUY"
      ? orderBook.SELL.get(marketOrder.symbol) || []
      : orderBook.BUY.get(marketOrder.symbol) || [];

  while (
    oppositeBook.length > 0 &&
    Number(marketOrder.remaining_quantity) > 0
  ) {

    const resting = oppositeBook[0];

    // preventing self trade
    if (resting.user_id === marketOrder.user_id) {
      if (!buy.selfTradeLogged) {
          console.log(
            `⚠️ Self-trade prevented for user ${buy.user_id}`
          );
          buy.selfTradeLogged = true;
        }
      break;
    }

    const tradeQty = Math.min(
      Number(marketOrder.remaining_quantity),
      Number(resting.remaining_quantity)
    );

    const tradePrice = Number(resting.price);

    const buyerId =
      marketOrder.side === "BUY"
        ? marketOrder.user_id
        : resting.user_id;

    const sellerId =
      marketOrder.side === "SELL"
        ? marketOrder.user_id
        : resting.user_id;

    const total = tradeQty * tradePrice;

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      // 🔥 BUYER USD --
      await client.query(
        `
        UPDATE balances
        SET usd = usd - $1
        WHERE user_id = $2
        `,
        [total, buyerId]
      );

      // 🔥 SELLER USD ++
      await client.query(
        `
        UPDATE balances
        SET usd = usd + $1
        WHERE user_id = $2
        `,
        [total, sellerId]
      );

      // 🔥 BUYER POSITION UPSERT
      await client.query(
        `
        INSERT INTO positions (
          user_id,
          symbol,
          quantity,
          avg_price
        )
        VALUES ($1,$2,$3,$4)

        ON CONFLICT (user_id, symbol)
        DO UPDATE SET

          quantity =
            positions.quantity + EXCLUDED.quantity,

          avg_price =
            (
              (positions.quantity * positions.avg_price)
              +
              (EXCLUDED.quantity * EXCLUDED.avg_price)
            )
            /
            (positions.quantity + EXCLUDED.quantity)
        `,
        [
          buyerId,
          marketOrder.symbol,
          tradeQty,
          tradePrice
        ]
      );

      // 🔥 SELLER POSITION --
      await client.query(
        `
        UPDATE positions
        SET quantity = quantity - $1
        WHERE user_id = $2
          AND symbol = $3
        `,
        [
          tradeQty,
          sellerId,
          marketOrder.symbol
        ]
      );

      // 🔥 CLEAN EMPTY POSITIONS
      await client.query(
        `
        DELETE FROM positions
        WHERE quantity <= 0
        `
      );

      // 🔥 INSERT TRADE
      const tradeRes = await client.query(
        `
        INSERT INTO trades (
          symbol,
          price,
          quantity,
          buyer_id,
          seller_id
        )
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          marketOrder.symbol,
          tradePrice,
          tradeQty,
          buyerId,
          sellerId
        ]
      );

      const trade = tradeRes.rows[0];

      // 🔥 UPDATE REMAINING
      marketOrder.remaining_quantity =
        Number(marketOrder.remaining_quantity) - tradeQty;

      resting.remaining_quantity =
        Number(resting.remaining_quantity) - tradeQty;

      // 🔥 UPDATE MARKET ORDER
      await client.query(
        `
        UPDATE orders
        SET
          remaining_quantity = $1,
          status = $2
        WHERE id = $3
        `,
        [
          marketOrder.remaining_quantity,
          marketOrder.remaining_quantity <= 0
            ? "FILLED"
            : "OPEN",
          marketOrder.id
        ]
      );

      // 🔥 UPDATE RESTING ORDER
      await client.query(
        `
        UPDATE orders
        SET
          remaining_quantity = $1,
          status = $2
        WHERE id = $3
        `,
        [
          resting.remaining_quantity,
          resting.remaining_quantity <= 0
            ? "FILLED"
            : "OPEN",
          resting.id
        ]
      );

      await client.query("COMMIT");

      // 🔥 DEBUG BALANCES
      const buyerBalance = await client.query(
        `
        SELECT usd
        FROM balances
        WHERE user_id = $1
        `,
        [buyerId]
      );

      const sellerBalance = await client.query(
        `
        SELECT usd
        FROM balances
        WHERE user_id = $1
        `,
        [sellerId]
      );

      // 🔥 DEBUG POSITIONS
      const buyerPosition = await client.query(
        `
        SELECT *
        FROM positions
        WHERE user_id = $1
          AND symbol = $2
        `,
        [
          buyerId,
          marketOrder.symbol
        ]
      );

      const sellerPosition = await client.query(
        `
        SELECT *
        FROM positions
        WHERE user_id = $1
          AND symbol = $2
        `,
        [
          sellerId,
          marketOrder.symbol
        ]
      );

      console.log("\n💥 MARKET TRADE COMPLETE");

      console.log("BUYER:", {
        user: buyerId,
        usd: buyerBalance.rows[0]?.usd,
        position: buyerPosition.rows
      });

      console.log("SELLER:", {
        user: sellerId,
        usd: sellerBalance.rows[0]?.usd,
        position: sellerPosition.rows
      });

      // 🔥 REMOVE FILLED LIMIT ORDER
      if (resting.remaining_quantity <= 0) {
        oppositeBook.shift();
      }

      // 🔥 TRADE FEED
      broadcast({
        type: "trade",
        data: trade
      });

      // 🔥 LIVE PORTFOLIO UPDATE
      await sendPortfolioUpdate(
        broadcast.wss,
        buyerId
      );

      await sendPortfolioUpdate(
        broadcast.wss,
        sellerId
      );

    } catch (err) {

      await client.query("ROLLBACK");

      console.error("Market execution error:", err);

      break;

    } finally {

      client.release();
    }
  }

  // 🔥 CANCEL UNFILLED MARKET REMAINDER
  if (Number(marketOrder.remaining_quantity) > 0) {

    await pool.query(
      `
      UPDATE orders
      SET status = $1
      WHERE id = $2
      `,
      [
        "CANCELLED",
        marketOrder.id
      ]
    );
  }
}

// 🔥 MATCH ENGINE
export async function matchOrders(symbol, marketPrice, broadcast) {

  const buys = orderBook.BUY.get(symbol) || [];
  const sells = orderBook.SELL.get(symbol) || [];

  while (buys.length > 0 && sells.length > 0) {

    const buy = buys[0];
    const sell = sells[0];

    // 🔥 PREVENT SELF TRADE
    if (buy.user_id === sell.user_id) {

      console.log("⚠️ Skipping self trade:", buy.user_id);

      // 🔥 KEEP ORDERS RESTING
      break;
    }

    const buyPrice =
      buy.type === "MARKET"
        ? Number.MAX_SAFE_INTEGER
        : Number(buy.price);

    const sellPrice =
      sell.type === "MARKET"
        ? 0
        : Number(sell.price);

    // 🔥 NO MATCH
    if (buyPrice < sellPrice) {
      break;
    }

    const tradeQty = Math.min(
      Number(buy.remaining_quantity),
      Number(sell.remaining_quantity)
    );

    const tradePrice =
      sell.type === "MARKET"
        ? buyPrice
        : sellPrice;

    const total = tradeQty * tradePrice;

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      // 🔥 BUYER USD --
      await client.query(
        `
        UPDATE balances
        SET usd = usd - $1
        WHERE user_id = $2
        `,
        [total, buy.user_id]
      );

      // 🔥 SELLER USD ++
      await client.query(
        `
        UPDATE balances
        SET usd = usd + $1
        WHERE user_id = $2
        `,
        [total, sell.user_id]
      );

      // 🔥 BUYER POSITION UPSERT
      await client.query(
        `
        INSERT INTO positions (
          user_id,
          symbol,
          quantity,
          avg_price
        )
        VALUES ($1,$2,$3,$4)

        ON CONFLICT (user_id, symbol)
        DO UPDATE SET

          quantity =
            positions.quantity + EXCLUDED.quantity,

          avg_price =
            (
              (positions.quantity * positions.avg_price)
              +
              (EXCLUDED.quantity * EXCLUDED.avg_price)
            )
            /
            (positions.quantity + EXCLUDED.quantity)
        `,
        [
          buy.user_id,
          symbol,
          tradeQty,
          tradePrice
        ]
      );

      // 🔥 SELLER POSITION --
      await client.query(
        `
        UPDATE positions
        SET quantity = quantity - $1
        WHERE user_id = $2
          AND symbol = $3
        `,
        [
          tradeQty,
          sell.user_id,
          symbol
        ]
      );

      // 🔥 CLEAN EMPTY POSITIONS
      await client.query(
        `
        DELETE FROM positions
        WHERE quantity <= 0
        `
      );

      // 🔥 INSERT TRADE
      const tradeRes = await client.query(
        `
        INSERT INTO trades (
          symbol,
          price,
          quantity,
          buyer_id,
          seller_id
        )
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          symbol,
          tradePrice,
          tradeQty,
          buy.user_id,
          sell.user_id
        ]
      );

      const trade = tradeRes.rows[0];

      // 🔥 UPDATE REMAINING
      buy.remaining_quantity =
        Number(buy.remaining_quantity) - tradeQty;

      sell.remaining_quantity =
        Number(sell.remaining_quantity) - tradeQty;

      // 🔥 UPDATE BUY ORDER
      await client.query(
        `
        UPDATE orders
        SET
          remaining_quantity = $1,
          status = $2
        WHERE id = $3
        `,
        [
          buy.remaining_quantity,
          buy.remaining_quantity <= 0
            ? "FILLED"
            : "OPEN",
          buy.id
        ]
      );

      // 🔥 UPDATE SELL ORDER
      await client.query(
        `
        UPDATE orders
        SET
          remaining_quantity = $1,
          status = $2
        WHERE id = $3
        `,
        [
          sell.remaining_quantity,
          sell.remaining_quantity <= 0
            ? "FILLED"
            : "OPEN",
          sell.id
        ]
      );

      await client.query("COMMIT");

      // 🔥 DEBUG BALANCES
      const buyerBalance = await client.query(
        `
        SELECT usd
        FROM balances
        WHERE user_id = $1
        `,
        [buy.user_id]
      );

      const sellerBalance = await client.query(
        `
        SELECT usd
        FROM balances
        WHERE user_id = $1
        `,
        [sell.user_id]
      );

      // 🔥 DEBUG POSITIONS
      const buyerPosition = await client.query(
        `
        SELECT *
        FROM positions
        WHERE user_id = $1
          AND symbol = $2
        `,
        [
          buy.user_id,
          symbol
        ]
      );

      const sellerPosition = await client.query(
        `
        SELECT *
        FROM positions
        WHERE user_id = $1
          AND symbol = $2
        `,
        [
          sell.user_id,
          symbol
        ]
      );

      console.log("\n💥 LIMIT TRADE COMPLETE");

      console.log("BUYER:", {
        user: buy.user_id,
        usd: buyerBalance.rows[0]?.usd,
        position: buyerPosition.rows
      });

      console.log("SELLER:", {
        user: sell.user_id,
        usd: sellerBalance.rows[0]?.usd,
        position: sellerPosition.rows
      });

      // 🔥 REMOVE FILLED ORDERS
      if (buy.remaining_quantity <= 0) {
        buys.shift();
      }

      if (sell.remaining_quantity <= 0) {
        sells.shift();
      }

      // 🔥 TRADE FEED
      broadcast({
        type: "trade",
        data: trade
      });

      // 🔥 LIVE PORTFOLIO UPDATE
      await sendPortfolioUpdate(
        broadcast.wss,
        buy.user_id
      );

      await sendPortfolioUpdate(
        broadcast.wss,
        sell.user_id
      );

    } catch (err) {

      await client.query("ROLLBACK");

      console.error("Match error:", err);

      break;

    } finally {

      client.release();
    }
  }
}