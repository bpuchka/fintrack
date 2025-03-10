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
        
        // Define hardcoded exchange rates (BGN to other currencies)
        // Only used as fallback if currency prices are not available
        const currencyRates = {
            'USD': 1,      // USD is the base currency
            'BGN': 1.78,   // Default fallback rate (USD to BGN)
            'EUR': 0.91,   // Default fallback rate (USD to EUR)
            'GBP': 0.77    // Default fallback rate (USD to GBP)
        };
        
        // Fetch latest prices from investment_prices table
        // This includes forex prices (USD/EUR, etc.) that we can use for currency conversion
        let priceMap = {};
        try {
            const [prices] = await pool.query(`
                SELECT ip.symbol, ip.price, ip.asset_type
                FROM investment_prices ip
                INNER JOIN (
                    SELECT symbol, MAX(timestamp) as max_timestamp
                    FROM investment_prices
                    GROUP BY symbol
                ) latest
                ON ip.symbol = latest.symbol 
                AND ip.timestamp = latest.max_timestamp
            `);
            
            // Create price lookup map
            prices.forEach(price => {
                priceMap[price.symbol] = {
                    price: parseFloat(price.price),
                    assetType: price.asset_type
                };
            });
            
            // Add special handling for USD/BGN conversion if available in price data
            if (priceMap['BGN'] && priceMap['BGN'].price > 0) {
                // USD to BGN rate is available directly
                currencyRates['USD'] = priceMap['BGN'].price;
            }
            
            // Add special handling for EUR/BGN conversion if available in price data
            if (priceMap['EUR'] && priceMap['EUR'].price > 0) {
                // USD to EUR rate, need to convert to BGN
                const usdToEur = priceMap['EUR'].price;
                if (currencyRates['USD']) {
                    // EUR to BGN = (USD to BGN) / (USD to EUR)
                    currencyRates['EUR'] = currencyRates['USD'] / usdToEur;
                }
            }
            
            // Similar for other currencies if they exist in your price data
            
        } catch (error) {
            console.log("Price data not available:", error.message);
            // Continue with hardcoded exchange rates
        }
        
        // Process investments and calculate current values
        const processedInvestments = investments.map(investment => {
            const result = { 
                ...investment,
                // Ensure numeric types for calculations
                quantity: parseFloat(investment.quantity || 0),
                purchase_price: parseFloat(investment.purchase_price || 0),
                interest_rate: investment.interest_rate ? parseFloat(investment.interest_rate) : 0
            };
            
            // Determine investment type if not explicitly stored
            if (!investment.investment_type) {
                if (investment.symbol && investment.symbol.startsWith('BANK_')) {
                    result.investment_type = 'bank';
                } else if (['BTC', 'ETH', 'USDT', 'SOL', 'XRP'].includes(investment.symbol)) {
                    result.investment_type = 'crypto';
                } else if (['AAPL', 'TSLA', 'NVDA'].includes(investment.symbol)) {
                    result.investment_type = 'stock';
                } else if (['GLD', 'SLV'].includes(investment.symbol)) {
                    result.investment_type = 'etf';
                } else {
                    result.investment_type = 'other';
                }
            }
            
            // Extract currency from bank symbol if needed
            if (result.investment_type === 'bank' && !result.currency && result.symbol && result.symbol.includes('_')) {
                result.currency = result.symbol.split('_')[1];
            }
            
            // Ensure we have a currency for calculation purposes
            const currency = result.currency || 'BGN';
            // Use our hardcoded rates for currency conversion
            const exchangeRate = currencyRates[currency] || 1;
            
            // Format display values based on investment type
            if (result.investment_type === 'bank') {
                // Process bank deposit
                result.displayType = 'Банков влог';
                result.displayName = `${currency} депозит`;
                result.displayAmount = `${result.quantity.toFixed(2)} ${currency}`;
                result.displayRate = `${result.interest_rate || 0}%`;
                
                // Calculate current value based on interest
                let monthsHeld = monthsBetween(new Date(result.purchase_date), new Date());
                if (isNaN(monthsHeld)) monthsHeld = 0; // Safeguard against invalid dates
                
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
                
                // Convert to BGN using our exchange rate
                result.currentValue = result.quantity * interestMultiplier * exchangeRate;
                result.profit = result.currentValue - (result.quantity * exchangeRate);
                result.profitPercentage = ((interestMultiplier) - 1) * 100;
            } else {
                // Process crypto, stock, or etf investment
                result.displayType = getDisplayType(result.investment_type);
                result.displayName = result.symbol;
                result.displayAmount = `${result.quantity.toFixed(2)} ${result.symbol}`;
                
                // Get current price or use purchase price as fallback
                let currentPrice = result.purchase_price;
                if (priceMap[result.symbol]) {
                    currentPrice = priceMap[result.symbol].price;
                }
                
                // Calculate current value based on latest price
                result.currentValue = result.quantity * currentPrice;
                result.profit = result.currentValue - (result.quantity * result.purchase_price);
                result.profitPercentage = result.purchase_price > 0 ? 
                    ((currentPrice / result.purchase_price) - 1) * 100 : 0;
                
                // Convert to BGN if prices are in USD (which they are according to your description)
                if (currencyRates['USD'] && currencyRates['USD'] > 0) {
                    result.currentValue *= currencyRates['USD'];
                }
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
                etf: { amount: 0, percentage: 0 }
            }
        };
        
        // Calculate totals
        processedInvestments.forEach(inv => {
            // For banks, calculate initial investment in BGN
            const currency = inv.currency || 'BGN';
            const exchangeRate = currencyRates[currency] || 1;
            
            // Calculate the initial investment in BGN
            const initialInvestment = inv.investment_type === 'bank' 
                ? inv.quantity * exchangeRate 
                : (inv.quantity * inv.purchase_price * (currencyRates['USD'] || 1));
                
            summary.totalInvestment += initialInvestment;
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
        
        // Update the user's portfolio value in the session
        if (req.session.user) {
            req.session.user.portfolioValue = summary.totalCurrentValue.toFixed(2);
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
        etf: 'ETFs',
        other: 'Други'
    };
    return typeMap[type] || type;
}

module.exports = router;