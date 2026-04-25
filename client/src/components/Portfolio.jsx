export default function Portfolio({ portfolio }) {
  return (
    <div style={{ background: "#161b22", padding: "20px", border: "1px solid #21262d", borderRadius: "12px" }}>
      <h3>Portfolio</h3>

      <p style={{ marginTop: "0", marginBottom: "12px", fontSize: "13px" }}>Balance: <span style={{ fontWeight: "bold", color: "#4cd137" }}>${portfolio.balance.toFixed(2)}</span></p>

      {portfolio.positions.map((p, i) => (
        <div key={i} style={{ padding: "8px 0", fontSize: "12px", color: "#8b949e", lineHeight: "1.6" }}>
          <strong style={{ color: "#c9d1d9" }}>{p.symbol}</strong> → {p.quantity} @ {p.avg_price.toFixed(2)}
        </div>
      ))}
    </div>
  );
}