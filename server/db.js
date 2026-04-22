import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "trading",
  password: "rasengan62549",
  port: 5433,
});