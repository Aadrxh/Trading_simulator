import { useState, useEffect } from "react";

export default function OrderForm({ selectedSymbol,lastPrice: priceFromApp }) {
  const [quantity, setQuantity] = useState(0.01);
  const [price, setPrice] = useState("");
  const [type, setType] = useState("MARKET");



  // suggesting lastprice
  useEffect(() => {
    if (type === "LIMIT" && !price && priceFromApp) {
      setPrice(priceFromApp);
    }
  }, [type,priceFromApp]);
  
  useEffect(() => {
    setPrice(""); // reset
  }, [selectedSymbol]);

  const placeOrder = async (side) => {
    const payload = {
      symbol: selectedSymbol,
      type,
      side,
      quantity: Number(quantity)
    };

    if (type === "LIMIT") {
      const parsedPrice = parseFloat(price);

      if (!parsedPrice || parsedPrice <= 0) {
        alert("Enter valid price"); // change this later
        return;
      }

      payload.price = parsedPrice;
    }

    try {
        console.log("🚀 Placing order:", payload);

        const res=await fetch("http://localhost:3000/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(payload)
        });

        console.log("✅ Status:", res.status);

        const data = await res.json();
        console.log("📦 Response:", data);

      } catch (err) {
        console.error("❌ Fetch failed:", err);
      }
  };

  return (
    <div style={{ background: "#161b22", padding: "20px", border: "1px solid #21262d", borderRadius: "12px" }}>
      <h3>Order</h3>

      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="MARKET">Market</option>
        <option value="LIMIT">Limit</option>
      </select>

        <input  //to be always shown
        type="text"
        value={quantity}
        placeholder="Quantity"
        onChange={e => {
          const val = e.target.value;
          if (/^\d*\.?\d*$/.test(val)) {
            setQuantity(val);
          }
        }}
      />

      {type === "LIMIT" && (
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
      )}
      <button onClick={() => placeOrder("BUY")}>Buy</button>
      <button onClick={() => placeOrder("SELL")}>Sell</button>
    </div>
  );
}