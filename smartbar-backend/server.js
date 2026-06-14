require('dotenv').config();
const express = require('express');
const http = require('http'); // 🚀 1. Required for creating the combined HTTP server
const { Server } = require('socket.io'); // 🚀 2. Import Socket.io
const cors = require('cors');
const pool = require('./config/db'); 

const app = express();

// 🚀 3. Create HTTP Server instance wrapping Express
const server = http.createServer(app);

// 🚀 4. Initialize Socket.io on top of our HTTP server instance
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true
  }
});

// 🚀 5. Attach the global io instance to the express app context
// This makes it instantly available inside your orderController via req.app.get('io')
app.set('io', io);

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
app.use('/api/reports', reportRoutes);

// 🚀 6. Handle socket connection tunnels and room memberships
io.on('connection', (socket) => {
  console.log(`🔌 New WebSocket Connection established: ${socket.id}`);

  // Dynamic user profile registration handler
  socket.on('register_session', ({ userId, role }) => {
    socket.userId = userId;
    socket.role = role;
    
    // Join standard shared staff broadcast rooms
    if (role === 'waiter') socket.join('waiters_room');
    if (role === 'kitchen') socket.join('kitchen_room');
    if (role === 'counter') socket.join('counter_room');
    if (role === 'manager') socket.join('managers_room');
    
    // Create an exclusive, isolated private room for this user ID
    // (This allows targeting individual clients/waiters securely)
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} auto-joined secure room: user_${userId} as [${role}]`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Connection dropped for socket ID: ${socket.id}`);
  });
});

// Database Handshake
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Database initialization connection failed:', err.stack);
  }
  console.log('✨ Successfully connected to Neon PostgreSQL Database!');
  release();
});

const PORT = 5000;
// 🚀 7. Crucial Change: Listen through the HTTP wrapper server instead of the raw app object
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Smartbar backend online with real-time sockets on port ${PORT}`);
});