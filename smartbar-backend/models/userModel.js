const pool = require('../config/db');

const UserModel = {
  createUser: async (username, email, passwordHash, role = 'client') => {
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, passwordHash, role]
    );
    return result.rows[0];
  },

  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  findById: async (id) => {
    const result = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }
};

module.exports = UserModel;
