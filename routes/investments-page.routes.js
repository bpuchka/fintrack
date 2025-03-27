// routes/investments-page.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const Price = require("../models/price.model");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Helper function to get exchange rates
async function getExchangeRate(fromCurrency, toCurrency = 'BGN') {
    try {
        // Try to get from the database first
        const [rates] = await pool.query(`
            SELECT price FROM investment_prices 
            WHERE symbol = ? AND asset_type = 'forex'
            ORDER BY timestamp DESC LIMIT 1
        `, [fromCurrency]);
        
        if (rates.length > 0) {
            return parseFloat(rates[0].price);
        }
        
        // Fallback to hardcoded rates
        const defaultRates = {
            'USD': 1.79, // USD to BGN
            'EUR': 1.96, // EUR to BGN
            'GBP': 2.30  // GBP to BGN
        };
        
        return defaultRates[fromCurrency] || 1.0;
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        
        // Return default values if query fails
        const defaultRates = {
            'USD': 1.79, // USD to BGN
            'EUR': 1.96, // EUR to BGN
            'GBP': 2.30  // GBP to BGN
        };
        
        return defaultRates[fromCurrency] || 1.0;
    }
}

// Helper function to calculate months between two dates
function monthsBetween(date1, date2) {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
}

// Main investments page - redirects to portfolio
router.get("/", requireAuth, (req, res) => {
    res.redirect('/portfolio');
});

// Bank investments page
router.get("/bank", requireAuth, async (req, res) => {
    try {
        // Render the page with basic data first
        // The actual data will be loaded via AJAX
        res.render("investments", {
            user: req.session.user,
            investmentType: 'bank',
            investmentTypeDisplay: 'Банкови влогове',
            investmentTypeColor: '#6dc0e0'
        });
    } catch (error) {
        console.error("Error rendering bank investments page:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading bank investments page" },
            user: req.session.user
        });
    }
});

// Crypto investments page
router.get("/crypto", requireAuth, async (req, res) => {
    try {
        // Render the page with basic data first
        // The actual data will be loaded via AJAX
        res.render("investments", {
            user: req.session.user,
            investmentType: 'crypto',
            investmentTypeDisplay: 'Криптовалути',
            investmentTypeColor: '#8e44ad'
        });
    } catch (error) {
        console.error("Error rendering crypto investments page:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading crypto investments page" },
            user: req.session.user
        });
    }
});

// Stock investments page
router.get("/stocks", requireAuth, async (req, res) => {
    try {
        // Render the page with basic data first
        // The actual data will be loaded via AJAX
        res.render("investments", {
            user: req.session.user,
            investmentType: 'stock',
            investmentTypeDisplay: 'Акции',
            investmentTypeColor: '#27ae60'
        });
    } catch (error) {
        console.error("Error rendering stock investments page:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading stock investments page" },
            user: req.session.user
        });
    }
});

// Metal investments page
router.get("/metals", requireAuth, async (req, res) => {
    try {
        // Render the page with basic data first
        // The actual data will be loaded via AJAX
        res.render("investments", {
            user: req.session.user,
            investmentType: 'metal',
            investmentTypeDisplay: 'Метали',
            investmentTypeColor: '#f39c12'
        });
    } catch (error) {
        console.error("Error rendering metal investments page:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading metal investments page" },
            user: req.session.user
        });
    }
});

