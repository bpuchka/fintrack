const express = require("express");
const authController = require("../controllers/auth.controller.js");

const router = express.Router();

// Authentication Routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

module.exports = router;
