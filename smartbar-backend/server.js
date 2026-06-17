require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./config/db');

const app = express();
const server = http.createServer(app);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

app.set('io', io);

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= SOCKET HANDLER =================
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // register user session (VERY IMPORTANT)
  socket.on('register_session', ({ userId, role }) => {
    socket.userId = userId;
    socket.role = role;

    // join role rooms
    socket.join(`user_${userId}`);

    if (role === 'manager') socket.join('managers_room');
    if (role === 'waiter') socket.join('waiters_room');
    if (role === 'customer') socket.join('customers_room');

    console.log(`👤 Registered: ${userId} as ${role}`);
  });

  // ================= CHAT MESSAGE =================
  socket.on('send_message', (data) => {
    console.log("📩 Message received:", data);

    const messagePayload = {
      senderId: data.senderId,
      senderRole: data.senderRole,
      message: data.message,
      time: new Date().toISOString()
    };

    // send ONLY to managers
    io.to('managers_room').emit('new_message', messagePayload);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// ================= ROUTES =================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// ================= DB =================
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB error:', err.stack);
    return;
  }
  console.log('✨ Connected to PostgreSQL');
  release();
});

// ================= START SERVER =================
const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});