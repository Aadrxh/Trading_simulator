import { useEffect, useState } from "react";

function aggregateOrders(orders, isBuy) {
  const map = new Map();

  for (const o of orders) {
    const priceKey = Number(o.price).toFixed(2);
    const qty = Number(o.remaining_quantity || o.quantity || 0);

    if (!map.has(priceKey)) {
      map.set(priceKey, 0);
    }

    map.set(priceKey, map.get(priceKey) + qty);
  }

  const result = Array.from(map.entries()).map(([price, quantity]) => ({
    price: Number(price),
    quantity
  }));

  result.sort((a, b) =>
    isBuy ? b.price - a.price : a.price - b.price
  );

  return result;
}

export default function OrderBook({ orderbook }) {
  const [buys, setBuys] = useState([]);
  const [sells, setSells] = useState([]);

  // ✅ FIX 1: sync props → state correctly
  useEffect(() => {
    if (!orderbook) return;
    console.log("ORDERBOOK PROP:", orderbook); //debug
    setBuys([...(orderbook.buys || [])]);
    setSells([...(orderbook.sells || [])]);
  }, [orderbook]);

  // 🔥 sort
  const aggregatedBuys = aggregateOrders(buys, true);
  const aggregatedSells = aggregateOrders(sells, false);

  // // 🔥 cumulative depth
  // const addCumulative = (orders) => {
  //   let total = 0;
  //   return orders.map((o) => {
  //     const qty = Number(o.remaining_quantity || o.quantity || 0);
  //     total += qty;
  //     return { ...o, cumulative: total };
  //   });
  // };

  const addCumulative = (levels) => {
    let total = 0;
    return levels.map(l => {
      total += l.quantity;
      return { ...l, cumulative: total };
    });
  };

  const buysWithDepth = addCumulative(aggregatedBuys);
  const sellsWithDepth = addCumulative(aggregatedSells);

  const DISPLAY_LIMIT = 10;
  const displayBuys = buysWithDepth.slice(0, DISPLAY_LIMIT);
  const displaySells = sellsWithDepth.slice(0, DISPLAY_LIMIT);

  // ✅ FIX 2: safe maxDepth (avoid crash on empty arrays)
  const maxBuyDepth = Math.max(
    ...buysWithDepth.map(o => o.cumulative),
    1
  );

  const maxSellDepth = Math.max(
    ...sellsWithDepth.map(o => o.cumulative),
    1
  );

  const bestBid = buysWithDepth[0]?.price;
  const bestAsk = sellsWithDepth[0]?.price;
  const spread =
    bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : "-";

  return (
    <div
      style={{
        background: "#161b22",
        padding: "20px",
        border: "1px solid #21262d",
        borderRadius: "12px",
      }}
    >
      <h3>Order Book</h3>

      <div
        style={{
          marginBottom: "15px",
          fontSize: "13px",
          color: "#f0b90b",
          fontWeight: "bold",
        }}
      >
        Spread: {spread}
      </div>

      {/* 🔴 SELLS */}
      <div style={{ marginBottom: "12px" }}>
        {displaySells.map((o, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              color: i === 0 ? "orange" : "red",
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: "12px",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: 0,
                height: "100%",
                width: `${(o.cumulative / maxSellDepth) * 100}%`,
                background: "rgba(255,0,0,0.2)",
              }}
            />

            <span>{Number(o.price || 0).toFixed(2)}</span>
            <span>
              {Number(o.quantity || 0).toFixed(4)}
            </span>
          </div>
        ))}
      </div>

      <hr style={{ margin: "12px 0", borderColor: "#333" }} />

      {/* 🟢 BUYS */}
      <div>
        {displayBuys.map((o, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              color: i === 0 ? "lightgreen" : "green",
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: "12px",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: 0,
                height: "100%",
                width: `${(o.cumulative / maxBuyDepth) * 100}%`,
                background: "rgba(0,255,0,0.2)",
              }}
            />

            <span>{Number(o.price || 0).toFixed(2)}</span>
            <span>
              {Number(o.quantity || 0).toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}