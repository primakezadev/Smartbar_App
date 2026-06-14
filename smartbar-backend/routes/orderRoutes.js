const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleAuth');

router.get('/client/status/:id', OrderController.getClientStatus);
router.post("/checkout", authenticate, authorize(['client', 'waiter', 'manager', 'admin']), OrderController.placeUnifiedOrder);
router.patch('/:id/confirm-receipt', authenticate, OrderController.confirmClientReceipt);

router.get('/dashboard/kitchen', authenticate, OrderController.getKitchenDashboard);
router.get('/dashboard/bar', authenticate, OrderController.getBarDashboard);

// ✅ FIX: Added missing counter dashboard route
router.get('/dashboard/counter', authenticate, authorize(['counter', 'manager', 'admin']), OrderController.getBarDashboard);

router.get('/dashboard/waiter', authenticate, authorize(['waiter', 'manager', 'admin']), OrderController.getWaiterDashboard);
router.get('/active', authenticate, authorize(['waiter', 'manager', 'admin']), OrderController.getActiveOrders);

// ✅ NEW: Sold-out items (Food / Drinks) for Manager dashboard
router.get('/dashboard/sold-items', authenticate, authorize(['manager', 'admin']), OrderController.getSoldItems);

router.patch('/:id/status', authenticate, authorize(['waiter', 'manager', 'admin', 'counter', 'kitchen']), OrderController.updateStatus);

module.exports = router;