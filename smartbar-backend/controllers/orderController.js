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
        const inventoryId = item.product_id || item.id;
        const itemPrice = item.price || 0;
        // ✅ Capture special instructions from client
        const specialInstructions = item.special_instructions || "";

        console.log(`   ↳ ${item.name} | type=${itemType} | qty=${itemQuantity} | note="${specialInstructions}"`);

        const tableName = itemType === 'drink' ? 'drinks_inventory' : 'kitchen_inventory';

        const lockRes = await client.query(
          `SELECT current_stock FROM ${tableName} WHERE id = $1 FOR UPDATE`,
          [inventoryId]
        );

        if (lockRes.rows.length === 0) {
          throw new Error(`Item not found in inventory: ${item.name}`);
        }

        if (lockRes.rows[0].current_stock < itemQuantity) {
          throw new Error(`Insufficient stock for: ${item.name}`);
        }

        await client.query(
          `UPDATE ${tableName} SET current_stock = current_stock - $1 WHERE id = $2`,
          [itemQuantity, inventoryId]
        );

        // ✅ Save special_instructions into order_items
        await client.query(
          `INSERT INTO order_items (order_id, inventory_id, quantity, unit_price, name, type, price, special_instructions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orderId, inventoryId, itemQuantity, itemPrice, item.name, itemType, itemPrice, specialInstructions]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ success: true, orderId, message: "Order placed successfully." });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ placeUnifiedOrder error:", err.message);
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
               json_agg(json_build_object(
                 'item_id', oi.inventory_id,
                 'name', oi.name,
                 'quantity', oi.quantity,
                 'special_instructions', oi.special_instructions
               )) AS items
        FROM orders o
        LEFT JOIN users u ON o.assigned_server_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'pending'
        GROUP BY o.id, u.name
        ORDER BY o.created_at ASC;
      `);
      res.status(200).json({ success: true, tickets: result.rows });
    } catch (error) {
      console.error("Active orders error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ✅ special_instructions included in waiter dashboard items
  getWaiterDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status AS master_status,
               o.total_price, o.created_at, u.name AS waiter_name,
               json_agg(json_build_object(
                 'item_id', oi.inventory_id,
                 'name', oi.name,
                 'quantity', oi.quantity,
                 'type', oi.type,
                 'special_instructions', oi.special_instructions
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
      console.error("Waiter dashboard error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ✅ special_instructions included in kitchen dashboard items
  getKitchenDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at,
               u.name AS waiter_name,
               json_agg(json_build_object(
                 'name', oi.name,
                 'quantity', oi.quantity,
                 'special_instructions', oi.special_instructions
               )) FILTER (WHERE oi.type = 'kitchen') AS items
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

  // ✅ special_instructions included in bar/counter dashboard items
  getBarDashboard: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.id AS order_id, o.table_number, o.status, o.created_at,
               u.name AS waiter_name,
               json_agg(json_build_object(
                 'name', oi.name,
                 'quantity', oi.quantity,
                 'special_instructions', oi.special_instructions
               )) FILTER (WHERE oi.type = 'drink') AS items
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

  getSoldItems: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT oi.name, oi.type, oi.quantity, oi.price, o.id AS order_id, o.table_number
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'ready'
        ORDER BY o.created_at DESC;
      `);

      const food = [];
      const drinks = [];
      let foodTotal = 0;
      let drinksTotal = 0;

      result.rows.forEach(row => {
        const lineTotal = (parseFloat(row.price) || 0) * row.quantity;
        const entry = {
          name: row.name,
          quantity: row.quantity,
          price: parseFloat(row.price) || 0,
          total: lineTotal,
          order_id: row.order_id,
          table_number: row.table_number
        };
        if (row.type === 'kitchen') { food.push(entry); foodTotal += lineTotal; }
        else { drinks.push(entry); drinksTotal += lineTotal; }
      });

      res.status(200).json({ success: true, food, drinks, foodTotal, drinksTotal });
    } catch (error) {
      console.error("Sold items error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  updateStatus: async (req, res) => {
    const { id } = req.params;
    const { server_id, status } = req.body;
    console.log("=== UPDATE STATUS === Order:", id, "| Server:", server_id, "| Status:", status);

    try {
      const updatedOrder = await OrderService.claimActiveTicket(id, server_id, status || 'preparing');
      if (!updatedOrder) return res.status(404).json({ success: false, error: "Order not found." });

      const waiterRes = await pool.query(
        `SELECT name, phone_number FROM users WHERE id = $1`, [server_id]
      );
      const waiterName = waiterRes.rows[0]?.name || "Your Waiter";
      const waiterPhone = waiterRes.rows[0]?.phone_number || "";

      const orderRes = await pool.query(`SELECT user_id FROM orders WHERE id = $1`, [id]);
      const clientUserId = orderRes.rows[0]?.user_id;

      const io = req.app.get('io');
      if (io && clientUserId) {
        io.to(`user_${clientUserId}`).emit('order_claimed_by_waiter', {
          id: parseInt(id), status: status || 'preparing',
          waiter_name: waiterName, waiter_phone: waiterPhone
        });
      }

      return res.status(200).json({ success: true, order: updatedOrder });
    } catch (error) {
      console.error("Update status error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getClientStatus: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT o.id, o.status, o.table_number, u.name AS waiter_name, u.phone_number AS waiter_phone
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