const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserService = {
  registerUser: async (username, email, password, role) => {
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) throw new Error('Email is already registered.');

    // Securely hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    return await UserModel.createUser(username, email, passwordHash, role);
  },

  loginUser: async (email, password) => {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('Invalid email or password.');

    // Check if entered password matches the hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new Error('Invalid email or password.');

    // Generate a secure JWT Token token that expires in 7 days
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    };
  }
};

module.exports = UserService;
