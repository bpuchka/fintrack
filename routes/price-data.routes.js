// routes/price-data.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/**
 * Get price history for an asset
 * Route: GET /api/prices/:symbol?timeframe=day|week|month|year
 */
router.get("/:symbol", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const timeframe = req.query.timeframe || 'day';
        
        // Determine date range based on timeframe
        const endDate = new Date();
        let startDate = new Date();
        
        switch (timeframe) {
            case 'day':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(startDate.getDate() - 1);
        }
        
        // Format dates for MySQL query
        const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
        const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
        
        // Query to get price history
        const [prices] = await pool.query(`
            SELECT timestamp, price 
            FROM investment_prices 
            WHERE symbol = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        `, [symbol, startDateStr, endDateStr]);
        
        // If no data found, return realistic generated data
        if (prices.length === 0) {
            return res.json(generateMockPriceData(symbol, timeframe));
        }
        
        // Format prices for output
        const formattedPrices = prices.map(price => ({
            timestamp: price.timestamp,
            price: parseFloat(price.price)
        }));
        
        res.json(formattedPrices);
    } catch (error) {
        console.error(`Error fetching price data for ${req.params.symbol}:`, error);
        res.status(500).json({ error: 'Failed to fetch price data' });
    }
});

/**
 * Get latest price for a symbol
 * Route: GET /api/prices/:symbol/latest
 */
router.get("/:symbol/latest", async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        
        // Get latest price data
        const [latestPrices] = await pool.query(`
            SELECT * FROM investment_prices 
            WHERE symbol = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [symbol]);
        
        // If no data found, generate a realistic mock price
        if (latestPrices.length === 0) {
            return res.json(generateMockLatestPrice(symbol));
        }
        
        const latestPrice = latestPrices[0];
        
        // Get day-before price for calculation of price change
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 19).replace('T', ' ');
        
        const [previousPrices] = await pool.query(`
            SELECT * FROM investment_prices 
            WHERE symbol = ? AND timestamp <= ?
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [symbol, yesterdayStr]);
        
        let priceChange = 0;
        let changePercent = 0;
        
        if (previousPrices.length > 0) {
            const previousPrice = parseFloat(previousPrices[0].price);
            const currentPrice = parseFloat(latestPrice.price);
            
            priceChange = currentPrice - previousPrice;
            changePercent = (priceChange / previousPrice) * 100;
        }
        
        res.json({
            symbol: latestPrice.symbol,
            price: parseFloat(latestPrice.price),
            timestamp: latestPrice.timestamp,
            change: priceChange,
            changePercent: changePercent.toFixed(2)
        });
    } catch (error) {
        console.error(`Error fetching latest price for ${req.params.symbol}:`, error);
        res.status(500).json({ error: 'Failed to fetch latest price' });
    }
});

/**
 * Generate realistic mock price data for testing when no data exists in DB
 */
function generateMockPriceData(symbol, timeframe) {
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
    // Base price for each symbol (approximate values)
    const basePrices = {
        'BTC': 65000,
        'ETH': 2000,
        'USDT': 1,
        'XRP': 0.5,
        'SOL': 60,
        'AAPL': 200,
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