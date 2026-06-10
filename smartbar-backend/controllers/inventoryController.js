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
      WITH combined_inventory AS (
        SELECT id, name, price, initial_stock, purchased_today, closing_stock, 'kitchen_inventory' AS source FROM kitchen_inventory
        UNION ALL
        SELECT id, name, price, initial_stock, purchased_today, closing_stock, 'drinks_inventory' AS source FROM drinks_inventory
      )
      SELECT 
        i.id,
        i.name, 
        i.price, 
        i.initial_stock, 
        i.purchased_today, 
        i.closing_stock,
        i.source,
        -- 1. Calculate units sold from order_items
        COALESCE((
          SELECT SUM(oi.quantity) 
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.name = i.name 
            AND o.status IN ('ready', 'completed')
            AND DATE(o.created_at) = CURRENT_DATE
        ), 0) AS actual_sold_units,
        
        -- 2. Calculate expected stock
        (i.initial_stock + i.purchased_today - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.name = i.name AND o.status IN ('ready', 'completed') AND DATE(o.created_at) = CURRENT_DATE
        ), 0)) AS expected_stock,
        
        -- 3. Calculate discrepancy
        (i.closing_stock - (i.initial_stock + i.purchased_today - COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.name = i.name AND o.status IN ('ready', 'completed') AND DATE(o.created_at) = CURRENT_DATE
        ), 0))) AS discrepancy,
        
        -- 4. Calculate valuation
        (i.price * COALESCE((
          SELECT SUM(oi.quantity) FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.name = i.name AND o.status IN ('ready', 'completed') AND DATE(o.created_at) = CURRENT_DATE
        ), 0)) AS total_sales
      FROM combined_inventory i
      ORDER BY i.source DESC, i.name ASC;
    `;
    
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateClosingStock = async (req, res) => {
  const { table, name, closing_stock } = req.body; // 🚀 Dynamic 'table' property from frontend
  
  // Safety guard check to prevent SQL injection on dynamic table names
  const allowedTables = ['kitchen_inventory', 'drinks_inventory'];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ success: false, message: 'Invalid inventory source target.' });
  }

  try {
    // Inject checked table identifier into raw query context safely
    await pool.query(
      `UPDATE ${table} SET closing_stock = $1 WHERE name = $2`,
      [closing_stock, name]
    );
    res.json({ success: true, message: `Closing stock updated in ${table} successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};