export default function TradeFeed({ trades }) {
  return (
    <div style={{ background: "#111", padding: 10 }}>
      <h3>Trades</h3>

      {trades.map((t, i) => (
        <div key={i}>
          {t.price} × {t.quantity}
        </div>
      ))}
    </div>
  );
}