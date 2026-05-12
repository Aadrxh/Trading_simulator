import { pool } from "../db.js";

export async function sendPortfolioUpdate(wss, userId) {
  try {
    const result = await pool.query(`
      SELECT
        b.usd,
        p.symbol,
        p.quantity,
        p.avg_price
      FROM balances b
      LEFT JOIN positions p
        ON b.user_id = p.user_id
      WHERE b.user_id = $1
    `, [userId]);

    const balance = Number(result.rows[0]?.usd || 0);

    const positions = result.rows
      .filter(r => Number(r.quantity) > 0)
      .map(r => ({
        symbol: r.symbol,
        quantity: Number(r.quantity),
        avg_price: Number(r.avg_price)
      }));

    const payload = JSON.stringify({
      type: "portfolio",
      user_id: userId,
      data: {
        balance,
        positions
      }
    });

    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(payload);
      }
    });

  } catch (err) {
    console.error("Portfolio WS update failed:", err);
  }
}