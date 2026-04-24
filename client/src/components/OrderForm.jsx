import { useState, useEffect } from "react";

export default function OrderForm({ selectedSymbol, ws, lastPrice: priceFromApp }) {
  const [quantity, setQuantity] = useState(0.01);
  const [price, setPrice] = useState("");
  const [type, setType] = useState("MARKET");



  // 🔥 auto-fill price when switching to LIMIT
  useEffect(() => {
    if (type === "LIMIT" && priceFromApp) {
      setPrice(priceFromApp);
    }
  }, [type, priceFromApp]);

  const placeOrder = async (side) => {
    const payload = {
      user_id: 1,
      symbol: selectedSymbol,
      type,
      side,
      quantity: Number(quantity)
    };

    if (type === "LIMIT") {
      const parsedPrice = parseFloat(price);

      if (!parsedPrice || parsedPrice <= 0) {
        alert("Enter valid price");
        return;
      }

      payload.price = parsedPrice;
    }

    await fetch("http://localhost:3000/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  };

  return (
    <div style={{ background: "#111", padding: 10 }}>
      <h3>Order</h3>

      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="MARKET">Market</option>
        <option value="LIMIT">Limit</option>
      </select>

      {type === "LIMIT" && (
        <input
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      )}

      <input
        placeholder="Qty"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
      />

      <button onClick={() => placeOrder("BUY")}>Buy</button>
      <button onClick={() => placeOrder("SELL")}>Sell</button>
    </div>
  );
}