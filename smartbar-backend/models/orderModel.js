const pool = require('../config/db');

const OrderModel = {
  beginTransaction: async () => await pool.query('BEGIN'),
  commitTransaction: async () => await pool.query('COMMIT'),
  rollbackTransaction: async () => await pool.query('ROLLBACK'),

  // Insert master order row
  createOrder: async (tableNumber) => {
    const result = await pool.query(
      "INSERT INTO orders (table_number, status) VALUES ($1, 'pending') RETURNING *",
      [tableNumber]
    );
    return result.rows[0];
  },

 
  // Insert individual items with routing destination flag (counter vs kitchen)
  createOrderItem: async (orderId, productId, quantity, destination) => {
    await pool.query(
      'INSERT INTO order_items (order_id, product_id, quantity, destination) VALUES ($1, $2, $3, $4)',
      [orderId, productId, quantity, destination]
    );
  },

  
  //  FIX: Complete GROUP BY sequence to prevent Neon/Postgres engine rejection crashes
  getActiveOrders: async () => {
    const queryText = `
      SELECT o.id AS order_id, o.table_number, o.status, o.created_at, o.assigned_server_id,
             s.name AS assigned_server_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'product_name', COALESCE(p.name, 'Unknown Item'), 
                   'quantity', oi.quantity,
                   'destination', oi.destination
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN staff_profiles s ON o.assigned_server_id = s.id
      WHERE o.status IN ('pending', 'preparing', 'ready')
      GROUP BY o.id, o.table_number, o.status, o.created_at, o.assigned_server_id, s.name
      ORDER BY o.created_at ASC;
    `;
    const result = await pool.query(queryText);
    return result.rows;
  },

  
  //  Add this back so your notification trigger placeholder functions properly
  getAvailableStaff: async () => {
    const result = await pool.query('SELECT * FROM staff_profiles WHERE is_available = true');
    return result.rows;
  },

  
  // Assign a server profile to the ticket
 // ⚡ MODEL FIX: Make sure the column name matches your status tracking JOIN query!
assignServerToOrder: async (orderId, serverId) => {
  const query = `
    UPDATE orders 
    SET 
      assigned_server_id = $1,  -- 👈 MUST match the column used in your controller's LEFT JOIN!
      status = 'preparing' 
    WHERE id = $2 
    RETURNING *;
  `;
  const result = await pool.query(query, [serverId, orderId]);
  return result.rows[0];
}}

  
  // For client tracking checks
  getClientLiveTracking: async (orderId) => {
    const queryText = `
      SELECT o.id AS order_id, o.status, o.table_number,
             s.name AS server_name, s.phone_number AS server_phone, s.profile_image_url AS server_avatar
      FROM orders o
      LEFT JOIN staff_profiles s ON o.assigned_server_id = s.id
      WHERE o.id = $1;
    `;
    const result = await pool.query(queryText, [orderId]);
    return result.rows[0];
  }


module.exports = OrderModel;