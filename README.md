# Trading_simulator


# Real-Time Algorithmic Trading Simulator

A full-stack trading simulator that streams live market data, builds candlestick charts, and executes user orders with concurrency-safe matching.

## 🚀 Features

- Real-time price streaming via WebSockets
- Binance market data integration
- OHLC candle generation (1-minute)
- Historical backfill (6 days)
- Lazy loading chart history
- Order system (Market & Limit)
- Matching engine with row-level locking
- Basic portfolio balance system

## 🧠 Tech Stack

- Node.js + Express
- WebSocket (ws)
- PostgreSQL + TimescaleDB
- React + Lightweight Charts

## ⚡ System Design Highlights

- Handles real-time streaming with throttling
- Prevents race conditions using `SELECT ... FOR UPDATE`
- Efficient time-series queries using `time_bucket`
- Backfill system for cold start problem

## 🛠️ Setup

```bash
git clone <repo>
cd backend
npm install
