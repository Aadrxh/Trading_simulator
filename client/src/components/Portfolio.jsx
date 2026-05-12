export default function Portfolio({
  portfolio,
  prices
}) {

  const totalPositionValue =
    portfolio.positions.reduce((acc, p) => {

      const currentPrice =
        prices[p.symbol] || 0;

      return acc + (
        currentPrice * p.quantity
      );

    }, 0);

  const totalPnL =
    portfolio.positions.reduce((acc, p) => {

      const currentPrice =
        prices[p.symbol] || 0;

      if (!p.avg_price) return acc;

      return acc + (
        (currentPrice - p.avg_price)
        * p.quantity
      );

    }, 0);

  const totalEquity =
    portfolio.balance + totalPositionValue;

  return (

    <div
      style={{
        background: "#161b22",
        padding: "20px",
        border: "1px solid #21262d",
        borderRadius: "12px"
      }}
    >

      <h3>Portfolio</h3>

      <p
        style={{
          marginTop: "0",
          marginBottom: "12px",
          fontSize: "13px"
        }}
      >
        Balance:
        {" "}
        <span
          style={{
            fontWeight: "bold",
            color: "#4cd137"
          }}
        >
          ${portfolio.balance.toFixed(2)}
        </span>
      </p>

      <p
        style={{
          marginTop: "0",
          marginBottom: "12px",
          fontSize: "13px"
        }}
      >
        Position Value:
        {" "}
        <span
          style={{
            fontWeight: "bold",
            color: "#58a6ff"
          }}
        >
          ${totalPositionValue.toFixed(2)}
        </span>
      </p>

      <p
        style={{
          marginTop: "0",
          marginBottom: "12px",
          fontSize: "13px"
        }}
      >
        Total Equity:
        {" "}
        <span
          style={{
            fontWeight: "bold",
            color: "#f1c40f"
          }}
        >
          ${totalEquity.toFixed(2)}
        </span>
      </p>

      <p
        style={{
          marginTop: "0",
          marginBottom: "20px",
          fontSize: "13px"
        }}
      >
        Unrealized PnL:
        {" "}
        <span
          style={{
            fontWeight: "bold",
            color:
              totalPnL >= 0
                ? "#4cd137"
                : "#ff6b6b"
          }}
        >
          ${totalPnL.toFixed(2)}
        </span>
      </p>

      {portfolio.positions.map((p, i) => {

        const currentPrice =
          prices[p.symbol] || 0;

        const pnl =
          p.avg_price
            ? (
                (currentPrice - p.avg_price)
                * p.quantity
              )
            : 0;

        const pnlPercent =
          p.avg_price
            ? (
                (
                  (currentPrice - p.avg_price)
                  / p.avg_price
                ) * 100
              )
            : 0;

        const value =
          currentPrice * p.quantity;

        return (

          <div
            key={i}
            style={{
              padding: "12px 0",
              fontSize: "12px",
              color: "#8b949e",
              lineHeight: "1.8",
              borderTop: "1px solid #21262d"
            }}
          >

            <strong
              style={{
                color: "#c9d1d9",
                fontSize: "13px"
              }}
            >
              {p.symbol}
            </strong>

            <div>
              Qty: {p.quantity}
            </div>

            <div>
              Avg Price:
              {" "}
              ${Number(p.avg_price).toFixed(2)}
            </div>

            <div>
              Current Price:
              {" "}
              ${currentPrice.toFixed(2)}
            </div>

            <div>
              Position Value:
              {" "}
              ${value.toFixed(2)}
            </div>

            <div>
              PnL:
              {" "}
              <span
                style={{
                  color:
                    pnl >= 0
                      ? "#4cd137"
                      : "#ff6b6b",
                  fontWeight: "bold"
                }}
              >
                ${pnl.toFixed(2)}
                {" "}
                ({pnlPercent.toFixed(2)}%)
              </span>
            </div>

          </div>
        );
      })}
    </div>
  );
}