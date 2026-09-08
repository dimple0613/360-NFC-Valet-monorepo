/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

module.exports = { pool };
