const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');
const path = require('path');

// 1. Configure where to save files on the computer server disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    // Generates a unique timestamp filename: e.g., image-1716123456.jpg
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 2. Insert the upload middleware directly into routes that accept a file
// 'imageFile' matches the form field name sent from the frontend
router.post('/', upload.single('imageFile'), productController.createProduct);
router.get('/', productController.getAllProducts);
router.put('/:id', upload.single('imageFile'), productController.updateProduct); // ⬅️ ADDED — this was completely missing
router.delete('/:id', productController.deleteProduct);

module.exports = router;