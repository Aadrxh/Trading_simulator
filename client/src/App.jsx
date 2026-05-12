// client/src/App.jsx

import { useState, useEffect, useRef } from "react";

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

  const [portfolio, setPortfolio] = useState({
    balance: 0,
    positions: []
  });

  const [trades, setTrades] = useState([]);

  const [orderbook, setOrderbook] = useState({
    buys: [],
    sells: []
  });

  const [lastPrice, setLastPrice] = useState(null);
  const [prices,setPrices]=useState({});

  const [selectedSymbol, setSelectedSymbol] =
    useState(SYMBOLS[0]);

  const selectedSymbolRef = useRef(selectedSymbol);

  const [isAuth, setIsAuth] = useState(
    !!localStorage.getItem("token")
  );

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
  };

  useEffect(() => {

    const token = localStorage.getItem("token");

    const socket = new WebSocket(
      `ws://localhost:3000?token=${token}`
    );

    socket.onopen = () => {
      setStatus("connected");
    };

    socket.onmessage = (event) => {

      try {

        const msg = JSON.parse(event.data);

        // 🔥 HISTORY
        if (msg.type === "history") {

          const rows = msg.data;

          setCandles(prev => {

            const newState = { ...prev };

            rows.forEach(c => {

              const arr = newState[c.symbol] || [];

              newState[c.symbol] = [
                ...arr,
                {
                  ...c,
                  time: Number(c.time)
                }
              ];
            });

            return newState;
          });
        }

        // 🔥 LIVE CANDLE
        if (msg.type === "candle") {

          const c = msg.data;

          setCandles(prev => {

            const arr = prev[c.symbol] || [];

            const last = arr[arr.length - 1];

            const candleTime = Number(c.time);

            if (last && last.time === candleTime) {

              const updated = [...arr];

              updated[updated.length - 1] = {
                ...c,
                time: candleTime
              };

              return {
                ...prev,
                [c.symbol]: updated
              };
            }

            return {
              ...prev,
              [c.symbol]: [
                ...arr,
                {
                  ...c,
                  time: candleTime
                }
              ]
            };
          });

          setLastPrice(c.close);

          setPrices(prev => ({
            ...prev,
            [c.symbol]: Number(c.close)
          }));
        }

        // 🔥 PORTFOLIO
        if (msg.type === "portfolio") {

          const token = localStorage.getItem("token");

          if (!token) return;

          const payload = JSON.parse(
            atob(token.split(".")[1])
          );

          const myUserId = payload.user_id;

          if (msg.user_id !== myUserId) {
            return;
          }

          setPortfolio({
            balance: Number(msg.data.balance || 0),
            positions: msg.data.positions || []
          });
        }

        // 🔥 TRADE HISTORY
        if (msg.type === "tradeHistory") {

          const token = localStorage.getItem("token");

          if (!token) return;

          const payload = JSON.parse(
            atob(token.split(".")[1])
          );

          const myUserId = payload.user_id;

          const filtered =
            (msg.data || []).filter(t =>
              t.buyer_id === myUserId ||
              t.seller_id === myUserId
            );

          filtered.sort(
            (a, b) =>
              new Date(b.created_at) -
              new Date(a.created_at)
          );

          setTrades(filtered.slice(0, 30));
        }

        // 🔥 LIVE TRADE
        if (msg.type === "trade") {

          const token = localStorage.getItem("token");

          if (!token) return;

          const payload = JSON.parse(
            atob(token.split(".")[1])
          );

          const myUserId = payload.user_id;

          if (
            msg.data.buyer_id !== myUserId &&
            msg.data.seller_id !== myUserId
          ) {
            return;
          }

          setTrades(prev => {

            const exists = prev.some(
              t => t.id === msg.data.id
            );

            if (exists) return prev;

            return [
              msg.data,
              ...prev
            ].slice(0, 30);
          });
        }

        // 🔥 ORDERBOOK
        if (msg.type === "orderbook") {

          if (
            msg.data.symbol !==
            selectedSymbolRef.current
          ) {
            return;
          }

          setOrderbook({
            buys: [...(msg.data.buys || [])],
            sells: [...(msg.data.sells || [])]
          });
        }

      } catch (err) {
        console.log(err);
      }
    };

    socket.onerror = () => {
      setStatus("error");
    };

    socket.onclose = () => {
      setStatus("disconnected");
    };

    setWs(socket);

    return () => socket.close();

  }, []);

  if (!isAuth) {
    return (
      <Auth onLogin={() => setIsAuth(true)} />
    );
  }

  return (
    <div className="container">

      <div
        style={{
          textAlign: "center",
          marginBottom: "20px"
        }}
      >

        <h2 style={{ marginBottom: "20px" }}>
          Trading Simulator
        </h2>

        <button onClick={logout}>
          Logout
        </button>

        <p
          style={{
            color: "#8b949e",
            margin: 0
          }}
        >
          Status: {status}
        </p>

        <div style={{ marginTop: "15px" }}>

          {SYMBOLS.map(sym => (

            <button
              key={sym}
              onClick={() =>
                setSelectedSymbol(sym)
              }
            >
              {sym
                .split(":")[1]
                .replace("USDT", "")}
            </button>

          ))}

        </div>
      </div>

      <div className="grid">

        {/* LEFT */}
        <div className="left-column">

          <div className="card">
            <Chart
              candles={
                candles[selectedSymbol] || []
              }
            />
          </div>

          <div className="card">
            <OrderForm
              selectedSymbol={selectedSymbol}
              lastPrice={lastPrice}
            />
          </div>

          <div className="card">
            <Portfolio
              portfolio={portfolio}
              prices={prices}
            />
          </div>

        </div>

        {/* RIGHT */}
        <div className="right-column">

          <div className="card">
            <OrderBook
              orderbook={orderbook}
            />
          </div>

          <TradeFeed trades={trades} />

        </div>

      </div>
    </div>
  );
}

export default App;