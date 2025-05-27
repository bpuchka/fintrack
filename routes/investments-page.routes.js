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


// Get a single investment by ID
router.get("/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user.id;
      const investmentId = req.params.id;
      
      console.log(`Fetching investment ID: ${investmentId} for user ID: ${userId}`);
      
      // First check if this is a regular investment
      const [investments] = await pool.query(
        "SELECT * FROM user_investments WHERE id = ?", 
        [investmentId]
      );
      
      if (investments.length > 0) {
        // Investment found, now check if it belongs to the user
        const investment = investments[0];
        
        console.log(`Found investment: ${JSON.stringify(investment)}`);
        
        if (investment.user_id == userId) {
          return res.json({
            success: true,
            data: investment
          });
        } else {
          console.log(`Permission denied: Investment belongs to user ${investment.user_id}, not ${userId}`);
        }
      } else {
        console.log(`Investment with ID ${investmentId} not found in user_investments table`);
      }
      
      // If we got here, it wasn't found in user_investments, so try bank_investment table
      const [bankInvestments] = await pool.query(
        "SELECT *, investment_date AS purchase_date FROM bank_investment WHERE id = ?", 
        [investmentId]
      );
      
      if (bankInvestments.length > 0) {
        // Bank investment found, now check if it belongs to the user
        const bankInvestment = bankInvestments[0];
        
        console.log(`Found bank investment: ${JSON.stringify(bankInvestment)}`);
        
        if (bankInvestment.user_id == userId) {
          // Format bank investment to match regular investment structure
          const formattedInvestment = {
            ...bankInvestment,
            investment_type: 'bank',
            quantity: bankInvestment.amount,
            purchase_price: 1
          };
          
          return res.json({
            success: true,
            data: formattedInvestment
          });
        } else {
          console.log(`Permission denied: Bank investment belongs to user ${bankInvestment.user_id}, not ${userId}`);
        }
      } else {
        console.log(`Investment with ID ${investmentId} not found in bank_investment table either`);
      }
      
      // If we got here, the investment was not found in either table
      return res.status(404).json({ 
        success: false, 
        message: "Investment not found" 
      });
      
    } catch (error) {
      console.error("Error fetching investment:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error fetching investment data: " + error.message 
      });
    }
});

