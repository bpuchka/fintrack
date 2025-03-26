// routes/investments-page.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Main investments page - redirects to portfolio
router.get("/", requireAuth, (req, res) => {
    res.redirect('/portfolio');
});

// Bank investments page
router.get("/bank", requireAuth, async (req, res) => {
    try {
        // Fetch summary data for this investment type
        const userId = req.session.user.id;
        const [bankInvestments] = await pool.query(
            `SELECT * FROM bank_investment WHERE user_id = ?`, 
            [userId]
        );
        
        // Calculate totals for initial page load
        let totalValue = 0;
        let totalInitialValue = 0;
        
        // Simple calculation for initial render
        bankInvestments.forEach(inv => {
            totalInitialValue += parseFloat(inv.amount);
            // For bank investments, we'll just use the amount for initial display
            totalValue += parseFloat(inv.amount);
        });
        
        // Calculate basic profit
        const totalProfit = totalValue - totalInitialValue;
        const profitPercentage = totalInitialValue > 0 ? (totalProfit / totalInitialValue) * 100 : 0;
        
        // Set the specific variables for the bank investments page
        const pageData = {
            user: req.session.user,
            investmentType: 'bank',
            investmentTypeDisplay: 'Банкови влогове',
            investmentTypeColor: '#6dc0e0',
            initialData: {
                totalValue: totalValue.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                profitPercentage: profitPercentage.toFixed(2),
                investmentCount: bankInvestments.length
            }
        };
        
        res.render("investments", pageData);
    } catch (error) {
        console.error("Error fetching bank investments:", error);
        // Render with default values if error
        res.render("investments", {
            user: req.session.user,
            investmentType: 'bank',
            investmentTypeDisplay: 'Банкови влогове',
            investmentTypeColor: '#6dc0e0',
            initialData: {
                totalValue: '0.00',
                totalProfit: '0.00',
                profitPercentage: '0.00',
                investmentCount: 0
            }
        });
    }
});

// Crypto investments page
router.get("/crypto", requireAuth, async (req, res) => {
    try {
        // Fetch summary data for this investment type
        const userId = req.session.user.id;
        const [cryptoInvestments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type = 'crypto'`, 
            [userId]
        );
        
        // Calculate totals for initial page load
        let totalValue = 0;
        let totalInitialValue = 0;
        
        // Simple calculation for initial render
        cryptoInvestments.forEach(inv => {
            const initialInvValue = parseFloat(inv.quantity) * parseFloat(inv.purchase_price);
            totalInitialValue += initialInvValue;
            // For crypto, we'll use the initial value for now (will be updated by API)
            totalValue += initialInvValue;
        });
        
        // Calculate basic profit
        const totalProfit = totalValue - totalInitialValue;
        const profitPercentage = totalInitialValue > 0 ? (totalProfit / totalInitialValue) * 100 : 0;
        
        // Set the specific variables for the crypto investments page
        const pageData = {
            user: req.session.user,
            investmentType: 'crypto',
            investmentTypeDisplay: 'Криптовалути',
            investmentTypeColor: '#8e44ad',
            initialData: {
                totalValue: totalValue.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                profitPercentage: profitPercentage.toFixed(2),
                investmentCount: cryptoInvestments.length
            }
        };
        
        res.render("investments", pageData);
    } catch (error) {
        console.error("Error fetching crypto investments:", error);
        // Render with default values if error
        res.render("investments", {
            user: req.session.user,
            investmentType: 'crypto',
            investmentTypeDisplay: 'Криптовалути',
            investmentTypeColor: '#8e44ad',
            initialData: {
                totalValue: '0.00',
                totalProfit: '0.00',
                profitPercentage: '0.00',
                investmentCount: 0
            }
        });
    }
});

// Stock investments page
router.get("/stocks", requireAuth, async (req, res) => {
    try {
        // Fetch summary data for this investment type
        const userId = req.session.user.id;
        const [stockInvestments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type = 'stock'`, 
            [userId]
        );
        
        // Calculate totals for initial page load
        let totalValue = 0;
        let totalInitialValue = 0;
        
        // Simple calculation for initial render
        stockInvestments.forEach(inv => {
            const initialInvValue = parseFloat(inv.quantity) * parseFloat(inv.purchase_price);
            totalInitialValue += initialInvValue;
            // For stocks, we'll use the initial value for now (will be updated by API)
            totalValue += initialInvValue;
        });
        
        // Calculate basic profit
        const totalProfit = totalValue - totalInitialValue;
        const profitPercentage = totalInitialValue > 0 ? (totalProfit / totalInitialValue) * 100 : 0;
        
        // Set the specific variables for the stock investments page
        const pageData = {
            user: req.session.user,
            investmentType: 'stock',
            investmentTypeDisplay: 'Акции',
            investmentTypeColor: '#27ae60',
            initialData: {
                totalValue: totalValue.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                profitPercentage: profitPercentage.toFixed(2),
                investmentCount: stockInvestments.length
            }
        };
        
        res.render("investments", pageData);
    } catch (error) {
        console.error("Error fetching stock investments:", error);
        // Render with default values if error
        res.render("investments", {
            user: req.session.user,
            investmentType: 'stock',
            investmentTypeDisplay: 'Акции',
            investmentTypeColor: '#27ae60',
            initialData: {
                totalValue: '0.00',
                totalProfit: '0.00',
                profitPercentage: '0.00',
                investmentCount: 0
            }
        });
    }
});

// Metal investments page
router.get("/metals", requireAuth, async (req, res) => {
    try {
        // Fetch summary data for this investment type
        const userId = req.session.user.id;
        const [metalInvestments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type = 'metal'`, 
            [userId]
        );
        
        // Calculate totals for initial page load
        let totalValue = 0;
        let totalInitialValue = 0;
        
        // Simple calculation for initial render
        metalInvestments.forEach(inv => {
            const initialInvValue = parseFloat(inv.quantity) * parseFloat(inv.purchase_price);
            totalInitialValue += initialInvValue;
            // For metals, we'll use the initial value for now (will be updated by API)
            totalValue += initialInvValue;
        });
        
        // Calculate basic profit
        const totalProfit = totalValue - totalInitialValue;
        const profitPercentage = totalInitialValue > 0 ? (totalProfit / totalInitialValue) * 100 : 0;
        
        // Set the specific variables for the metal investments page
        const pageData = {
            user: req.session.user,
            investmentType: 'metal',
            investmentTypeDisplay: 'Метали',
            investmentTypeColor: '#f39c12',
            initialData: {
                totalValue: totalValue.toFixed(2),
                totalProfit: totalProfit.toFixed(2),
                profitPercentage: profitPercentage.toFixed(2),
                investmentCount: metalInvestments.length
            }
        };
        
        res.render("investments", pageData);
    } catch (error) {
        console.error("Error fetching metal investments:", error);
        // Render with default values if error
        res.render("investments", {
            user: req.session.user,
            investmentType: 'metal',
            investmentTypeDisplay: 'Метали',
            investmentTypeColor: '#f39c12',
            initialData: {
                totalValue: '0.00',
                totalProfit: '0.00',
                profitPercentage: '0.00',
                investmentCount: 0
            }
        });
    }
});

module.exports = router;