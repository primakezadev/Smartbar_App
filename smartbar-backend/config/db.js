const { Pool } = require('pg');
require('dotenv').config();

//  NEON STANDARD: Try to use a unified connection string first, fallback to manual string if needed
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?sslmode=require`;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for serverless hosting handshakes
  },
  max: 10,                   // Limits concurrent socket saturation
  idleTimeoutMillis: 30000,  // Prevents loose client leakage crashes
connectionTimeoutMillis: 15000,
});

console.log("--- DB ENV CHECK ---");
console.log("DATABASE_URL variable exists:", !!process.env.DATABASE_URL);
console.log("DB_HOST reference exists:", !!process.env.DB_HOST);
console.log("--------------------");

//  MONITOR INTERNAL POOL FAILURES (Crucial for Neon Serverless)
pool.on('error', (err) => {
  console.error('✨ Idle Neon database pool lost a connection handle unexpected:', err.message);
});

// Test connection handle instantly on startup boot sequence
pool.connect()
  .then(client => {
    console.log("✨ Successfully connected to Neon PostgreSQL Database!");
    client.release(); // Return client straight to pool arrays!
  })
  .catch(err => {
    console.error("❌ Database initialization connection failed:", err.message);
  });

module.exports = pool;