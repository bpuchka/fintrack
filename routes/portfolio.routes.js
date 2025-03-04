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

// Helper function to calculate months between two dates
function monthsBetween(date1, date2) {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
}

// Get user portfolio data
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Fetch all investments for the user
        const [investments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? ORDER BY purchase_date DESC`, 
            [userId]
        );
        
        // Fetch latest pricing data for calculations (if you have a prices table)
        let priceMap = {};
        try {
            const [prices] = await pool.query(
                `SELECT symbol, price FROM investment_prices 
                 WHERE (symbol, timestamp) IN (
                    SELECT symbol, MAX(timestamp) 
                    FROM investment_prices 
                    GROUP BY symbol
                 )`
            );
            
            // Create a price lookup map
            prices.forEach(price => {
                priceMap[price.symbol] = price.price;
            });
        } catch (error) {
            console.log("Price data not available:", error.message);
            // Continue without price data
        }
        
        // Process investments and calculate current values
        const processedInvestments = investments.map(investment => {
            const result = { 
                ...investment,
                // Ensure numeric types for calculations
                quantity: parseFloat(investment.quantity),
                purchase_price: parseFloat(investment.purchase_price),
                interest_rate: investment.interest_rate ? parseFloat(investment.interest_rate) : 0
            };
            
            // Determine investment type if not explicitly stored
            if (!investment.investment_type) {
                if (investment.symbol.startsWith('BANK_')) {
                    result.investment_type = 'bank';
                    
                    // Extract currency and rate from symbol if not stored separately
                    if (!investment.currency && investment.symbol.includes('_')) {
                        const parts = investment.symbol.split('_');
                        if (parts.length > 1) {
                            result.currency = parts[1];
                        }
                        if (parts.length > 2) {
                            result.interest_rate = parseFloat(parts[2]);
                        }
                    }
                } else if (['BTC', 'ETH', 'USDT', 'SOL', 'XRP'].includes(investment.symbol)) {
                    result.investment_type = 'crypto';
                } else if (['AAPL', 'TSLA', 'NVDA'].includes(investment.symbol)) {
                    result.investment_type = 'stock';
                } else if (['GLD', 'SLV'].includes(investment.symbol)) {
                    result.investment_type = 'metal';
                } else {
                    result.investment_type = 'other';
                }
            }
            
            // Format display values based on investment type
            if (result.investment_type === 'bank') {
                // Process bank deposit
                result.displayType = 'Банков влог';
                result.displayName = `${result.currency || 'BGN'} депозит`;
                result.displayAmount = `${parseFloat(result.quantity).toFixed(2)} ${result.currency || 'BGN'}`;
                result.displayRate = `${result.interest_rate || 0}%`;
                
                // Calculate current value based on interest
                let monthsHeld = monthsBetween(new Date(result.purchase_date), new Date());
                let interestMultiplier = 1;
                
                const interestRate = result.interest_rate || 0;
                
                // Default to yearly if not specified
                const interestType = result.interest_type || 'yearly';
                
                switch(interestType) {
                    case 'daily':
                        // Simplified daily calculation (30 days per month)
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
                
                result.currentValue = result.quantity * interestMultiplier;
                result.profit = result.currentValue - result.quantity;
                result.profitPercentage = ((result.currentValue / result.quantity) - 1) * 100;
            } else {
                // Process crypto, stock, or metal investment
                result.displayType = getDisplayType(result.investment_type);
                result.displayName = result.symbol;
                result.displayAmount = `${result.quantity.toFixed(2)} ${result.symbol}`;
                
                // Calculate current value based on latest price
                const currentPrice = priceMap[result.symbol] || result.purchase_price;
                result.currentValue = result.quantity * currentPrice;
                result.profit = result.currentValue - (result.quantity * result.purchase_price);
                result.profitPercentage = ((currentPrice / result.purchase_price) - 1) * 100;
            }
            
            return result;
        });
        
        // Calculate summary statistics
        const summary = {
            totalInvestment: 0,
            totalCurrentValue: 0,
            totalProfit: 0,
            profitPercentage: 0,
            monthlyProfit: 0,
            byType: {
                bank: { amount: 0, percentage: 0 },
                crypto: { amount: 0, percentage: 0 },
                stock: { amount: 0, percentage: 0 },
                metal: { amount: 0, percentage: 0 }
            }
        };
        
        // Calculate totals
        processedInvestments.forEach(inv => {
            summary.totalInvestment += inv.investment_type === 'bank' ? 
                inv.quantity : (inv.quantity * inv.purchase_price);
            summary.totalCurrentValue += inv.currentValue;
            
            // Add to type-specific totals
            if (summary.byType[inv.investment_type]) {
                summary.byType[inv.investment_type].amount += inv.currentValue;
            }
        });
        
        // Calculate profit and percentages
        summary.totalProfit = summary.totalCurrentValue - summary.totalInvestment;
        summary.profitPercentage = summary.totalInvestment > 0 ? 
            ((summary.totalCurrentValue / summary.totalInvestment) - 1) * 100 : 0;
        
        // Estimate monthly profit (simplified)
        summary.monthlyProfit = summary.totalProfit / 3; // Just a rough estimate
        
        // Calculate percentage distribution by type
        if (summary.totalCurrentValue > 0) {
            for (const type in summary.byType) {
                summary.byType[type].percentage = 
                    (summary.byType[type].amount / summary.totalCurrentValue) * 100;
            }
        }
        
        res.json({
            success: true,
            investments: processedInvestments,
            summary: summary
        });
    } catch (error) {
        console.error("Error fetching portfolio:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching portfolio data" 
        });
    }
});

// Helper function to get display type name
function getDisplayType(type) {
    const typeMap = {
        bank: 'Банков влог',
        crypto: 'Крипто',
        stock: 'Акции',
        metal: 'Метали',
        other: 'Други'
    };
    return typeMap[type] || type;
}

module.exports = router;