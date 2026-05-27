const OrderModel = require('../models/orderModel');
const pool = require('../config/db');

const OrderService = {
  processNewOrder: async (tableNumber, items) => {
    await OrderModel.beginTransaction();
    try {
      const order = await OrderModel.createOrder(tableNumber);
      
      for (let item of items) {
        const prodCheck = await pool.query('SELECT category FROM products WHERE id = $1', [item.product_id]);
        let destination = 'counter';
        if (prodCheck.rows.length > 0) {
          const category = prodCheck.rows[0].category.toLowerCase();
          if (category === 'bites' || category === 'food') destination = 'kitchen';
        }
        await OrderModel.createOrderItem(order.id, item.product_id, item.quantity, destination);
      }
      
      await OrderModel.commitTransaction();

      // 📢 Notifies available servers
      const alertList = await OrderModel.getAvailableStaff();
      console.log(`Pushed system broadcast to ${alertList.length} active waiters for Table ${tableNumber}`);
      
      return order.id;
    } catch (error) {
      await OrderModel.rollbackTransaction();
      throw error;
    }
  },

  // Waiter & Staff triggers this to claim active ticket status updates
  claimActiveTicket: async (orderId, serverId, status) => {
    try {
      // ⚡ FIXED: Explicitly updates assigned_server_id and status, then returns the row cleanly
      const query = `
        UPDATE orders 
        SET 
          assigned_server_id = $1, 
          status = $2 
        WHERE id = $3 
        RETURNING *;
      `;
      
      const result = await pool.query(query, [serverId, status, orderId]);
      
      if (result.rows.length === 0) {
        console.error(`❌ Order ID ${orderId} not found during claim execution.`);
        return null;
      }
      
      console.log(`✅ Order ID ${orderId} successfully linked to Server ID ${serverId}`);
      return result.rows[0];
    } catch (error) {
      console.error("Database error inside claimActiveTicket service:", error.message);
      throw error;
    }
  }, // <--- ⚡ FIXED: Added the missing closing brace and comma here

  retrieveLiveTrackingData: async (orderId) => {
    return await OrderModel.getClientLiveTracking(orderId);
  }
};

module.exports = OrderService;