// API endpoint for getting price history data for investment type
router.get("/api/:type/price-history", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const investmentType = req.params.type;
        const timeframe = req.query.timeframe || 'month';
        
        // Validate investment type
        const validTypes = ['bank', 'crypto', 'stock', 'metal'];
        if (!validTypes.includes(investmentType)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid investment type" 
            });
        }
        
        console.log(`Fetching price history for ${investmentType} investments`);
        
        // Get user's investments for this type
        let investments = [];
        
        if (investmentType === 'bank') {
            // For bank deposits, we'll return deposit value changes over time
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
        
        if (investments.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: "No investments found for this type"
            });
        }
        
        // Get unique symbols from user's investments
        const uniqueSymbols = [...new Set(investments.map(inv => inv.symbol))];
        console.log("Unique symbols for price history:", uniqueSymbols);
        
        if (investmentType === 'bank') {
            // For bank investments, generate interest-based value progression
            const priceHistory = generateBankValueHistory(investments, timeframe);
            return res.json({
                success: true,
                data: priceHistory,
                type: 'portfolio_value'
            });
        }
        
        // For other types, fetch actual price data with improved querying
        try {
            // First, let's check what data we actually have for these symbols
            const [availableData] = await pool.query(`
                SELECT symbol, COUNT(*) as count, MIN(timestamp) as earliest, MAX(timestamp) as latest
                FROM investment_prices 
                WHERE symbol IN (${uniqueSymbols.map(() => '?').join(',')})
                GROUP BY symbol
            `, uniqueSymbols);
            
            console.log("Available price data:", availableData);
            
            if (availableData.length === 0) {
                console.log("No price data found in database for symbols:", uniqueSymbols);
                // Generate demo data for all symbols
                const demoData = generateDemoAssetPriceDataForAPI(uniqueSymbols[0] || 'AAPL', investmentType);
                return res.json({
                    success: true,
                    data: demoData,
                    type: 'demo_data',
                    symbol: uniqueSymbols[0] || 'AAPL'
                });
            }
            
            // Determine date range based on timeframe - use more flexible approach
            let dayLimit;
            switch (timeframe) {
                case 'week':
                    dayLimit = 7;
                    break;
                case 'month':
                    dayLimit = 30;
                    break;
                case '3months':
                    dayLimit = 90;
                    break;
                case 'year':
                    dayLimit = 365;
                    break;
                default:
                    dayLimit = 30;
            }
            
            if (uniqueSymbols.length === 1) {
                // Single asset - return its price history
                const symbol = uniqueSymbols[0];
                
                // Use a more flexible query that gets the most recent data points
                const [priceData] = await pool.query(`
                    SELECT timestamp, price 
                    FROM investment_prices 
                    WHERE symbol = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `, [symbol, Math.min(dayLimit, 100)]); // Limit to prevent too much data
                
                console.log(`Found ${priceData.length} price points for ${symbol}`);
                
                if (priceData.length === 0) {
                    console.log(`No price history found for ${symbol}`);
                    // Generate demo data if no real data available
                    const demoData = generateDemoAssetPriceDataForAPI(symbol, investmentType);
                    return res.json({
                        success: true,
                        data: demoData,
                        type: 'demo_data',
                        symbol: symbol
                    });
                }
                
                // Reverse the array to have oldest first (for chart display)
                const formattedData = priceData.reverse().map(row => ({
                    timestamp: row.timestamp,
                    price: parseFloat(row.price)
                }));
                
                return res.json({
                    success: true,
                    data: formattedData,
                    type: 'single_asset',
                    symbol: symbol
                });
            } else {
                // Multiple assets - calculate weighted portfolio value
                const portfolioHistory = await calculatePortfolioValueHistoryImproved(
                    investments, 
                    uniqueSymbols, 
                    dayLimit
                );
                
                if (portfolioHistory.length === 0) {
                    // Generate demo data
                    const demoData = generateDemoAssetPriceDataForAPI(uniqueSymbols[0], investmentType);
                    return res.json({
                        success: true,
                        data: demoData,
                        type: 'demo_data',
                        symbols: uniqueSymbols
                    });
                }
                
                return res.json({
                    success: true,
                    data: portfolioHistory,
                    type: 'portfolio_value',
                    symbols: uniqueSymbols
                });
            }
        } catch (dbError) {
            console.error("Database error fetching price history:", dbError);
            
            // Fallback to demo data
            const demoSymbol = uniqueSymbols[0] || getDefaultSymbolForType(investmentType);
            const demoData = generateDemoAssetPriceDataForAPI(demoSymbol, investmentType);
            
            return res.json({
                success: true,
                data: demoData,
                type: 'demo_data',
                symbol: demoSymbol
            });
        }
    } catch (error) {
        console.error(`Error fetching price history for ${req.params.type}:`, error);
        res.status(500).json({ 
            success: false, 
            message: `Error fetching price history for ${req.params.type}` 
        });
    }
});

/**
 * Generate bank value history based on interest calculations
 */
function generateBankValueHistory(bankInvestments, timeframe) {
    // Determine number of data points
    let numPoints;
    switch (timeframe) {
        case 'week':
            numPoints = 7;
            break;
        case 'month':
            numPoints = 30;
            break;
        case '3months':
            numPoints = 90;
            break;
        case 'year':
            numPoints = 365;
            break;
        default:
            numPoints = 30;
    }
    
    const valueHistory = [];
    const today = new Date();
    
    // Generate data points for each day
    for (let i = numPoints - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        let totalValue = 0;
        
        // Calculate total value of all bank investments at this date
        bankInvestments.forEach(investment => {
            const investmentDate = new Date(investment.purchase_date);
            
            // Only include if investment was made before this date
            if (investmentDate <= date) {
                const monthsHeld = monthsBetween(investmentDate, date);
                const initialAmount = parseFloat(investment.quantity);
                const interestRate = parseFloat(investment.interest_rate || 0) / 100;
                
                // Calculate value with interest
                let interestMultiplier = 1;
                switch(investment.interest_type || 'yearly') {
                    case 'daily':
                        interestMultiplier = 1 + (interestRate * (monthsHeld * 30) / 365);
                        break;
                    case 'monthly_1':
                        interestMultiplier = 1 + (interestRate * monthsHeld / 12);
                        break;
                    case 'monthly_3':
                        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 3) / 4);
                        break;
                    case 'monthly_6':
                        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 6) / 2);
                        break;
                    case 'yearly':
                        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 12));
                        break;
                }
                
                const valueAtDate = initialAmount * interestMultiplier;
                totalValue += valueAtDate;
            }
        });
        
        valueHistory.push({
            timestamp: date.toISOString(),
            price: totalValue
        });
    }
    
    return valueHistory;
}

