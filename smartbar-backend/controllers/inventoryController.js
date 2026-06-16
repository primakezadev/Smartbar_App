const pool = require('../config/db');

module.exports = {
  // ── 1. GET ALL PRODUCTS ────────────────────────────────────────────────────
  getProducts: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
      res.status(200).json({ success: true, products: result.rows });
    } catch (e) {
      console.error("Fetch products error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 2. CREATE A BRAND NEW PRODUCT ──────────────────────────────────────────
  createProduct: async (req, res) => {
    const { name, price, category } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    if (!name || !price || !category) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name, price, and category are mandatory." 
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO products (name, price, category, image)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, parseFloat(price) || 0, category, imagePath]
      );

      res.status(201).json({ 
        success: true, 
        message: "Product created successfully!", 
        product: result.rows[0] 
      });
    } catch (e) {
      console.error("Product insertion failed database constraints:", e.message);
      res.status(500).json({ 
        success: false, 
        message: "Could not complete product insertion.", 
        error: e.message 
      });
    }
  },

  // ── 3. DELETE PRODUCT FROM SYSTEM ──────────────────────────────────────────
  deleteProduct: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Product record not found." });
      }

      res.status(200).json({ success: true, message: "Product successfully deleted." });
    } catch (e) {
      console.error("Delete product error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 4. 7-DAY ROLLING REVENUE GENERATOR (FIXED DASHBOARD TRENDS) ────────────
  getDailyRevenue: async (req, res) => {
    try {
      const query = `
        SELECT DATE(created_at) AS date, SUM(total_price) AS revenue
        FROM orders 
        WHERE status = 'ready' 
          AND created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC;
      `;
      const result = await pool.query(query);

      // Maps out back-filled dates so chart never drops or breaks on 0-sales days
      const revenueData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const found = result.rows.find(row => {
          const rowDateStr = new Date(row.date).toISOString().split('T')[0];
          return rowDateStr === dateStr;
        });
        return { revenue: found ? parseFloat(found.revenue) : 0 };
      });

      res.json({ success: true, data: revenueData });
    } catch (err) {
      console.error("Revenue trend compilation error:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ── 5. STANDARDIZED CENTRAL RECONCILIATION SUMMARY ────────────────────────
  getInventoryReport: async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM public.v_manager_reconciliation ORDER BY item_name ASC');
      res.status(200).json({ success: true, report: result.rows });
    } catch (e) {
      console.error("Inventory report fetch error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // ── 6. UPDATE DAILY CLOSING STOCK RECORD ───────────────────────────────────
  updateClosingStock: async (req, res) => {
    const { name, record_date, closing_stock } = req.body;
    const targetDate = record_date || new Date().toISOString().slice(0, 10);
    
    try {
      await pool.query(`
        INSERT INTO daily_inventory (item_name, record_date, closing_stock)
        VALUES ($1, $2, $3)
        ON CONFLICT (item_name, record_date)
        DO UPDATE SET closing_stock = EXCLUDED.closing_stock
      `, [name, targetDate, closing_stock]);
      
      res.status(200).json({ success: true, message: "Closing stock updated successfully." });
    } catch (e) {
      console.error("Closing stock modification execution error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  }
};