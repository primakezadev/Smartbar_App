const pool = require('../config/db');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');

const AuthController = {
  // USER REGISTRATION
  register: async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
      // 1. Basic validation check
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "Please fill in all required fields." });
      }

      // 2. Check if user already exists
      const userCheck = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
      if (userCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: "A user with this email already exists." });
      }

      // 3. ✨ FIXED: Properly hash the password using bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 4. Insert into database (default role to 'waiter' if not specified)
      // Note: We use the column name 'password' here to match your login select structure perfectly
      const newUserQuery = `
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role;
      `;
      const assignedRole = role || 'waiter';
      const result = await pool.query(newUserQuery, [name, email.toLowerCase().trim(), hashedPassword, assignedRole]);

      return res.status(201).json({ success: true, user: result.rows[0] });

    } catch (error) {
      console.error("Registration error details:", error.message);
      return res.status(500).json({ success: false, error: "Internal server registry error." });
    }
  },

  // USER LOGIN
  login: async (req, res) => {
    const { email, password } = req.body;

    try {
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Missing email or password." });
      }

      const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
      
      if (userResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid credentials." });
      }

      const user = userResult.rows[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Invalid credentials." });
      }

      // 2. ✨ NEW: Generate JWT Token
      // The secret should be stored in your .env file
      const token = jwt.sign(
        { userId: user.id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
      );

      // 3. Return the token to the client
      return res.status(200).json({
        success: true,
        message: "Authentication successful!",
        token: token, // Send this back to the client!
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error("Login error:", error.message);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  }
};

module.exports = AuthController;