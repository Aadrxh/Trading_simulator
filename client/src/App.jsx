import { useState, useEffect } from "react";
import { useRef } from "react";
import Chart from "./Chart";
import OrderBook from "./components/OrderBook";
import OrderForm from "./components/OrderForm";
import Portfolio from "./components/Portfolio";
import TradeFeed from "./components/TradeFeed";
import Auth from "./Auth";

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

  const selectedSymbolRef = useRef(selectedSymbol);

  const [isAuth, setIsAuth] = useState(
    !!localStorage.getItem("token")
  );

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol; //for the ref
  }, [selectedSymbol]);

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
  };

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

        // 🔥 FIXED PORTFOLIO HANDLING
        if (msg.type === "portfolio") {
          try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const payload = JSON.parse(atob(token.split(".")[1]));
            const myUserId = payload.user_id;

            // 🔥 ignore other users
            if (msg.user_id !== myUserId) return;

            setPortfolio({
              balance: Number(msg.data.balance || 0),
              positions: msg.data.positions || []
            });

          } catch (e) {
            console.error("Portfolio parse error:", e);
          }
        }

        if (msg.type === "trade") {
          setTrades(prev => [msg.data, ...prev.slice(0, 20)]);
        }

        if (msg.type === "orderbook") {
          if (msg.data.symbol !== selectedSymbolRef.current) return;

          console.log("FRONTEND GOT:", {
            seq: msg.seq,
            buys: msg.data.buys?.length,
            sells: msg.data.sells?.length
          });

          setOrderbook(prev => {
            // 🔥 ignore stale updates
            if (prev.seq && prev.seq > msg.seq) {
              console.log("IGNORED STALE:", msg.seq, "<", prev.seq);
              return prev;
            }

            const nextState = {
              seq: msg.seq,
              buys: [...(msg.data.buys || [])],
              sells: [...(msg.data.sells || [])]
            };

            console.log("APPLIED ORDERBOOK:", {
              seq: msg.seq,
              buys: nextState.buys.length,
              sells: nextState.sells.length
            });

            return nextState;
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

  if (!isAuth) {
    return <Auth onLogin={() => setIsAuth(true)} />;
  }

  return (
    <div className="container">
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ marginBottom: "20px" }}>Trading Simulator</h2>
        <button onClick={logout}>Logout</button>
        <p style={{ color: "#8b949e", margin: 0 }}>
          Status: {status}
        </p>

        <div style={{ marginTop: "15px" }}>
          {SYMBOLS.map(sym => (
            <button key={sym} onClick={() => setSelectedSymbol(sym)}>
              {sym.split(":")[1].replace("USDT", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <Chart candles={candles[selectedSymbol] || []} />
        </div>

        <div className="card">
          <OrderBook orderbook={orderbook} />
        </div>

        <div className="card">
          <OrderForm selectedSymbol={selectedSymbol} lastPrice={lastPrice} />
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