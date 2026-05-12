// client/src/components/TradeFeed.jsx

export default function TradeFeed({
  trades
}) {

  return (
    <div
      style={{
        background: "#161b22",
        padding: "20px",
        border: "1px solid #21262d",
        borderRadius: "12px",
        maxHeight: "500px",
        overflowY: "auto"
      }}
    >

      <h3 style={{ marginTop: 0 }}>
        Trades
      </h3>

      {trades.length === 0 && (
        <div
          style={{
            color: "#8b949e"
          }}
        >
          No trades yet
        </div>
      )}

      {trades.map((t) => (

        <div
          key={t.id}
          style={{
            padding: "10px 0",
            borderBottom:
              "1px solid #21262d",
            lineHeight: "1.5",
            fontSize: "13px",
            color: "#8b949e"
          }}
        >

          <div>
            {t.price} × {t.quantity}
          </div>

          <div
            style={{
              fontSize: "11px",
              opacity: 0.7
            }}
          >
            {new Date(
              t.created_at
            ).toLocaleTimeString()}
          </div>

        </div>

      ))}
    </div>
  );
}