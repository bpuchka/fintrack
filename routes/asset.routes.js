// routes/asset.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const PriceData = require("../models/price-data.model");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Asset mapping for display names and types
const assetMapping = {
    // Crypto
    'BTC': { name: 'Bitcoin', type: 'crypto', currency: 'USD' },
    'ETH': { name: 'Ethereum', type: 'crypto', currency: 'USD' },
    'USDT': { name: 'Tether', type: 'crypto', currency: 'USD' },
    'SOL': { name: 'Solana', type: 'crypto', currency: 'USD' },
    'XRP': { name: 'Ripple', type: 'crypto', currency: 'USD' },
    
    // Stocks
    'AAPL': { name: 'Apple Inc.', type: 'stock', currency: 'USD' },
    'NVDA': { name: 'NVIDIA Corporation', type: 'stock', currency: 'USD' },
    'TSLA': { name: 'Tesla Inc.', type: 'stock', currency: 'USD' },
    
    // ETFs (Metals)
    'GLD': { name: 'SPDR Gold Shares', type: 'metal', currency: 'USD' },
    'SLV': { name: 'iShares Silver Trust', type: 'metal', currency: 'USD' }
};

// Default display content for unknown assets
const defaultAssetInfo = { name: 'Unknown Asset', type: 'stock', currency: 'USD' };

/**
 * Asset details page route
 * Route: GET /asset/:symbol
 */
router.get("/:symbol", requireAuth, async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const userId = req.session.user.id;
        
        // Get asset information
        const assetInfo = assetMapping[symbol] || defaultAssetInfo;
        
        // Get latest price data
        let currentPrice = 0;
        let priceChange = 0;
        
        try {
            // Try to get actual data from database
            const priceData = await PriceData.getLatestPrice(symbol);
            currentPrice = priceData.price;
            priceChange = priceData.changePercent;
        } catch (priceError) {
            console.warn(`Could not fetch price data for ${symbol}:`, priceError.message);
            // Use fallback values
            currentPrice = assetMapping[symbol]?.defaultPrice || 100;
            priceChange = 0;
        }
        
        // Get user's holdings of this asset
        const [userInvestments] = await pool.query(`
            SELECT * FROM user_investments 
            WHERE user_id = ? AND symbol = ?
        `, [userId, symbol]);
        
        let userHoldings = null;
        
        if (userInvestments.length > 0) {
            // Calculate total quantity and average purchase price
            let totalQuantity = 0;
            let totalInvested = 0;
            
            userInvestments.forEach(inv => {
                const quantity = parseFloat(inv.quantity);
                const price = parseFloat(inv.purchase_price);
                
                totalQuantity += quantity;
                totalInvested += quantity * price;
            });
            
            const avgPrice = totalInvested / totalQuantity;
            const currentValue = totalQuantity * currentPrice;
            const profitLoss = currentValue - totalInvested;
            const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
            
            userHoldings = {
                quantity: totalQuantity,
                avgPrice: avgPrice,
                currentValue: currentValue,
                profitLoss: profitLoss,
                profitLossPercent: profitLossPercent
            };
        }
        
        // Render the asset page
        res.render('asset', {
            user: req.session.user,
            symbol: symbol,
            assetName: assetInfo.name,
            assetType: assetInfo.type,
            currency: assetInfo.currency,
            currentPrice: currentPrice.toFixed(2),
            priceChange: parseFloat(priceChange).toFixed(2),
            userHoldings: userHoldings
        });
    } catch (error) {
        console.error(`Error rendering asset page for ${req.params.symbol}:`, error);
        res.status(500).render('error', {
            error: { message: 'Error loading asset data' },
            user: req.session.user
        });
    }
});

/**
 * Assets index page - show all available assets
 * Route: GET /asset
 */
router.get("/", requireAuth, async (req, res) => {
    try {
        // Get all available asset types and symbols
        const assetTypeMap = await PriceData.getAssetTypeMap();
        
        // Define asset display names
        const assetNames = {
            // Crypto
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'USDT': 'Tether',
            'SOL': 'Solana',
            'XRP': 'Ripple',
            
            // Stocks
            'AAPL': 'Apple Inc.',
            'NVDA': 'NVIDIA Corporation',
            'TSLA': 'Tesla Inc.',
            
            // ETFs (Metals)
            'GLD': 'SPDR Gold Shares',
            'SLV': 'iShares Silver Trust'
        };
        
        // Render the assets index page
        res.render('assets', {
            user: req.session.user,
            assetData: assetTypeMap,
            assetNames: assetNames
        });
    } catch (error) {
        console.error('Error rendering assets index page:', error);
        res.status(500).render('error', {
            error: { message: 'Error loading assets data' },
            user: req.session.user
        });
    }
});

