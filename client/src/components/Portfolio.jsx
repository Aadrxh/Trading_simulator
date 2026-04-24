export default function Portfolio({ portfolio }) {
  return (
    <div style={{ background: "#111", padding: 10 }}>
      <h3>Portfolio</h3>

      <p>Balance: ${portfolio.balance}</p>

      {portfolio.positions.map((p, i) => (
        <div key={i}>
          {p.symbol} → {p.quantity} @ {p.avg_price}
        </div>
      ))}
    </div>
  );
}