const pool = require('../config/db');

const FOOD_CATEGORIES = ['Bites', 'Pork', 'Brochettes', 'Sides', 'Starters', 'kitchen'];
const getCategory = (productCategory) => FOOD_CATEGORIES.includes(productCategory) ? 'food' : 'drink';

// Fetches sales numbers from completed order items safely
const getSales = async (name, category, date) => {
  const type = category === 'food' ? 'kitchen' : 'drink';
  const r = await pool.query(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS total
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.name = $1 AND oi.type = $2 AND o.status = 'ready' AND o.created_at::date = $3
  `, [name, type, date]);
  return parseFloat(r.rows[0].total) || 0;
};

// Calculates previous day's closing stock to roll forward as today's opening stock
const getPreviousClosing = async (name, category, date) => {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const prevRow = await pool.query(
    'SELECT * FROM daily_inventory WHERE item_name = $1 AND category = $2 AND record_date = $3',
    [name, category, yStr]
  );

  if (prevRow.rows.length === 0) return 0;

  const prevSales = await getSales(name, category, yStr);
  const opening = parseFloat(prevRow.rows[0].opening_stock) || 0;
  const purchase = parseFloat(prevRow.rows[0].purchase_stock) || 0;
  return Math.max(0, opening + purchase - prevSales);
};

module.exports = {
  getDailyReport: async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    try {
      // 1. Get ALL real products currently active in your database
      const productsRes = await pool.query('SELECT id, name, price, category FROM products');
      const products = productsRes.rows;

      // 2. Loop through EVERY single real product to verify or seed its daily snapshot row
      for (const p of products) {
        const cat = getCategory(p.category);
        const sales = await getSales(p.name, cat, date);

        let row = await pool.query(
          'SELECT * FROM daily_inventory WHERE item_name = $1 AND category = $2 AND record_date = $3',
          [p.name, cat, date]
        );

        if (row.rows.length === 0) {
          // Product doesn't have a record for today yet -> Create a fresh row with 0 purchases
          const opening = await getPreviousClosing(p.name, cat, date);
          const unit_price = parseFloat(p.price) || 0;

          await pool.query(
            `INSERT INTO daily_inventory (item_name, category, record_date, unit_price, opening_stock, purchase_stock, sales)
             VALUES ($1, $2, $3, $4, $5, 0, $6)
             ON CONFLICT (item_name, category, record_date) 
             DO UPDATE SET sales = EXCLUDED.sales`,
            [p.name, cat, date, unit_price, opening, sales]
          );
        } else {
          // Row already exists -> Simply keep sales values dynamic and updated
          await pool.query(
            `UPDATE daily_inventory SET sales = $1 
             WHERE item_name = $2 AND category = $3 AND record_date = $4`,
            [sales, p.name, cat, date]
          );
        }
      }

      // 3. Now query our database view (This pulls EVERY row we just guaranteed above)
      const viewResult = await pool.query(
        `SELECT * FROM public.v_manager_reconciliation 
         WHERE record_date = $1 
         ORDER BY item_name ASC`,
        [date]
      );

      // 4. Map database response fields cleanly to the frontend matching key structure
      const formattedRows = viewResult.rows.map(row => ({
        name: row.item_name,
        category: row.category,
        unit_price: parseFloat(row.unit_price) || 0,
        opening_stock: parseFloat(row.opening_stock) || 0,
        purchase_stock: parseFloat(row.purchase_stock) || 0,
        sales: parseFloat(row.sales) || 0,
        closing_stock: parseFloat(row.closing_stock) || 0,
        total_price: parseFloat(row.total_price) || 0
      }));

      const food = formattedRows.filter(r => r.category === 'food');
      const drinks = formattedRows.filter(r => r.category === 'drink');
      
      // Calculate total revenue generated on items sold
      const foodTotal = food.reduce((s, r) => s + (r.unit_price * r.sales), 0);
      const drinksTotal = drinks.reduce((s, r) => s + (r.unit_price * r.sales), 0);

      res.status(200).json({ success: true, date, food, drinks, foodTotal, drinksTotal });
    } catch (e) {
      console.error("Daily inventory error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  },

  updateDailyInventory: async (req, res) => {
    const { item_name, category, record_date, opening_stock, purchase_stock, unit_price } = req.body;
    try {
      await pool.query(`
        INSERT INTO daily_inventory (item_name, category, record_date, unit_price, opening_stock, purchase_stock)
        VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0))
        ON CONFLICT (item_name, category, record_date)
        DO UPDATE SET
          opening_stock = COALESCE($5, daily_inventory.opening_stock),
          purchase_stock = COALESCE($6, daily_inventory.purchase_stock),
          unit_price = COALESCE($4, daily_inventory.unit_price)
      `, [item_name, category, record_date, unit_price, opening_stock, purchase_stock]);

      res.status(200).json({ success: true });
    } catch (e) {
      console.error("Update daily inventory error:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  }
};