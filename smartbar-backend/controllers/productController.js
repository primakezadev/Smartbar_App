const pool = require('../config/db'); // Adjust this path to match your DB pool setup

const productController = {
  
  
    // 1. CREATE: Add a new product to stock
 createProduct: async (req, res) => {
  try {
    const { name, price, category } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ success: false, message: "Name, price, and category are required fields." });
    }

    // ⚡ If a file was uploaded by multer, save its path link. Otherwise, default to blank.
    const finalImage = req.file ? `/uploads/${req.file.filename}` : "";

    const query = `
      INSERT INTO products (name, price, category, image)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [name, Number(price), category, finalImage]);
    
    res.status(201).json({ success: true, message: "Product created with file upload successfully!", product: result.rows[0] });
  } catch (error) {
    console.error("Error creating product with file upload:", error.message);
    res.status(500).json({ success: false, error: "Server error during creation." });
  }
},
 

// 2. READ: Get all products for the client menu or manager list
  getAllProducts: async (req, res) => {
    try {
      const query = 'SELECT * FROM products ORDER BY id ASC;';
      const result = await pool.query(query);
      res.status(200).json({ success: true, products: result.rows });
    } catch (error) {
      console.error("Error fetching products:", error.message);
      res.status(500).json({ success: false, error: "Server error fetching stock numbers." });
    }
  },

 
  // 3. UPDATE: Modify an existing product's fields or image mapping
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, price, category, image } = req.body;

      // Check if product exists first
      const checkQuery = 'SELECT * FROM products WHERE id = $1;';
      const checkResult = await pool.query(checkQuery, [id]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      const currentProduct = checkResult.rows[0];
      const finalName = name || currentProduct.name;
      const finalPrice = price !== undefined ? Number(price) : currentProduct.price;
      const finalCategory = category || currentProduct.category;
      const finalImage = image !== undefined ? image : currentProduct.image;

      const updateQuery = `
        UPDATE products 
        SET name = $1, price = $2, category = $3, image = $4
        WHERE id = $5
        RETURNING *;
      `;
      const result = await pool.query(updateQuery, [finalName, finalPrice, finalCategory, finalImage, id]);

      res.status(200).json({ success: true, message: "Product updated smoothly!", product: result.rows[0] });
    } catch (error) {
      console.error("Error updating product:", error.message);
      res.status(500).json({ success: false, error: "Server error during update sequence." });
    }
  },

  
  // 4. DELETE: Remove an outdated product out of the database entirely
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const query = 'DELETE FROM products WHERE id = $1 RETURNING *;';
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Product not found inside stock catalog." });
      }

      res.status(200).json({ success: true, message: "Product dropped cleanly from active stock." });
    } catch (error) {
      console.error("Error deleting product:", error.message);
      res.status(500).json({ success: false, error: "Server error during product deletion." });
    }
  }
};

module.exports = productController;