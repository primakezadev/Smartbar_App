const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// POST /api/auth/register - Create new user/staff profiles
router.post('/register', AuthController.register);

// POST /api/auth/login - Authenticate credentials and return session tokens
router.post('/login', AuthController.login);

module.exports = router;