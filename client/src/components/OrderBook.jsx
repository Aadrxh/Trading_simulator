import { useEffect, useState } from "react";

export default function OrderBook({ orderbook }) {
  const [buys, setBuys] = useState([]);
  const [sells, setSells] = useState([]);

  useEffect(() => {
    setBuys(buys);
    setSells(sells);
  }, [buys, sells]);

  // 🔥 sort properly
  const sortedBuys = [...buys].sort((a, b) => b.price - a.price);
  const sortedSells = [...sells].sort((a, b) => a.price - b.price);

  // 🔥 cumulative depth
  const addCumulative = (orders) => {
    let total = 0;
    return orders.map(o => {
      total += Number(o.remaining_quantity || o.quantity);
      return { ...o, cumulative: total };
    });
  };

  const buysWithDepth = addCumulative(sortedBuys);
  const sellsWithDepth = addCumulative(sortedSells);

  const maxDepth = Math.max(
    ...buysWithDepth.map(o => o.cumulative),
    ...sellsWithDepth.map(o => o.cumulative),
    1
  );

  const bestBid = buysWithDepth[0]?.price;
  const bestAsk = sellsWithDepth[0]?.price;
  const spread = bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : "-";

  return (
    <div style={{ background: "#161b22", padding: "20px", border: "1px solid #21262d", borderRadius: "12px" }}>
      <h3>Order Book</h3>

      <div style={{ marginBottom: "15px", fontSize: "13px", color: "#f0b90b", fontWeight: "bold" }}>
        Spread: {spread}
      </div>

      {/* SELLS */}
      <div style={{ marginBottom: "12px" }}>
        {sellsWithDepth.map((o, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              color: i === 0 ? "orange" : "red",
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: "12px",
              zIndex: 1
            }}
          >
            {/* depth bar */}
            <div
              style={{
                position: "absolute",
                right: 0,
                height: "100%",
                width: `${(o.cumulative / maxDepth) * 100}%`,
                background: "rgba(255,0,0,0.2)",
                zIndex: -1
              }}
            />

            <span>{Number(o.price).toFixed(2)}</span>
            <span>{Number(o.remaining_quantity || o.quantity).toFixed(4)}</span>
          </div>
        ))}
      </div>

      <hr style={{ margin: "12px 0", borderColor: "#333" }} />

      {/* BUYS */}
      <div>
        {buysWithDepth.map((o, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              color: i === 0 ? "lightgreen" : "green",
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: "12px",
              zIndex: 1
            }}
          >
            {/* depth bar */}
            <div
              style={{
                position: "absolute",
                right: 0,
                height: "100%",
                width: `${(o.cumulative / maxDepth) * 100}%`,
                background: "rgba(0,255,0,0.2)",
                zIndex: -1
              }}
            />

            <span>{Number(o.price).toFixed(2)}</span>
            <span>{Number(o.remaining_quantity || o.quantity).toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}