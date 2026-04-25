import { useState, useEffect } from "react";

export default function OrderForm({ selectedSymbol, ws, lastPrice: priceFromApp }) {
  const [quantity, setQuantity] = useState(0.01);
  const [price, setPrice] = useState("");
  const [type, setType] = useState("MARKET");



  // 🔥 auto-fill price when switching to LIMIT
  useEffect(() => {
    if (type === "LIMIT" && !price && priceFromApp) {
      setPrice(priceFromApp);
    }
  }, [type]);
  useEffect(() => {
    setPrice(""); // reset
  }, [selectedSymbol]);

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
    <div style={{ background: "#161b22", padding: "20px", border: "1px solid #21262d", borderRadius: "12px" }}>
      <h3>Order</h3>

      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="MARKET">Market</option>
        <option value="LIMIT">Limit</option>
      </select>

      {type === "LIMIT" && (
        <input
          type="text"
          value={quantity}
          placeholder="Qty"
          onChange={e => {
            const val = e.target.value;
            if (/^\d*\.?\d*$/.test(val)) {
              setQuantity(val);
            }
          }}
        />
      )}

      <input
        type="text"
        value={price}
        placeholder="Price"
        onChange={e => {
          const val = e.target.value;

          if (/^\d*\.?\d*$/.test(val)) {
            setPrice(val);
          }
        }}
      />
      <button onClick={() => placeOrder("BUY")}>Buy</button>
      <button onClick={() => placeOrder("SELL")}>Sell</button>
    </div>
  );
}