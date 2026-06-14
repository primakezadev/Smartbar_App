const express = require('express');
const router = express.Router();
const reportController = require('../controllers/inventoryController');
const dailyInventoryController = require('../controllers/dailyInventoryController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleAuth');

// This makes the full path /api/reports/inventory-report
router.get('/inventory-report', reportController.getInventoryReport);
router.get('/daily', reportController.getDailyRevenue);
router.post('/update-stock', reportController.updateClosingStock);

// ✅ NEW: Daily Food/Drinks reconciliation report (opening, purchase, sales, closing)
router.get('/daily-inventory', authenticate, authorize(['manager', 'admin']), dailyInventoryController.getDailyReport);
router.post('/daily-inventory/update', authenticate, authorize(['manager', 'admin']), dailyInventoryController.updateDailyInventory);

module.exports = router;