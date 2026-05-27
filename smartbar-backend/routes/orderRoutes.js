const express = require('express');
const router = express.Router(); 
const OrderController = require('../controllers/orderController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleAuth'); // Ensure you have this

// =========================================================================
// 1. PUBLIC / CLIENT ROUTES (Limited access)
// =========================================================================
router.get('/client/status/:id', OrderController.getClientStatus); 
router.post("/checkout", authenticate, authorize(['client', 'waiter', 'manager', 'admin']), OrderController.placeUnifiedOrder);
router.patch('/:id/confirm-receipt', authenticate, OrderController.confirmClientReceipt);

// =========================================================================
// 2. STAFF DASHBOARDS (Role-Protected)
// =========================================================================
// Only managers, kitchen, and admin can see the kitchen dashboard
router.get('/dashboard/kitchen', 
  authenticate, 
  authorize(['manager', 'kitchen', 'admin']), 
  OrderController.getKitchenDashboard
);

// Only managers, bar staff, and admin can see the bar dashboard
router.get('/dashboard/bar', 
  authenticate, 
  authorize(['manager', 'bar', 'admin']), 
  OrderController.getBarDashboard
);

// Waiters and managers can see active orders
router.get('/active', 
  authenticate, 
  authorize(['waiter', 'manager', 'admin']), 
  OrderController.getActiveOrders
);

router.get('/dashboard/waiter', 
  authenticate, 
  authorize(['waiter', 'manager', 'admin']), 
  OrderController.getActiveOrders
);

// =========================================================================
// 3. STAFF ACTIONS (Status Management)
// =========================================================================
// Protected status update for waiters and managers
router.patch('/:id/status', 
  authenticate, 
  authorize(['waiter', 'manager', 'admin']), 
  OrderController.updateStatus
);

module.exports = router;