  import { useEffect, useRef } from "react";
  import { createChart, CandlestickSeries } from "lightweight-charts";

  function Chart({ candles }) {
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const initializedRef = useRef(false);
    const chartInstanceRef = useRef(null);
    const prevSymbolRef = useRef(null);
    const lastTimeRef = useRef(null);

    const loadingRef = useRef(false);
    const earliestTimeRef = useRef(null); 
    const dataRef = useRef([]);

    function isValid(data) {
      for (let i = 1; i < data.length; i++) {
        if (data[i].time <= data[i - 1].time) {
          return false;
        }
      }
      return true;
    }
    
    const normalize = (arr) => {
      return arr.map(c => ({
        time: Math.floor(Number(c.time)), // ✅ FORCE NUMBER
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));
};


    function goToLive() {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().scrollToRealTime();
    }
    }
    // useEffect(() => {
    //   const chart = createChart(chartRef.current, {
    //     width: 800,
    //     height: 400,

    //     layout: {
    //       background: { color: "#111" },
    //       textColor: "#DDD",
    //     },

    //     grid: {
    //       vertLines: { color: "#222" },
    //       horzLines: { color: "#222" },
    //     },

    //     timeScale: {
    //       barSpacing: 12,
    //       timeVisible: true,
    //       secondsVisible: false,
    //     },
    //   });
    //   chartInstanceRef.current = chart;

    //   const series = chart.addSeries(CandlestickSeries, {
    //     upColor: "#26a69a",
    //     downColor: "#ef5350",
    //     borderUpColor: "#26a69a",
    //     borderDownColor: "#ef5350",
    //     wickUpColor: "#26a69a",
    //     wickDownColor: "#ef5350",
    //   });

    //   seriesRef.current = series;

    //   return () => chart.remove();
    // }, []);

    useEffect(() => {
      if (!candles.length) return;

      const currentSymbol = candles[0]?.symbol;

      // we are removing the current chart and recreating the chart at symbol change
      if (prevSymbolRef.current !== currentSymbol) {

        //remove old chart
        // FIX: cleanup lazy loader before removing chart -- by ai
      if (chartInstanceRef.current) {
        const oldChart = chartInstanceRef.current;

        if (oldChart._lazyHandler) { // ✅ ADDED
          oldChart.timeScale().unsubscribeVisibleLogicalRangeChange(oldChart._lazyHandler);
        }

        oldChart.remove();
      }

        const chart = createChart(chartRef.current, {
          width: 800,
          height: 400,

          layout: {
            background: { color: "#111" },
            textColor: "#DDD",
          },

          grid: {
            vertLines: { color: "#222" },
            horzLines: { color: "#222" },
          },

          timeScale: {
            barSpacing: 12,
            timeVisible: true,
            secondsVisible: false,
          },
        });

        chartInstanceRef.current = chart;

        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderUpColor: "#26a69a",
          borderDownColor: "#ef5350",
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });

        seriesRef.current = series;

        if (!isValid(candles)) {
          console.warn("Invalid candle order");
          return;
        }
        series.setData(normalize(candles));
        
        dataRef.current = normalize(candles); // ✅ ADDED
        // 🔥 NEW: set initial earliest time
        earliestTimeRef.current = candles[0].time; // ✅ ADDED


        //to latest
        chart.timeScale().scrollToRealTime();
        attachLazyLoader();


        prevSymbolRef.current = currentSymbol;
        lastTimeRef.current = candles[candles.length - 1].time;

        return;
      }

      const last = candles[candles.length - 1];

      if (lastTimeRef.current && last.time < lastTimeRef.current) {
        return;
      }

      lastTimeRef.current = last.time;

      if (seriesRef.current) {
        seriesRef.current.update(last);
      }

      // 🔥 KEEP DATA CONSISTENT
      const lastStored = dataRef.current[dataRef.current.length - 1];
      if (!lastStored || lastStored.time !== last.time) {
        dataRef.current.push({
          time: Math.floor(Number(last.time)),
          open: Number(last.open),
          high: Number(last.high),
          low: Number(last.low),
          close: Number(last.close),
        }   );
      }
      //CLEANUP
      return () => {
        // nothing here , handled on next symbol change -- by ai
      };

    }, [candles]);


    function attachLazyLoader() {
      const chart = chartInstanceRef.current;
      if (!chart || !seriesRef.current) return;

      const timeScale = chart.timeScale();

      const handler = async (range) => {
        console.log("SCROLL EVENT", range);
        if (!range || !seriesRef.current) return;

        const barsInfo = seriesRef.current.barsInLogicalRange(range);

        if (barsInfo && barsInfo.barsBefore < 20 && !loadingRef.current) {
          loadingRef.current = true;

          try {
            const firstTime = earliestTimeRef.current; // ✅ FIXED
            if (!firstTime) return;


            console.log("🔥 LOADING MORE...");

            const res = await fetch(
              `http://localhost:3000/history?symbol=${candles[0].symbol}&before=${firstTime}` // ✅ FIXED
            );

            const older = await res.json();

            console.log("OLDER:", older.length);

            if (!older.length) return;

            // 🔥 REAL FIX
            const merged = [...older, ...dataRef.current]; // ✅ FIXED
            dataRef.current = merged; // ✅ ADDED

            earliestTimeRef.current = older[0].time;

            seriesRef.current.setData(normalize(merged));

          } catch (err) {
            console.error("Lazy load error:", err);
          }

          loadingRef.current = false;
        }
      };

      timeScale.subscribeVisibleLogicalRangeChange(handler);

      // 🔥 store unsubscribe so we can clean later
      chart._lazyHandler = handler;
    }

    return <div>
    <button onClick={goToLive}>Go Live</button>
    <div ref={chartRef} />
  </div>;
  }

  export default Chart;