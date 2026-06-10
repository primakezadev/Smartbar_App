const OrderService = require('../services/orderService');
const pool = require('../config/db');

const OrderController = {

  placeUnifiedOrder: async (req, res) => {
    const userId = req.user.userId;
    const { table_number, items, total_price } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderRes = await client.query(
        "INSERT INTO orders (user_id, table_number, status, total_price, created_at) VALUES ($1, $2, 'pending', $3, NOW()) RETURNING id",
        [userId, table_number, total_price || 0]
      );
      const orderId = orderRes.rows[0].id;
      console.log(`📦 New order: ID=${orderId}, Table=${table_number}`);

      for (const item of items) {
        const itemType = item.type || (
          ['Bites', 'Pork', 'Brochettes', 'Sides', 'Starters', 'kitchen'].includes(item.category)
            ? 'kitchen' : 'drink'
        );
        const itemQuantity = item.quantity || 1;
        const productId = item.product_id || item.id;
        const itemPrice = item.price || 0;

        console.log(`   ↳ ${item.name} | type=${itemType} | qty=${itemQuantity}`);

        const tableName = itemType === 'drink' ? 'drinks_inventory' : 'kitchen_inventory';
        const lockRes = await client.query(
          `SELECT current_stock FROM ${tableName} WHERE id = $1 FOR UPDATE`, [productId]
        );

        if (lockRes.rows.length === 0 || lockRes.rows[0].current_stock < itemQuantity) {
          throw new Error(`Insufficient stock for: ${item.name || productId}`);
        }

        await client.query(
          `UPDATE ${tableName} SET current_stock = current_stock - $1 WHERE id = $2`,
          [itemQuantity, productId]
        );
        await client.query(
          "INSERT INTO order_items (order_id, item_id, quantity, name, type, price) VALUES ($1, $2, $3, $4, $5, $6)",
          [orderId, productId, itemQuantity, item.name, itemType, itemPrice]
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

  getActiveOrders: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at,
               u.name AS waiter_name,
               json_agg(json_build_object('item_id', oi.item_id, 'name', oi.name, 'quantity', oi.quantity)) AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'pending'
        GROUP BY o.id, u.name
        ORDER BY o.created_at ASC;
      `);
      res.status(200).json({ success: true, tickets: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
getWaiterDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status AS master_status,
               o.total_price, o.created_at, u.name AS waiter_name,
               json_agg(json_build_object(
                 'item_id', oi.item_id, 'name', oi.name,
                 'quantity', oi.quantity, 'type', oi.type
               )) AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'pending' AND o.assigned_server_id IS NULL
        GROUP BY o.id, u.name
        ORDER BY o.created_at ASC;
      `);
      console.log(`=== WAITER DASHBOARD === orders=${result.rows.length}`);
      res.status(200).json({ success: true, tickets: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ✅ FIXED: Only 'preparing' orders, only kitchen items, assigned waiter only
  getKitchenDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at,
               u.name AS waiter_name,
               json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity))
                 FILTER (WHERE oi.type = 'kitchen') AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'preparing'
          AND o.assigned_server_id IS NOT NULL
        GROUP BY o.id, u.name
        ORDER BY o.created_at ASC;
      `);

      console.log("=== KITCHEN DASHBOARD === user:", req.user?.role, "rows:", result.rows.length);
      const tickets = result.rows.filter(t => t.items !== null);
      res.status(200).json({ success: true, tickets });
    } catch (error) {
      console.error("Kitchen error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ✅ FIXED: Only 'preparing' orders, only drink items, assigned waiter only
  getBarDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at,
               u.name AS waiter_name,
               json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity))
                 FILTER (WHERE oi.type = 'drink') AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'preparing'
          AND o.assigned_server_id IS NOT NULL
        GROUP BY o.id, u.name
        ORDER BY o.created_at ASC;
      `);

      console.log("=== BAR DASHBOARD === user:", req.user?.role, "rows:", result.rows.length);
      const tickets = result.rows.filter(t => t.items !== null);
      res.status(200).json({ success: true, tickets });
    } catch (error) {
      console.error("Bar error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateStatus: async (req, res) => {
    const { id } = req.params;
    const { server_id, status } = req.body;
    console.log("=== UPDATE STATUS === Order:", id, "| Server:", server_id, "| Status:", status, "| Role:", req.user?.role);

    try {
      const updatedOrder = await OrderService.claimActiveTicket(id, server_id, status || 'preparing');
      console.log("Updated:", JSON.stringify(updatedOrder));

      const itemCheck = await pool.query(
        `SELECT item_id, name, type FROM order_items WHERE order_id = $1`, [id]
      );
      console.log(`Items in order ${id}:`, JSON.stringify(itemCheck.rows));

      return updatedOrder
        ? res.status(200).json({ success: true, order: updatedOrder })
        : res.status(404).json({ success: false, error: "Order not found." });
    } catch (error) {
      console.error("Update status error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getClientStatus: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT o.id, o.status, o.table_number, u.name AS waiter_name
         FROM orders o LEFT JOIN users u ON o.assigned_server_id = u.id WHERE o.id = $1`, [id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, message: "Ticket not found." });
      res.status(200).json({ success: true, order: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  confirmClientReceipt: async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE orders SET status = 'completed' WHERE id = $1 AND status = 'delivered' RETURNING id", [id]
    );
    return result.rows.length > 0
      ? res.status(200).json({ success: true })
      : res.status(400).json({ success: false, message: "Order not deliverable." });
  }
};

module.exports = OrderController;