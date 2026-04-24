import { useState, useEffect } from "react";
import Chart from "./Chart";
import OrderBook from "./components/OrderBook";
import OrderForm from "./components/OrderForm";
import Portfolio from "./components/Portfolio";
import TradeFeed from "./components/TradeFeed";

const SYMBOLS = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:DOGEUSDT"
];

function App() {
  const [ws, setWs] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [candles, setCandles] = useState({});
  const [portfolio, setPortfolio] = useState({ balance: 0, positions: [] });
  const [trades, setTrades] = useState([]);
  const [orderbook, setOrderbook] = useState({ buys: [], sells: [] });
  const [lastPrice, setLastPrice] = useState(null);

  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS[0]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => setStatus("connected");

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "history") {
          const rows = msg.data;
          setCandles(prev => {
            const newState = { ...prev };
            rows.forEach(c => {
              const arr = newState[c.symbol] || [];
              newState[c.symbol] = [...arr, { ...c, time: Number(c.time) }];
            });
            return newState;
          });
        }

        if (msg.type === "candle") {
          const c = msg.data;

          setCandles(prev => {
            const arr = prev[c.symbol] || [];
            const last = arr[arr.length - 1];
            const candleTime = Number(c.time);

            if (last && last.time === candleTime) {
              // update existing candle
              const newArr = [...arr];
              newArr[newArr.length - 1] = { ...c, time: candleTime };
              return { ...prev, [c.symbol]: newArr };
            }

            return {
              ...prev,
              [c.symbol]: [...arr, { ...c, time: candleTime }]
            };
          });
        }

        if (msg.type === "portfolio") {
          const rows = msg.data;
          const balance = rows[0]?.usd || 0;

          const positions = rows
            .filter(r => r.symbol)
            .map(r => ({
              symbol: r.symbol,
              quantity: Number(r.quantity),
              avg_price: Number(r.avg_price)
            }));

          setPortfolio({ balance, positions });
        }

        if (msg.type === "trade") {
          setTrades(prev => [msg.data, ...prev.slice(0, 20)]);
        }

        if (msg.type === "orderbook") {
          setOrderbook({
            buys: msg.data.buys || [],
            sells: msg.data.sells || []
          });
        }

        if (msg.type === "candle") {
          setLastPrice(msg.data.close);
        }

      } catch {}
    };

    socket.onerror = () => setStatus("error");
    socket.onclose = () => setStatus("disconnected");

    setWs(socket);

    return () => socket.close();
  }, []);

  return (
    <div className="container">
      <h1>Trading Simulator</h1>
      <p>Status: {status}</p>

      <div>
        {SYMBOLS.map(sym => (
          <button key={sym} onClick={() => setSelectedSymbol(sym)}>
            {sym.split(":")[1].replace("USDT", "")}
          </button>
        ))}
      </div>

      <div className="grid">
        <div className="card">
          <Chart candles={candles[selectedSymbol] || []} />
        </div>

        <div className="card">
          <OrderBook orderbook={orderbook} />
        </div>

        <div className="card">
          <OrderForm selectedSymbol={selectedSymbol} ws={ws} lastPrice={lastPrice} />
        </div>

        <div className="card">
          <TradeFeed trades={trades} />
        </div>

        <div className="card" style={{ gridColumn: "1 / span 2" }}>
          <Portfolio portfolio={portfolio} />
        </div>
      </div>
    </div>
  );
}

export default App;