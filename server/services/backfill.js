import { symbols, backfillStore, setBackfillDone } from "../state/store.js";

export async function cleanupOldData(pool) {
  try {
    await pool.query(`
      DELETE FROM ticks
      WHERE time < NOW() - INTERVAL '6 days'
    `);
    console.log("🧹 Cleanup done");
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
}

export async function backfill() {
  try {
    const now = Date.now();
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;

    for (const symbol of symbols) {
      console.log("Backfilling:", symbol);

      const clean = symbol.split(":")[1];
      let startTime = sixDaysAgo;

      const candles = [];

      while (startTime < now) {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${clean}&interval=1m&startTime=${startTime}&limit=1000`
        );

        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) break;

        for (let i = 0; i < data.length; i++) {
          const c = data[i];

          candles.push({
            symbol,
            time: Math.floor(c[0] / 1000),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
          });
        }

        const lastCandleTime = data[data.length - 1][0];

        if (lastCandleTime === startTime) break;

        startTime = lastCandleTime + 60000;

        if (candles.length === 0) {
          console.log("❌ Backfill failed for:", symbol);
          continue;
        }

        console.log(
          symbol,
          "Fetched:",
          new Date(data[0][0]),
          "→",
          new Date(lastCandleTime)
        );
      }

      backfillStore.set(symbol, candles);
    }

    console.log("✅ Backfill complete");
    setBackfillDone(true);

  } catch (err) {
    console.error("Backfill error:", err.message);
  }
}