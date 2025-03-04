const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Не сте влезли в профила си" });
    }
    next();
};

// Get all user investments
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Query to get all user investments
        const [investments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? ORDER BY purchase_date DESC`, 
            [userId]
        );
        
        res.json({ success: true, investments });
    } catch (error) {
        console.error("Error fetching investments:", error);
        res.status(500).json({ success: false, message: "Грешка при зареждане на инвестициите" });
    }
});

// Add new investment
router.post("/", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { type, date, notes } = req.body;
        
        // Validate investment type
        if (!['bank', 'crypto', 'stock', 'metal'].includes(type)) {
            return res.status(422).json({ success: false, message: "Невалиден тип инвестиция" });
        }
        
        // Common validation
        if (!date) {
            return res.status(422).json({ success: false, message: "Датата е задължителна" });
        }
        
        // Base investment data
        let insertData = {
            user_id: userId,
            investment_type: type,
            purchase_date: date,
            notes: notes || null
        };
        
        // Type-specific validation and data preparation
        if (type === 'bank') {
            const { currency, amount, interestRate, interestType } = req.body;
            
            // Validate bank deposit data
            if (!currency) {
                return res.status(422).json({ success: false, message: "Валутата е задължителна" });
            }
            if (!amount || isNaN(amount) || amount <= 0) {
                return res.status(422).json({ success: false, message: "Невалидна сума" });
            }
            if (!interestRate || isNaN(interestRate) || interestRate < 0 || interestRate > 100) {
                return res.status(422).json({ success: false, message: "Невалиден лихвен процент" });
            }
            
            // Add bank-specific data
            insertData = {
                ...insertData,
                symbol: `BANK_${currency}`,
                quantity: amount,
                purchase_price: 1, // Placeholder value
                currency: currency,
                interest_rate: interestRate,
                interest_type: interestType
            };
        } else {
            // For crypto, stock, and metal
            const { symbol, amount, price } = req.body;
            
            // Validate other investment types
            if (!symbol) {
                return res.status(422).json({ success: false, message: "Символът е задължителен" });
            }
            if (!amount || isNaN(amount) || amount <= 0) {
                return res.status(422).json({ success: false, message: "Невалидно количество" });
            }
            if (!price || isNaN(price) || price <= 0) {
                return res.status(422).json({ success: false, message: "Невалидна цена" });
            }
            
            // Add type-specific data
            insertData = {
                ...insertData,
                symbol: symbol,
                quantity: amount,
                purchase_price: price
            };
        }
        
        // Insert the investment into the database
        const [result] = await pool.query("INSERT INTO user_investments SET ?", insertData);
        
        if (result.affectedRows === 1) {
            res.status(201).json({ 
                success: true, 
                message: "Инвестицията беше добавена успешно", 
                investmentId: result.insertId 
            });
        } else {
            throw new Error("Failed to insert investment");
        }
    } catch (error) {
        console.error("Error adding investment:", error);
        res.status(500).json({ success: false, message: "Грешка при добавяне на инвестицията" });
    }
});

module.exports = router;