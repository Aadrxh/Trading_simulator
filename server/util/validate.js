export function validateOrder(data) {
  const { user_id, symbol, type, side, price, quantity } = data;

  if (!user_id || !symbol || !type || !side || !quantity) {
    return "Missing required fields";
  }

  if (!["MARKET", "LIMIT"].includes(type)) {
    return "Invalid order type";
  }

  if (!["BUY", "SELL"].includes(side)) {
    return "Invalid side";
  }

  if (type === "LIMIT" && (!price || price <= 0)) {
    return "Invalid price";
  }

  if (quantity <= 0) {
    return "Invalid quantity";
  }

  // 🔥 SECURITY: prevent huge orders
  if (quantity > 1000000) {
    return "Order too large";
  }

  return null;
}