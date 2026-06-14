const pool = require('../config/db');

const ReportService = {
  generateDailyReport: async (targetDate) => {
    const query = `
      INSERT INTO daily_reports (report_date, total_revenue, total_cost, total_profit)
      SELECT 
        DATE(o.created_at) AS report_date,
        SUM(oi.quantity * p.price) AS total_revenue,
        SUM(oi.quantity * p.cost_price) AS total_cost,
        SUM(oi.quantity * (p.price - p.cost_price)) AS total_profit
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN kitchen_inventory p ON oi.product_id = p.id
      WHERE DATE(o.created_at) = $1 AND o.status = 'completed'
      GROUP BY DATE(o.created_at)
      ON CONFLICT (report_date) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        total_cost = EXCLUDED.total_cost,
        total_profit = EXCLUDED.total_profit;
    `;
    await pool.query(query, [targetDate]);
  }
};

module.exports = ReportService;