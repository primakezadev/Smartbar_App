const express = require('express');
const router = express.Router();
const reportController = require('../controllers/inventoryController');
const dailyInventoryController = require('../controllers/dailyInventoryController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleAuth');

// ── Standard Inventory / Revenue Routes ──────────────────────────────────────
router.get('/inventory-report', reportController.getInventoryReport);
router.get('/daily', reportController.getDailyRevenue);
router.post('/update-stock', reportController.updateClosingStock);

// ✅ Secure Daily Food/Drinks reconciliation report (opening, purchase, sales, closing)
router.get('/daily-inventory', authenticate, authorize(['manager', 'admin']), dailyInventoryController.getDailyReport);

// ✅ Secure Inline field modification saves
router.post('/daily-inventory/update', authenticate, authorize(['manager', 'admin']), dailyInventoryController.updateDailyInventory);

module.exports = router;