/**
 * Improved portfolio value history calculation
 */
async function calculatePortfolioValueHistoryImproved(investments, symbols, dayLimit) {
    try {
        // Get the most recent price data for all symbols
        const [allPriceData] = await pool.query(`
            SELECT symbol, timestamp, price 
            FROM investment_prices 
            WHERE symbol IN (${symbols.map(() => '?').join(',')})
            ORDER BY timestamp DESC
            LIMIT ?
        `, [...symbols, dayLimit * symbols.length]);
        
        console.log(`Retrieved ${allPriceData.length} total price points for portfolio calculation`);
        
        if (allPriceData.length === 0) {
            return [];
        }
        
        // Group price data by date
        const priceByDate = {};
        allPriceData.forEach(row => {
            const dateKey = row.timestamp.toISOString().split('T')[0];
            if (!priceByDate[dateKey]) {
                priceByDate[dateKey] = {};
            }
            priceByDate[dateKey][row.symbol] = parseFloat(row.price);
        });
        
        console.log(`Grouped price data into ${Object.keys(priceByDate).length} dates`);
        
        // Calculate portfolio value for each date
        const portfolioHistory = [];
        const sortedDates = Object.keys(priceByDate).sort();
        
        // We want to show progression, so let's limit to the most recent dates that have data for most symbols
        const recentDates = sortedDates.slice(-Math.min(dayLimit, sortedDates.length));
        
        recentDates.forEach(dateKey => {
            const prices = priceByDate[dateKey];
            let totalValue = 0;
            let validSymbols = 0;
            
            investments.forEach(investment => {
                const symbol = investment.symbol;
                const quantity = parseFloat(investment.quantity || 0);
                
                if (prices[symbol] !== undefined) {
                    totalValue += quantity * prices[symbol];
                    validSymbols++;
                }
            });
            
            // Only include if we have data for at least one symbol
            if (validSymbols > 0) {
                portfolioHistory.push({
                    timestamp: new Date(dateKey + 'T00:00:00Z').toISOString(),
                    price: totalValue
                });
            }
        });
        
        console.log(`Generated ${portfolioHistory.length} portfolio value points`);
        return portfolioHistory;
    } catch (error) {
        console.error("Error calculating improved portfolio value history:", error);
        return [];
    }
}

/**
 * Generate demo price data for an asset (API version)
 */
function generateDemoAssetPriceDataForAPI(symbol, assetType) {
    const basePrices = {
        'BTC': 65000, 'ETH': 3500, 'USDT': 1.00, 'XRP': 0.55, 'SOL': 150,
        'AAPL': 220, 'NVDA': 900, 'TSLA': 250,
        'GLD': 200, 'SLV': 24
    };
    
    const basePrice = basePrices[symbol] || 100;
    const volatilities = {
        'crypto': 0.04,
        'stock': 0.02,
        'metal': 0.015,
        'bank': 0.001
    };
    
    const volatility = volatilities[assetType] || 0.02;
    const priceData = [];
    let currentPrice = basePrice;
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const change = currentPrice * (Math.random() * volatility * 2 - volatility);
        const trend = currentPrice * 0.001;
        currentPrice += change + trend;
        
        if (currentPrice < basePrice * 0.7) {
            currentPrice = basePrice * 0.7 + Math.random() * basePrice * 0.1;
        } else if (currentPrice > basePrice * 1.4) {
            currentPrice = basePrice * 1.3 - Math.random() * basePrice * 0.1;
        }
        
        priceData.push({
            timestamp: date.toISOString(),
            price: currentPrice
        });
    }
    
    return priceData;
}

/**
 * Get default symbol for asset type
 */
function getDefaultSymbolForType(type) {
    const defaults = {
        'crypto': 'BTC',
        'stock': 'AAPL',
        'metal': 'GLD',
        'bank': 'BANK_BGN'
    };
    return defaults[type] || 'BTC';
}

module.exports = router;