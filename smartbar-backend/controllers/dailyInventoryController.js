const pool = require('../config/db');

const FOOD_CATEGORIES = ['Bites', 'Pork', 'Brochettes', 'Sides', 'Starters', 'kitchen'];
const getCategory = (productCategory) => FOOD_CATEGORIES.includes(productCategory) ? 'food' : 'drink';

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
  const opening = parseFloat(prevRow.rows[0].opening_stock);
  const purchase = parseFloat(prevRow.rows[0].purchase_stock);
  return opening + purchase - prevSales;
};

module.exports = {
  getDailyReport: async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    try {
      const productsRes = await pool.query('SELECT id, name, price, category FROM products');
      const products = productsRes.rows;
      const result = [];

      for (const p of products) {
        const cat = getCategory(p.category);

        let row = await pool.query(
          'SELECT * FROM daily_inventory WHERE item_name = $1 AND category = $2 AND record_date = $3',
          [p.name, cat, date]
        );

        let opening, purchase, unit_price;

        if (row.rows.length === 0) {
          opening = await getPreviousClosing(p.name, cat, date);
          purchase = 0;
          unit_price = parseFloat(p.price) || 0;

          await pool.query(
            `INSERT INTO daily_inventory (item_name, category, record_date, unit_price, opening_stock, purchase_stock)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (item_name, category, record_date) DO NOTHING`,
            [p.name, cat, date, unit_price, opening, purchase]
          );
        } else {
          opening = parseFloat(row.rows[0].opening_stock);
          purchase = parseFloat(row.rows[0].purchase_stock);
          unit_price = parseFloat(row.rows[0].unit_price);
        }

        const sales = await getSales(p.name, cat, date);
        const closing = opening + purchase - sales;
        const total_price = unit_price * sales;

        result.push({
          product_id: p.id,
          name: p.name,
          category: cat,
          unit_price,
          opening_stock: opening,
          purchase_stock: purchase,
          sales,
          closing_stock: closing,
          total_price
        });
      }

      const food = result.filter(r => r.category === 'food');
      const drinks = result.filter(r => r.category === 'drink');
      const foodTotal = food.reduce((s, r) => s + r.total_price, 0);
      const drinksTotal = drinks.reduce((s, r) => s + r.total_price, 0);

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