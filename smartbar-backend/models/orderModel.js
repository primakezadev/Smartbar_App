const pool = require('../config/db');

const OrderModel = {
  beginTransaction: async () => await pool.query('BEGIN'),
  commitTransaction: async () => await pool.query('COMMIT'),
  rollbackTransaction: async () => await pool.query('ROLLBACK'),

  createOrder: async (tableNumber) => {
    const result = await pool.query(
      "INSERT INTO orders (table_number, status) VALUES ($1, 'pending') RETURNING *",
      [tableNumber]
    );
    return result.rows[0];
  },

  createOrderItem: async (orderId, inventoryId, quantity, name, type, price) => {
    await pool.query(
      `INSERT INTO order_items (order_id, inventory_id, quantity, unit_price, name, type, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, inventoryId, quantity, price, name, type, price]
    );
  },

  getActiveOrders: async () => {
    const result = await pool.query(`
      SELECT o.id AS order_id, o.table_number, o.status, o.created_at, o.assigned_server_id,
             s.name AS assigned_server_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'name', COALESCE(oi.name, 'Unknown Item'),
                   'quantity', oi.quantity,
                   'type', oi.type
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN staff_profiles s ON o.assigned_server_id = s.id
      WHERE o.status IN ('pending', 'preparing', 'ready')
      GROUP BY o.id, o.table_number, o.status, o.created_at, o.assigned_server_id, s.name
      ORDER BY o.created_at ASC;
    `);
    return result.rows;
  },

  getAvailableStaff: async () => {
    const result = await pool.query('SELECT * FROM staff_profiles WHERE is_available = true');
    return result.rows;
  },

  assignServerToOrder: async (orderId, serverId) => {
    const result = await pool.query(
      `UPDATE orders SET assigned_server_id = $1, status = 'preparing'
       WHERE id = $2 RETURNING *`,
      [serverId, orderId]
    );
    return result.rows[0];
  },

  getClientLiveTracking: async (orderId) => {
    const result = await pool.query(`
      SELECT o.id AS order_id, o.status, o.table_number,
             s.name AS server_name, s.phone_number AS server_phone,
             s.profile_image_url AS server_avatar
      FROM orders o
      LEFT JOIN staff_profiles s ON o.assigned_server_id = s.id
      WHERE o.id = $1
    `, [orderId]);
    return result.rows[0];
  }
};

module.exports = OrderModel;