/**
 * Get price history for an asset
 * Route: GET /api/asset/:symbol/history?timeframe=day|week|month|year
 */
router.get("/:symbol/history", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const timeframe = req.query.timeframe || 'day';
        
        // Try to fetch actual price data from database
        try {
            const priceData = await PriceData.getHistoricalPrices(symbol, timeframe);
            
            // If no data found, return mock data
            if (priceData.length === 0) {
                console.log(`No price data found for ${symbol}, generating mock data`);
                return res.json(generateMockPriceData(symbol, timeframe));
            }
            
            // Return actual data
            return res.json(priceData);
        } catch (dbError) {
            console.error(`Database error fetching price data for ${symbol}:`, dbError);
            // Fallback to generating mock data
            return res.json(generateMockPriceData(symbol, timeframe));
        }
    } catch (error) {
        console.error(`Error in price history endpoint for ${req.params.symbol}:`, error);
        // Return empty data instead of error
        res.json([]);
    }
});

/**
 * Get latest price for an asset
 * Route: GET /api/asset/:symbol/latest
 */
router.get("/:symbol/latest", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        
        // Try to fetch actual price data from database
        try {
            const priceData = await PriceData.getLatestPrice(symbol);
            return res.json(priceData);
        } catch (dbError) {
            console.error(`Database error fetching latest price for ${symbol}:`, dbError);
            // Fallback to generating mock price
            return res.json(generateMockLatestPrice(symbol));
        }
    } catch (error) {
        console.error(`Error in latest price endpoint for ${req.params.symbol}:`, error);
        // Return mock data instead of error
        res.json(generateMockLatestPrice(req.params.symbol));
    }
});

/**
 * Execute buy/sell transaction
 * Route: POST /api/asset/transaction
 */
