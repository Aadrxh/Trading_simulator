export function validateOrder(data) {
  const { symbol, type, side, price, quantity } = data;

  if (!symbol || !type || !side || quantity === undefined) {
    return "Missing required fields";
  }

  // normalize
  const qty = Number(quantity);
  const pr = price !== undefined ? Number(price) : null;

  if (!["MARKET", "LIMIT"].includes(type)) {
    return "Invalid order type";
  }

  if (!["BUY", "SELL"].includes(side)) {
    return "Invalid side";
  }

  if (Number.isNaN(qty) || qty <= 0) {
    return "Invalid quantity";
  }

  if (type === "LIMIT") {
    if (pr === null || Number.isNaN(pr) || pr <= 0) {
      return "Invalid price";
    }
  }

  //prevent huge orders
  if (qty > 1000000) {
    return "Order too large";
  }

  //precision abuse protection
  if (qty.toString().split(".")[1]?.length > 8) {
    return "Quantity precision too high";
  }

  if (pr !== null && pr.toString().split(".")[1]?.length > 8) {
    return "Price precision too high";
  }

  return null;
}