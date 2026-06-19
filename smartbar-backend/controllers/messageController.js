const pool = require("../config/db");

sendMessage: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { message } = req.body;
      
      // 1. Get the IO instance from the app
      const io = req.app.get('io'); 

      // 2. Save to database
      const result = await pool.query(
        `INSERT INTO client_messages(user_id, message) VALUES($1, $2) RETURNING *`,
        [userId, message]
      );

      // 3. Emit event to the managers room
      io.to('managers_room').emit('new_message', {
        senderId: userId,
        message: message,
        time: new Date()
      });

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
}

  getMessages: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          cm.*,
          u.name
        FROM client_messages cm
        JOIN users u ON cm.user_id = u.id
        ORDER BY cm.created_at DESC
      `);

      res.json({
        success: true,
        messages: result.rows
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

;

module.exports = messageController;