// API endpoint for getting investment data for specific type
router.get("/api/:type", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const investmentType = req.params.type;
        
        // Validate investment type
        const validTypes = ['bank', 'crypto', 'stock', 'metal'];
        if (!validTypes.includes(investmentType)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid investment type" 
            });
        }
        
        let investments = [];
        
        // Fetch investments based on type
        if (investmentType === 'bank') {
            // For bank deposits
            const [bankInvestments] = await pool.query(`
                SELECT 
                    id,
                    user_id,
                    'bank' AS investment_type,
                    CONCAT('BANK_', currency) AS symbol,
                    amount AS quantity,
                    1 AS purchase_price,
                    currency,
                    interest_rate,
                    interest_type,
                    investment_date AS purchase_date,
                    notes
                FROM bank_investment 
                WHERE user_id = ? 
                ORDER BY investment_date DESC
            `, [userId]);
            
            investments = bankInvestments;
        } else {
            // For other investment types
            const [regularInvestments] = await pool.query(`
                SELECT * FROM user_investments 
                WHERE user_id = ? AND investment_type = ? 
                ORDER BY purchase_date DESC
            `, [userId, investmentType]);
            
            investments = regularInvestments;
        }
        
        // Get all latest prices
        const [latestPrices] = await pool.query(`
            SELECT ip1.* 
            FROM investment_prices ip1
            INNER JOIN (
                SELECT symbol, MAX(timestamp) as max_timestamp
                FROM investment_prices
                GROUP BY symbol
            ) ip2 ON ip1.symbol = ip2.symbol AND ip1.timestamp = ip2.max_timestamp
        `);
        
        // Create a price lookup structure
        const priceMap = {};
        latestPrices.forEach(price => {
            priceMap[price.symbol] = {
                price: parseFloat(price.price),
                assetType: price.asset_type
            };
        });
        
        // Define default exchange rates
        const currencyRates = {
            'BGN': 1,
            'USD': 1.79,
            'EUR': 1.96,
            'GBP': 2.30
        };
        
        // Try to get up-to-date currency rates
        for (const currency in currencyRates) {
            if (currency !== 'BGN') {
                currencyRates[currency] = await getExchangeRate(currency);
            }
        }
        
        // Process investments to calculate current values
        const processedInvestments = await Promise.all(investments.map(async (investment) => {
            // Base result with investment data
            const result = { ...investment };
            
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
            let currentValueOrigCurrency = quantity * purchasePrice; // Default
            
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
                
                // Apply interest to value in original currency
                currentValueOrigCurrency = quantity * interestMultiplier;
                // Convert to BGN
                currentValueBGN = currentValueOrigCurrency * currencyRate;
            } else {
                // For other investment types, use latest price data
                if (priceMap[investment.symbol]) {
                    const currentPrice = priceMap[investment.symbol].price;
                    currentValueOrigCurrency = quantity * currentPrice;
                    currentValueBGN = currentValueOrigCurrency * currencyRate;
                }
            }
            
            // Calculate profit
            const profitOrigCurrency = currentValueOrigCurrency - (quantity * purchasePrice);
            const profitBGN = currentValueBGN - initialValueBGN;
            
            // Calculate percentage
            const initialValueOrigCurrency = quantity * purchasePrice;
            const profitPercentage = initialValueOrigCurrency > 0 ? 
                (profitOrigCurrency / initialValueOrigCurrency) * 100 : 0;
            
            // Get price history if needed
            let priceHistory = [];
            if (investment.investment_type !== 'bank') {
                try {
                    priceHistory = await Price.getBySymbol(investment.symbol);
                } catch (err) {
                    console.warn(`No price history found for ${investment.symbol}`);
                }
            }
            
            // Calculate monthly profit
            let monthlyProfit = 0;
            let monthlyProfitPercentage = 0;
            
            if (investment.investment_type === 'bank') {
                // For bank investments, estimate monthly interest
                const annualInterest = interestRate / 100;
                monthlyProfit = quantity * (annualInterest / 12);
                monthlyProfitPercentage = (annualInterest / 12) * 100;
            } else if (priceHistory.length >= 2) {
                // Sort price history (newest first)
                const sortedHistory = [...priceHistory].sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                
                // Get current price
                const currentPrice = sortedHistory[0].price;
                
                // Find price closest to 30 days ago
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                let oldestPrice = sortedHistory[sortedHistory.length - 1].price;
                
                for (const item of sortedHistory) {
                    const itemDate = new Date(item.timestamp);
                    if (itemDate <= thirtyDaysAgo) {
                        oldestPrice = item.price;
                        break;
                    }
                }
                
                // Calculate monthly change
                const valueNow = quantity * currentPrice;
                const valueThen = quantity * oldestPrice;
                
                monthlyProfit = valueNow - valueThen;
                monthlyProfitPercentage = valueThen !== 0 ? ((valueNow - valueThen) / valueThen) * 100 : 0;
            }
            
            return {
                ...result,
                current_value: currentValueOrigCurrency,
                current_value_bgn: currentValueBGN,
                profit: profitOrigCurrency,
                profit_bgn: profitBGN,
                profit_percentage: profitPercentage,
                monthly_profit: monthlyProfit,
                monthly_profit_percentage: monthlyProfitPercentage
            };
        }));
        
        // Calculate summary data
        let totalInitialValue = 0;
        let totalCurrentValue = 0;
        let totalProfit = 0;
        
        processedInvestments.forEach(inv => {
            if (inv.investment_type === 'bank') {
                totalInitialValue += parseFloat(inv.quantity) * currencyRates[inv.currency || 'BGN'];
            } else {
                totalInitialValue += parseFloat(inv.quantity) * parseFloat(inv.purchase_price) * currencyRates[inv.currency || 'BGN'];
            }
            
            totalCurrentValue += inv.current_value_bgn;
            totalProfit += inv.profit_bgn;
        });
        
        const profitPercentage = totalInitialValue > 0 ? 
            (totalProfit / totalInitialValue) * 100 : 0;
        
        // Create summary object
        const summary = {
            totalInvestment: totalInitialValue,
            totalCurrentValue: totalCurrentValue,
            totalProfit: totalProfit,
            profitPercentage: profitPercentage
        };
        
        // Return data
        res.json({
            success: true,
            investments: processedInvestments,
            summary: summary
        });
    } catch (error) {
        console.error(`Error fetching ${req.params.type} investments:`, error);
        res.status(500).json({ 
            success: false, 
            message: `Error fetching ${req.params.type} investments` 
        });
    }
});

module.exports = router;