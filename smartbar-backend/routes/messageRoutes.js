const express = require("express");
const router = express.Router();

const MessageController = require("../controllers/message.controller");
const authMiddleware = require("../middlewares/authMiddleware");

router.post(
  "/send",
  authMiddleware,
  MessageController.sendMessage
);

router.get(
  "/manager",
  authMiddleware,
  MessageController.getMessages
);

module.exports = router;