const pool = require('../config/db');

const ReportService = {
  generateDailyReport: async (targetDate) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Sync daily inventory items with orders to calculate revenue, sales counts, and total valuation
      const syncInventoryQuery = `
        INSERT INTO public.daily_inventory (item_name, category, record_date, sales, unit_price)
        SELECT 
          p.name AS item_name,
          CASE 
            WHEN p.category IN ('Beer', 'Cider', 'Soda', 'Water', 'Juice', 'Cocktail') THEN 'drink'
            ELSE 'food'
          END AS category,
          DATE(o.created_at) AS record_date,
          SUM(oi.quantity) AS sales,
          MAX(p.price) AS unit_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN kitchen_inventory p ON oi.product_id = p.id
        WHERE DATE(o.created_at) = $1 AND o.status = 'completed'
        GROUP BY p.name, p.category, DATE(o.created_at)
        ON CONFLICT (item_name, category, record_date) DO UPDATE SET
          sales = EXCLUDED.sales,
          unit_price = EXCLUDED.unit_price;
      `;
      await client.query(syncInventoryQuery, [targetDate]);

      // 2. Generate the financial daily summary report
      const dailyReportQuery = `
        INSERT INTO daily_reports (report_date, total_revenue, total_cost, total_profit)
        SELECT 
          DATE(o.created_at) AS report_date,
          SUM(oi.quantity * p.price) AS total_revenue,
          SUM(oi.quantity * COALESCE(p.cost_price, 0)) AS total_cost,
          SUM(oi.quantity * (p.price - COALESCE(p.cost_price, 0))) AS total_profit
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
      await client.query(dailyReportQuery, [targetDate]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error generating daily report:', error);
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = ReportService;