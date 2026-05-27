const OrderService = require('../services/orderService');
const pool = require('../config/db');

const OrderController = {
  
  // 1. PLACE A SECURE UNIFIED ORDER (High Concurrency)
  placeUnifiedOrder: async (req, res) => {
    const userId = req.user.userId; // JWT-verified identity
    const { table_number, items } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderRes = await client.query(
        "INSERT INTO orders (user_id, table_number, status, created_at) VALUES ($1, $2, 'pending', NOW()) RETURNING id",
        [userId, table_number]
      );
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        const tableName = item.type === 'drink' ? 'drinks_inventory' : 'kitchen_inventory';
        
        const lockRes = await client.query(
          `SELECT current_stock FROM ${tableName} WHERE id = $1 FOR UPDATE`, 
          [item.product_id]
        );

        if (lockRes.rows.length === 0 || lockRes.rows[0].current_stock < item.quantity) {
          throw new Error(`Insufficient stock for product ID: ${item.product_id}`);
        }

        await client.query(
          `UPDATE ${tableName} SET current_stock = current_stock - $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );

        await client.query(
          "INSERT INTO order_items (order_id, product_id, quantity, name, type) VALUES ($1, $2, $3, $4, $5)",
          [orderId, item.product_id, item.quantity, item.name, item.type]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ success: true, orderId, message: "Order placed successfully." });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(400).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  },

  // 2. DASHBOARD QUERIES
  getActiveOrders: async (req, res) => {
    try {
      const query = `
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at, u.name AS waiter_name,
        json_agg(json_build_object('item_id', oi.id, 'name', oi.name, 'quantity', oi.quantity)) AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id   
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'pending'
        GROUP BY o.id, u.name ORDER BY o.created_at ASC;
      `;
      const result = await pool.query(query);
      res.status(200).json({ success: true, tickets: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getKitchenDashboard: async (req, res) => {
    try {
      const query = `
        SELECT o.id AS order_id, o.table_number, o.status, u.name AS waiter_name,
        json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity)) 
        FILTER (WHERE oi.type = 'kitchen') AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id   
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status IN ('pending', 'preparing')
        GROUP BY o.id, u.name;
      `;
      const result = await pool.query(query);
      res.status(200).json({ success: true, tickets: result.rows.filter(t => t.items !== null) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getBarDashboard: async (req, res) => {
    try {
      const query = `
        SELECT o.id AS order_id, o.table_number, o.status, u.name AS waiter_name,
        json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity)) 
        FILTER (WHERE oi.type = 'drink') AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id   
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status IN ('pending', 'preparing')
        GROUP BY o.id, u.name;
      `;
      const result = await pool.query(query);
      res.status(200).json({ success: true, tickets: result.rows.filter(t => t.items !== null) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // 3. STATUS & RECEIPT
  updateStatus: async (req, res) => {
    const { id } = req.params;
    const { server_id, status } = req.body;
    try {
      const updatedOrder = await OrderService.claimActiveTicket(id, server_id, status || 'preparing');
      return updatedOrder ? res.status(200).json({ success: true, order: updatedOrder }) : res.status(404).json({ success: false, error: "Order not found." });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getClientStatus: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query("SELECT o.id, o.status, o.table_number, u.name AS waiter_name FROM orders o LEFT JOIN users u ON o.assigned_server_id = u.id WHERE o.id = $1", [id]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Ticket not found." });
      res.status(200).json({ success: true, order: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  confirmClientReceipt: async (req, res) => {
    const { id } = req.params;
    const result = await pool.query("UPDATE orders SET status = 'completed' WHERE id = $1 AND status = 'delivered' RETURNING id", [id]);
    return result.rows.length > 0 ? res.status(200).json({ success: true }) : res.status(400).json({ success: false, message: "Order not deliverable." });
  }
};

module.exports = OrderController;