export const orderBook = {
  BUY: new Map(),   // symbol -> [orders]
  SELL: new Map()
};

export function addOrderToBook(order) {
  const sideMap = order.side === "BUY" ? orderBook.BUY : orderBook.SELL;

  if (!sideMap.has(order.symbol)) {
    sideMap.set(order.symbol, []);
  }

  const arr = sideMap.get(order.symbol);

  arr.push({
    ...order,
    remaining_quantity: order.remaining_quantity ?? order.quantity
  });

  // sort
  arr.sort((a, b) => {
    if (order.side === "BUY") return b.price - a.price; // highest first
    return a.price - b.price; // lowest first
  });
}