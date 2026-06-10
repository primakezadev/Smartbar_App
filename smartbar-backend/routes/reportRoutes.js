const express = require('express');
const router = express.Router();
const reportController = require('../controllers/inventoryController');

// This makes the full path /api/reports/inventory-report
router.get('/inventory-report', reportController.getInventoryReport);
router.get('/daily', reportController.getDailyRevenue);
router.post('/update-stock', reportController.updateClosingStock);

module.exports = router;