# Trading Simulator

A full-stack real-time cryptocurrency trading simulator inspired by modern exchanges like Binance.

The project streams live market data, generates candlestick charts, maintains an orderbook, executes trades through a matching engine, and tracks user portfolios in real time.

---

# Features

## Market Data
- Real-time Binance market streaming
- WebSocket-based live updates
- 1-minute OHLC candle generation
- Historical backfill (6 days)
- Lazy-loaded chart history
- Real-time trade feed

## Trading Engine
- Market orders
- Limit orders
- In-memory orderbook
- Matching engine
- Trade execution system
- Portfolio balance tracking
- Position averaging

## Authentication
- JWT authentication
- bcrypt password hashing
- Protected routes
- User-specific trade visibility

## Infrastructure
- Dockerized architecture
- Docker Compose one-command startup
- TimescaleDB time-series storage
- Persistent PostgreSQL volumes

---

# Tech Stack

## Frontend
- React
- Vite
- Lightweight Charts
- WebSocket API

## Backend
- Node.js
- Express
- ws
- JWT
- bcryptjs

## Database
- PostgreSQL
- TimescaleDB

## Infrastructure
- Docker
- Docker Compose

---

# System Design Highlights

- Real-time WebSocket architecture
- Historical backfill before live streaming
- Concurrency-safe order matching
- Row-level locking using `SELECT ... FOR UPDATE`
- Time-series optimization using TimescaleDB hypertables
- In-memory orderbook for fast matching
- Streaming candle aggregation pipeline
- Persistent database volumes for containerized deployments

---

# Project Structure

```text
Trading_simulator/
├── client/
├── server/
├── docker-compose.yml
└── .env
```

---

# Setup

## 1. Clone Repository

```bash
git clone <repo>
cd Trading_simulator
```

## 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
POSTGRES_PASSWORD=yourpassword
JWT_SECRET=yourjwtsecret
DATABASE_URL=postgresql://postgres:yourpassword@timescaledb:5432/trading
```

## 3. Start Application

```bash
docker compose up --build
```

This automatically starts:
- frontend
- backend
- TimescaleDB

---

# Application URLs

Frontend:
```text
http://localhost:5173
```

Backend:
```text
http://localhost:3000
```

---

# Database

TimescaleDB is used for efficient storage of:
- ticks
- historical candles
- trades
- portfolio data

Database persistence is handled using Docker volumes.

---

# Security Measures

- bcrypt password hashing
- JWT authentication
- Helmet middleware
- CORS restrictions
- Parameterized SQL queries
- Containerized isolated runtime
- `.env` excluded from Git

---

---

# Key Learning Outcomes

- Real-time systems design
- Matching engine architecture
- WebSocket communication
- Concurrency handling
- Transactional database systems
- Docker orchestration
- Time-series database optimization

---
