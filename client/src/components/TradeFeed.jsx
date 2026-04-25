export default function TradeFeed({ trades }) {
  return (
    <div style={{ background: "#161b22", padding: "20px", border: "1px solid #21262d", borderRadius: "12px" }}>
      <h3>Trades</h3>

      {trades.map((t, i) => (
        <div key={i} style={{ padding: "8px 0", lineHeight: "1.5", fontSize: "13px", color: "#8b949e" }}>
          {t.price} × {t.quantity}
        </div>
      ))}
    </div>
  );
}