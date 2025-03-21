// routes/bank.investment.routes.js
const express = require("express");
const router = express.Router();
const bankInvestmentController = require("../controllers/bank.investment.controller.js");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    next();
};

// Create a new bank investment
router.post("/", requireAuth, bankInvestmentController.createBankInvestment);

// Retrieve all bank investments for the authenticated user
router.get("/", requireAuth, bankInvestmentController.findAllBankInvestments);

// Retrieve a single bank investment by id
router.get("/:id", requireAuth, bankInvestmentController.findBankInvestmentById);

// Update a bank investment
router.put("/:id", requireAuth, bankInvestmentController.updateBankInvestment);

// Delete a bank investment
router.delete("/:id", requireAuth, bankInvestmentController.deleteBankInvestment);

module.exports = router;