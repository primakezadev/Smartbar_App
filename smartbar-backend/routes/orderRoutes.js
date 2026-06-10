const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleAuth');

router.get('/client/status/:id', OrderController.getClientStatus);
router.post("/checkout", authenticate, authorize(['client', 'waiter', 'manager', 'admin']), OrderController.placeUnifiedOrder);
router.patch('/:id/confirm-receipt', authenticate, OrderController.confirmClientReceipt);

// ✅ FIXED: No authorize() on kitchen and bar — any authenticated staff can access
router.get('/dashboard/kitchen', authenticate, OrderController.getKitchenDashboard);
router.get('/dashboard/bar', authenticate, OrderController.getBarDashboard);
router.get('/dashboard/waiter', authenticate, authorize(['waiter', 'manager', 'admin']), OrderController.getWaiterDashboard);
router.get('/active', authenticate, authorize(['waiter', 'manager', 'admin']), OrderController.getActiveOrders);

// ✅ Added 'counter' and 'kitchen' to status update so they can mark ready
router.patch('/:id/status', authenticate, authorize(['waiter', 'manager', 'admin', 'counter', 'kitchen']), OrderController.updateStatus);

module.exports = router;