router.post("/transaction", requireAuth, async (req, res) => {
    try {
        const { symbol, assetType, action, price, amount } = req.body;
        const userId = req.session.user.id;
        
        // Validate required fields
        if (!symbol || !assetType || !action || !price || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        // Validate action
        if (action !== 'buy' && action !== 'sell') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid action: must be buy or sell' 
            });
        }
        
        // Calculate total value
        const total = price * amount;
        
        // Begin transaction to ensure atomicity
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // For buy action
            if (action === 'buy') {
                // Create new investment record
                await connection.query(`
                    INSERT INTO user_investments (
                        user_id, investment_type, symbol, quantity, 
                        purchase_price, currency, purchase_date
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                `, [userId, assetType, symbol, amount, price, 'USD']);
            } 
            // For sell action (we'll keep this in case you want it later)
            else if (action === 'sell') {
                // Get user's holdings of this asset
                const [userInvestments] = await connection.query(`
                    SELECT * FROM user_investments 
                    WHERE user_id = ? AND symbol = ?
                `, [userId, symbol]);
                
                // Calculate total holdings
                let totalHoldings = 0;
                
                userInvestments.forEach(inv => {
                    totalHoldings += parseFloat(inv.quantity);
                });
                
                // Check if user has enough of the asset
                if (totalHoldings < amount) {
                    await connection.rollback();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Insufficient ${symbol} for this sale` 
                    });
                }
                
                // Sell from investments
                // For simplicity, we'll use FIFO (first in, first out) method
                let remainingAmount = amount;
                
                for (const inv of userInvestments) {
                    const invQuantity = parseFloat(inv.quantity);
                    
                    if (invQuantity > 0) {
                        const sellQuantity = Math.min(invQuantity, remainingAmount);
                        const newQuantity = invQuantity - sellQuantity;
                        
                        // Update or delete investment
                        if (newQuantity > 0) {
                            await connection.query(`
                                UPDATE user_investments 
                                SET quantity = ? 
                                WHERE id = ?
                            `, [newQuantity, inv.id]);
                        } else {
                            await connection.query(`
                                DELETE FROM user_investments 
                                WHERE id = ?
                            `, [inv.id]);
                        }
                        
                        remainingAmount -= sellQuantity;
                        
                        if (remainingAmount <= 0) {
                            break;
                        }
                    }
                }
            }
            
            // Record the transaction in a transactions table if you have one
            try {
                const [tableCheck] = await connection.query("SHOW TABLES LIKE 'transactions'");
                if (tableCheck.length > 0) {
                    await connection.query(`
                        INSERT INTO transactions (
                            user_id, symbol, action, quantity, price, total, transaction_date
                        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                    `, [userId, symbol, action, amount, price, total]);
                }
            } catch (tableError) {
                console.warn("Could not check for transactions table:", tableError.message);
            }
            
            // Commit the transaction
            await connection.commit();
            
            res.json({
                success: true,
                message: `${action === 'buy' ? 'Purchase' : 'Sale'} successful`,
                data: {
                    symbol,
                    action,
                    amount,
                    price,
                    total,
                    date: new Date()
                }
            });
        } catch (error) {
            // If an error occurs, roll back the transaction
            await connection.rollback();
            throw error;
        } finally {
            // Release connection
            connection.release();
        }
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to process transaction' 
        });
    }
});

/**
 * Generate realistic mock price data for testing when no data exists in DB
 */
function generateMockPriceData(symbol, timeframe) {
    console.log(`Generating mock price data for ${symbol} (${timeframe})`);
    
    // Base price for each symbol (approximate values)
    const basePrices = {
        'BTC': 35000,
        'ETH': 2000,
        'USDT': 1,
        'XRP': 0.5,
        'SOL': 60,
        'AAPL': 175,
        'NVDA': 450,
        'TSLA': 250,
        'GLD': 190,
        'SLV': 23
    };
    
    const basePrice = basePrices[symbol] || 100;
    
    // Volatility factor (higher for crypto)
    const isVolatile = ['BTC', 'ETH', 'XRP', 'SOL'].includes(symbol);
    const volatility = isVolatile ? 0.03 : 0.01;
    
    // Number of data points to generate
    let numPoints;
    switch (timeframe) {
        case 'day':
            numPoints = 24; // hourly
            break;
        case 'week':
            numPoints = 7; // daily
            break;
        case 'month':
            numPoints = 30; // daily
            break;
        case 'year':
            numPoints = 52; // weekly
            break;
        default:
            numPoints = 24;
    }
    
    // Generate price points
    const prices = [];
    let currentPrice = basePrice;
    const now = new Date();
    
    for (let i = 0; i < numPoints; i++) {
        // Calculate timestamp
        const timestamp = new Date(now);
        
        switch (timeframe) {
            case 'day':
                timestamp.setHours(now.getHours() - (numPoints - i));
                break;
            case 'week':
                timestamp.setDate(now.getDate() - (numPoints - i));
                break;
            case 'month':
                timestamp.setDate(now.getDate() - Math.floor((numPoints - i) * (30 / numPoints)));
                break;
            case 'year':
                timestamp.setDate(now.getDate() - Math.floor((numPoints - i) * (365 / numPoints)));
                break;
        }
        
        // Add some random price movement
        let change = currentPrice * (Math.random() * volatility * 2 - volatility);
        
        // Add a trend component for more realistic looking data
        const trendFactor = 0.005; // positive trend
        const trend = currentPrice * trendFactor * (i / numPoints);
        
        currentPrice += change + trend;
        
        // Ensure price doesn't go too low
        if (currentPrice < basePrice * 0.5) {
            currentPrice = basePrice * 0.5 + (Math.random() * basePrice * 0.1);
        }
        
        // Add the price point
        prices.push({
            timestamp: timestamp.toISOString(),
            price: currentPrice
        });
    }
    
    return prices;
}

/**
 * Generate a realistic mock latest price
 */
function generateMockLatestPrice(symbol) {
    console.log(`Generating mock latest price for ${symbol}`);
    
    // Base price for each symbol (approximate values)
    const basePrices = {
        'BTC': 35000,
        'ETH': 2000,
        'USDT': 1,
        'XRP': 0.5,
        'SOL': 60,
        'AAPL': 175,
        'NVDA': 450,
        'TSLA': 250,
        'GLD': 190,
        'SLV': 23
    };
    
    const basePrice = basePrices[symbol] || 100;
    
    // Add a small random fluctuation
    const change = basePrice * (Math.random() * 0.06 - 0.03); // -3% to +3%
    const price = basePrice + change;
    
    return {
        symbol: symbol,
        price: price,
        timestamp: new Date().toISOString(),
        change: change,
        changePercent: (change / basePrice * 100).toFixed(2)
    };
}

module.exports = router;