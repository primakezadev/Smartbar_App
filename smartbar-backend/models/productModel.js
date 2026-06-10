const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Map clean RESTful paths onto the controller functions
router.post('/', productController.createProduct);      // POST /api/products
router.get('/', productController.getAllProducts);       // GET /api/products
router.put('/:id', productController.updateProduct);    // PUT /api/products/:id
router.delete('/:id', productController.deleteProduct); // DELETE /api/products/:id

module.exports = router;