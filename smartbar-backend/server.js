require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db'); 
const app = express(); // ⚡ MOVE THIS TO THE TOP

// Import Routes
const orderRoutes = require('./routes/orderRoutes'); 
const productRoutes = require('./routes/productRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('public/uploads'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);// ⚡ Only keep ONE copy here

// Database Handshake
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Database initialization connection failed:', err.stack);
  }
  console.log('✨ Successfully connected to Neon PostgreSQL Database!');
  release();
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Smartbar backend online on port ${PORT}`);
});