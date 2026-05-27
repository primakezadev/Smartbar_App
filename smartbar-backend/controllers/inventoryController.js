const pool = require('../config/db');

exports.getDailyRevenue = async (req, res) => {
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

    const revenueData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const found = result.rows.find(row => new Date(row.date).toISOString().split('T')[0] === dateStr);
      return { revenue: found ? parseFloat(found.revenue) : 0 };
    });

    res.json({ success: true, data: revenueData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInventoryReport = async (req, res) => {
  try {
    const query = `
      SELECT 
        name, 
        price, 
        initial_stock, 
        purchased_today, 
        closing_stock,
        -- The theoretical stock we SHOULD have
        (initial_stock + purchased_today - actual_sold_units) AS expected_stock,
        -- The discrepancy (Physical - Expected)
        (closing_stock - (initial_stock + purchased_today - actual_sold_units)) AS discrepancy,
        (price * actual_sold_units) AS total_sales
      FROM kitchen_inventory;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.updateClosingStock = async (req, res) => {
  const { name, closing_stock } = req.body;
  try {
    await pool.query(
      'UPDATE kitchen_inventory SET closing_stock = $1 WHERE name = $2',
      [closing_stock, name]
    );
    res.json({ success: true, message: 'Closing stock updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};