let isMatching = false;
const pending = new Map();

//this is to avoid conflict between binance trigerred matchorder and order triggered matchorder by using a queue

export function createMatchingEngine(matchOrders, orderBook, broadcast) {
  return async function triggerMatch(symbol, price) {
    pending.set(symbol, price);

    if (isMatching) return;

    isMatching = true;

    try {
      while (pending.size > 0) {
        const [sym, p] = pending.entries().next().value;
        pending.delete(sym);

        await matchOrders(sym, p, broadcast);

        const buys = orderBook.BUY.get(sym) || [];
        const sells = orderBook.SELL.get(sym) || [];

        broadcast({
          type: "orderbook",
          data: {
            symbol: sym,
            buys: buys.slice(0, 10),
            sells: sells.slice(0, 10)
          }
        });
      }
    } catch (err) {
      console.error("Match pipeline error:", err);
    } finally {
      isMatching = false;
    }
  };
} 