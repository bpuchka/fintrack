const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const BankInvestment = require("../models/bank.investment.model");

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
        
        // Fetch regular investments from user_investments
        const [regularInvestments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type != 'bank' ORDER BY purchase_date DESC`, 
            [userId]
        );
        
        // Fetch bank investments from bank_investment table
        const [bankInvestmentsRaw] = await pool.query(
            `SELECT 
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
            ORDER BY investment_date DESC`, 
            [userId]
        );
        
        // Combine both investment types
        const investments = [...regularInvestments, ...bankInvestmentsRaw];
        
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

/**
 * Route for the portfolio history page
 */
router.get("/history", requireAuth, async (req, res) => {
    try {
        res.render("portfolio-history", { user: req.session.user });
    } catch (error) {
        console.error("Error rendering portfolio history:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading portfolio history" },
            user: req.session.user
        });
    }
});

/**
 * API endpoint to get portfolio history data
 */
router.get("/history/data", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get regular investments from user_investments
        const [regularInvestments] = await pool.query(
            `SELECT * FROM user_investments WHERE user_id = ? AND investment_type != 'bank' ORDER BY purchase_date DESC`, 
            [userId]
        );
        
        // Get bank investments
        const [bankInvestmentsRaw] = await pool.query(
            `SELECT 
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
            ORDER BY investment_date DESC`, 
            [userId]
        );
        
        // Combine both types of investments
        const investments = [...regularInvestments, ...bankInvestmentsRaw];
        
        // Get all historical price data
        const [priceHistory] = await pool.query(`
            SELECT * FROM investment_prices 
            ORDER BY timestamp ASC
        `);
        
        // Create a price lookup structure
        const priceMap = {};
        priceHistory.forEach(price => {
            if (!priceMap[price.symbol]) {
                priceMap[price.symbol] = [];
            }
            priceMap[price.symbol].push({
                timestamp: price.timestamp,
                price: parseFloat(price.price)
            });
        });
        
        // Define default exchange rates (fallback)
        const currencyRates = {
            'BGN': 1,
            'USD': 1.79,
            'EUR': 1.96,
            'GBP': 2.30
        };
        
        // Process investments with performance data
        const processedInvestments = investments.map(investment => {
            // Format date for display
            const purchaseDate = new Date(investment.purchase_date);
            
            // Calculate current value based on investment type
            let currentValue = 0;
            let profitPercentage = 0;
            let initialInvestment = 0;
            
            if (investment.investment_type === 'bank') {
                // For bank deposits, calculate interest
                const monthsHeld = monthsBetween(purchaseDate, new Date());
                let interestMultiplier = 1;
                
                // Apply interest based on type
                const interestRate = parseFloat(investment.interest_rate || 0);
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
                
                initialInvestment = parseFloat(investment.quantity);
                currentValue = initialInvestment * interestMultiplier;
                profitPercentage = (interestMultiplier - 1) * 100;
            } else {
                // For other investments, use latest price or purchase price as fallback
                const latestPrice = getLatestPrice(priceMap, investment.symbol) || parseFloat(investment.purchase_price);
                
                initialInvestment = parseFloat(investment.quantity) * parseFloat(investment.purchase_price);
                currentValue = parseFloat(investment.quantity) * latestPrice;
                
                // Calculate profit percentage
                if (initialInvestment > 0) {
                    profitPercentage = ((currentValue / initialInvestment) - 1) * 100;
                }
            }
            
            return {
                ...investment,
                initial_investment: initialInvestment,
                current_value: currentValue,
                profit_percentage: profitPercentage
            };
        });
        
        // Generate chart data
        const chartData = generateChartData(processedInvestments, priceMap);
        
        res.json({
            success: true,
            investments: processedInvestments,
            chartData
        });
    } catch (error) {
        console.error("Error fetching portfolio history data:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching portfolio history data" 
        });
    }
});

/**
 * Helper function to get the latest price for a symbol
 */
function getLatestPrice(priceMap, symbol) {
    if (!priceMap[symbol] || priceMap[symbol].length === 0) {
        return null;
    }
    
    // Get the most recent price
    const sortedPrices = [...priceMap[symbol]].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    return sortedPrices[0].price;
}

/**
 * Generate chart data from investments
 */
function generateChartData(investments, priceMap) {
    // Define time spans for the chart (e.g., monthly for the past year)
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    // Generate monthly data points
    const monthlyLabels = [];
    const monthlyData = {
        bank: [],
        crypto: [],
        stock: [],
        metal: []
    };
    
    // Add the initial month
    let currentDate = new Date(oneYearAgo);
    while (currentDate <= now) {
        // Format the month for display
        const monthLabel = currentDate.toLocaleDateString('bg-BG', { 
            year: 'numeric', 
            month: 'short'
        });
        
        monthlyLabels.push(monthLabel);
        
        // Initialize values for each asset type
        monthlyData.bank.push(0);
        monthlyData.crypto.push(0);
        monthlyData.stock.push(0);
        monthlyData.metal.push(0);
        
        // Move to next month
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    
    // Calculate value for each investment at each time point
    investments.forEach(investment => {
        const purchaseDate = new Date(investment.purchase_date);
        
        // Skip investments purchased after our chart's end date
        if (purchaseDate > now) return;
        
        // Find the starting index for this investment
        let startIndex = 0;
        while (startIndex < monthlyLabels.length) {
            const monthDate = getDateFromMonthLabel(monthlyLabels[startIndex]);
            if (purchaseDate <= monthDate) break;
            startIndex++;
        }
        
        // If the investment was purchased before our chart's start date, adjust
        if (startIndex >= monthlyLabels.length) return;
        
        // Calculate the value at each point
        for (let i = startIndex; i < monthlyLabels.length; i++) {
            const pointDate = getDateFromMonthLabel(monthlyLabels[i]);
            let valueAtPoint = 0;
            
            if (investment.investment_type === 'bank') {
                // Calculate bank deposit value with interest
                const monthsHeld = monthsBetween(purchaseDate, pointDate);
                let interestMultiplier = 1;
                
                const interestRate = parseFloat(investment.interest_rate || 0);
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
                
                valueAtPoint = parseFloat(investment.quantity) * interestMultiplier;
            } else {
                // For other assets, find the closest price to this date
                const priceAtPoint = getPriceAtDate(priceMap, investment.symbol, pointDate) || 
                                    parseFloat(investment.purchase_price);
                
                valueAtPoint = parseFloat(investment.quantity) * priceAtPoint;
            }
            
            // Add to the appropriate asset type
            monthlyData[investment.investment_type][i] += valueAtPoint;
        }
    });
    
    return {
        labels: monthlyLabels,
        bank: monthlyData.bank,
        crypto: monthlyData.crypto,
        stock: monthlyData.stock,
        metal: monthlyData.metal
    };
}

/**
 * Helper function to get a date from a month label
 */
function getDateFromMonthLabel(monthLabel) {
    // Parse the label format (e.g., "янв. 2023")
    const parts = monthLabel.split(' ');
    const month = getMonthNumber(parts[0]);
    const year = parseInt(parts[1]);
    
    return new Date(year, month, 1);
}

/**
 * Helper function to get month number from Bulgarian short name
 */
function getMonthNumber(monthShort) {
    const monthMap = {
        'яну': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'юни': 5,
        'юли': 6, 'авг': 7, 'сеп': 8, 'окт': 9, 'ное': 10, 'дек': 11
    };
    
    // Remove any dots and convert to lowercase
    const cleanMonth = monthShort.replace('.', '').toLowerCase();
    
    // Find the matching month
    for (const key in monthMap) {
        if (cleanMonth.startsWith(key)) {
            return monthMap[key];
        }
    }
    
    // Default to January if not found
    return 0;
}

/**
 * Get the price closest to a specific date
 */
function getPriceAtDate(priceMap, symbol, targetDate) {
    if (!priceMap[symbol] || priceMap[symbol].length === 0) {
        return null;
    }
    
    // Find the price closest to the target date
    let closestPrice = null;
    let minTimeDiff = Infinity;
    
    for (const pricePoint of priceMap[symbol]) {
        const priceDate = new Date(pricePoint.timestamp);
        const timeDiff = Math.abs(priceDate - targetDate);
        
        if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestPrice = pricePoint.price;
        }
    }
    
    return closestPrice;
}

module.exports = router;