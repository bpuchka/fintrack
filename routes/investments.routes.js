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

// Get investments by type
router.get("/type/:type", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const type = req.params.type;
        
        // Validate investment type
        if (!['bank', 'crypto', 'stock', 'metal'].includes(type)) {
            return res.status(400).json({ success: false, message: "Невалиден тип инвестиция" });
        }
        
        // Query to get user investments by type
        const [investments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type = ? ORDER BY purchase_date DESC`, 
            [userId, type]
        );
        
        res.json({ success: true, investments });
    } catch (error) {
        console.error("Error fetching investments by type:", error);
        res.status(500).json({ success: false, message: "Грешка при зареждане на инвестициите" });
    }
});

// Add new investment
router.post("/", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { type, date, notes, currency } = req.body;
        
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
            
            // Handle very small quantities (for crypto especially)
            let quantity = parseFloat(amount);
            if (!amount || isNaN(quantity) || quantity <= 0) {
                return res.status(422).json({ success: false, message: "Невалидно количество" });
            }
            
            if (!price || isNaN(price) || price <= 0) {
                return res.status(422).json({ success: false, message: "Невалидна цена" });
            }
            
            // Add type-specific data
            insertData = {
                ...insertData,
                symbol: symbol,
                quantity: quantity,
                purchase_price: price,
                // Include currency if provided (for non-bank investments)
                currency: currency || 'BGN'
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

    // Helper function to calculate months between two dates
    function monthsBetween(date1, date2) {
        const months = (date2.getFullYear() - date1.getFullYear()) * 12;
        return months + date2.getMonth() - date1.getMonth();
    }

    // Calculate portfolio summary with accurate percentage change
    router.get("/summary", requireAuth, async (req, res) => {
        try {
        const userId = req.session.user.id;
        
        // Get all user investments directly from the database
        const [investments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ?`, 
            [userId]
        );
        
        // Get latest price data for all symbols
        const [latestPrices] = await pool.query(`
            SELECT ip1.* 
            FROM investment_prices ip1
            INNER JOIN (
                SELECT symbol, MAX(timestamp) as max_timestamp
                FROM investment_prices
                GROUP BY symbol
            ) ip2 ON ip1.symbol = ip2.symbol AND ip1.timestamp = ip2.max_timestamp
        `);
        
        // Create a lookup map for prices
        const priceMap = {};
        latestPrices.forEach(price => {
            priceMap[price.symbol] = price.price;
        });
        
        // Define currency conversion rates to BGN
        const currencyRates = {
            'BGN': 1,      // Base currency
            'USD': 1.79,   // USD to BGN (fallback value)
            'EUR': 1.96,   // EUR to BGN (fallback value)
            'GBP': 2.30    // GBP to BGN (fallback value)
        };
        
        // Try to get up-to-date currency rates if available in the price data
        latestPrices.forEach(price => {
            if (price.asset_type === 'forex') {
            if (price.symbol === 'USD') currencyRates['USD'] = price.price;
            if (price.symbol === 'EUR') currencyRates['EUR'] = price.price;
            if (price.symbol === 'GBP') currencyRates['GBP'] = price.price;
            }
        });
        
        // Initialize summary object
        const summary = {
            totalInitialValue: 0,
            totalCurrentValue: 0,
            totalProfit: 0,
            profitPercentage: 0,
            monthlyProfit: 0,
            byType: {
            bank: { initialAmount: 0, currentAmount: 0, percentage: 0 },
            crypto: { initialAmount: 0, currentAmount: 0, percentage: 0 },
            stock: { initialAmount: 0, currentAmount: 0, percentage: 0 },
            metal: { initialAmount: 0, currentAmount: 0, percentage: 0 }
            }
        };
        
        // Process investments to calculate values
        const processedInvestments = investments.map(investment => {
            // Convert string values to numbers for calculations
            const quantity = parseFloat(investment.quantity);
            const purchasePrice = parseFloat(investment.purchase_price);
            const interestRate = investment.interest_rate ? parseFloat(investment.interest_rate) : 0;
            
            // Get currency conversion rate
            const currency = investment.currency || 'BGN';
            const currencyRate = currencyRates[currency] || 1;
            
            // Calculate initial investment value in BGN
            let initialValueBGN = quantity * purchasePrice * currencyRate;
            
            // Calculate current value based on investment type
            let currentValueBGN = initialValueBGN; // Default if no better data
            
            if (investment.investment_type === 'bank') {
            // For bank deposits, calculate interest
            const monthsHeld = monthsBetween(new Date(investment.purchase_date), new Date());
            let interestMultiplier = 1;
            
            // Apply interest based on type
            switch(investment.interest_type || 'yearly') {
                case 'daily':
                interestMultiplier = 1 + ((interestRate / 100) * (monthsHeld * 30) / 365);
                break;
                case 'monthly_1':
                interestMultiplier = 1 + ((interestRate / 100) * monthsHeld / 12);
                break;
                case 'monthly_3':
                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 3) / 4);
                break;
                case 'monthly_6':
                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 6) / 2);
                break;
                case 'yearly':
                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 12));
                break;
            }
            
            // Apply interest to value
            currentValueBGN = quantity * interestMultiplier * currencyRate;
            } else {
            // For other investment types, use latest price data
            if (priceMap[investment.symbol]) {
                const currentPrice = parseFloat(priceMap[investment.symbol]);
                const currentValueOrigCurrency = quantity * currentPrice;
                currentValueBGN = currentValueOrigCurrency * currencyRate;
            }
            }
            
            // Update summary totals
            summary.totalInitialValue += initialValueBGN;
            summary.totalCurrentValue += currentValueBGN;
            
            // Update type-specific totals
            if (summary.byType[investment.investment_type]) {
            summary.byType[investment.investment_type].initialAmount += initialValueBGN;
            summary.byType[investment.investment_type].currentAmount += currentValueBGN;
            }
            
            // Return processed investment data
            return {
            ...investment,
            initialValueBGN,
            currentValueBGN,
            profit: currentValueBGN - initialValueBGN,
            profitPercentage: initialValueBGN > 0 ? ((currentValueBGN / initialValueBGN) - 1) * 100 : 0
            };
        });
        
        // Calculate overall profit and percentage
        summary.totalProfit = summary.totalCurrentValue - summary.totalInitialValue;
        summary.profitPercentage = summary.totalInitialValue > 0 ? 
            ((summary.totalCurrentValue / summary.totalInitialValue) - 1) * 100 : 0;
        
        // Calculate distribution percentages by type
        if (summary.totalCurrentValue > 0) {
            for (const type in summary.byType) {
            const typeData = summary.byType[type];
            typeData.percentage = (typeData.currentAmount / summary.totalCurrentValue) * 100;
            }
        }
        
        // Simplify the data structure to match the expected format in the frontend
        const simplifiedSummary = {
            totalInvested: summary.totalInitialValue,
            totalCurrentValue: summary.totalCurrentValue,
            profitPercentage: summary.profitPercentage,
            monthlyProfit: summary.totalProfit / 3, // Simple estimation
            byType: {
            bank: { amount: summary.byType.bank.currentAmount, percentage: summary.byType.bank.percentage },
            crypto: { amount: summary.byType.crypto.currentAmount, percentage: summary.byType.crypto.percentage },
            stock: { amount: summary.byType.stock.currentAmount, percentage: summary.byType.stock.percentage },
            metal: { amount: summary.byType.metal.currentAmount, percentage: summary.byType.metal.percentage }
            }
        };
        
        res.json({
            success: true,
            summary: simplifiedSummary,
            investments: processedInvestments
        });
        } catch (error) {
        console.error("Error calculating portfolio summary:", error);
        res.status(500).json({ success: false, message: "Error calculating portfolio data" });
        }
    });

module.exports = router;