export const symbols = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:DOGEUSDT"
];

export const lastSentCandle = new Map();
export const lastSaved = new Map();
export const THROTTLE_MS = 500;

export const backfillStore = new Map();

export let isBackfillDone = false;

export function setBackfillDone(val) {
  isBackfillDone = val;
}