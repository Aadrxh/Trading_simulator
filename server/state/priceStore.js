const lastPrice = new Map();

export function setPrice(symbol, price) {
  lastPrice.set(symbol, price);
}

export function getPrice(symbol) {
  return lastPrice.get(symbol);
}