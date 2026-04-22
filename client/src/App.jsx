import { useState,useEffect} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import Chart from "./Chart";

function App() {
  // const [price, setPrice] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [candles, setCandles] = useState({});

  const [selectedSymbol, setSelectedSymbol] = useState("BINANCE:BTCUSDT"); //default

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onopen = () => {
      console.log("✅ WS OPEN");
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg= JSON.parse(event.data);

        if (msg.type === "history") {

          const grouped = {}; // FIX- grouping by symbol for easier chart updates
          // 🔥 FIX: ignore empty history
          if (!msg.data || msg.data.length === 0) {
            console.warn("⚠️ Empty history received");
            return;
          }
          msg.data.forEach(c => {
            const formatted = {
              symbol: c.symbol,
              time: Number(c.time), // ✅ FIX
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close)
            };

            if (!grouped[c.symbol]) grouped[c.symbol] = [];
            grouped[c.symbol].push(formatted);
          });

          // ✅ enforce strict order + dedupe
          Object.keys(grouped).forEach(symbol => {
            grouped[symbol] = grouped[symbol]
              .filter((v, i, arr) =>
                i === arr.findIndex(x => x.time === v.time)
              )
              .sort((a, b) => a.time - b.time);
          });

          setCandles(grouped);
          return;
        }

      // LIVE UPDATES
      if (msg.type === "candle") {
        const newCandle = {
          ...msg.data,
          time: Number(msg.data.time)
        };

        setCandles((prev) => {
          const arr = prev[newCandle.symbol] || [];

          // 🔥 safety: ignore bad data
          if (!newCandle.time) return prev;

          if (arr.length === 0) {
            return { ...prev, [newCandle.symbol]: [newCandle] };
          }

          const last = arr[arr.length - 1];

          // ❌ ignore older candles (MAIN FIX)
            if (newCandle.time < last.time) {
              return prev;
            }


          // same candle update
          if (last.time === newCandle.time) {
            const updated = [...arr];
            updated[updated.length - 1] = newCandle;
            return { ...prev, [newCandle.symbol]: updated };
          }

          // new candle append
          const updated = [...arr, newCandle];

          // 🔥 FIX: enforce ascending  - already done in backend but still bcz api might send irregularly
          updated.sort((a, b) => a.time - b.time);

          return {
            ...prev,
            [newCandle.symbol]: updated
          };
        });
      }

      } catch {
        console.error("Invalid data received");
      }
    };

    ws.onerror = (e) => {
      console.log("ERROR",e);
      setStatus("error");
    };

    ws.onclose = () => {
      console.log("disconnect hogya");
      setStatus("disconnected");
    };

    return () => ws.close();
  }, []);



  const filteredCandles = candles[selectedSymbol] || []; // 🔥 FIX -by ai
  return (
    <div>
      <h1>Live Price</h1>
      <p>Status: {status}</p>

      <div>
        <button onClick={() => setSelectedSymbol("BINANCE:BTCUSDT")}>bitcoin</button>
        <button onClick={() => setSelectedSymbol("BINANCE:ETHUSDT")}>etherium</button>
        <button onClick={() => setSelectedSymbol("BINANCE:SOLUSDT")}>solana</button>
        <button onClick={() => setSelectedSymbol("BINANCE:DOGEUSDT")}>doge</button>
      </div>

      {filteredCandles.length > 0 ? (
        <Chart candles={filteredCandles} />
      ) : (
        <p>Loading chart...</p>
      )}
    </div>
  );
}


export default App
