// models/price-data.model.js
const pool = require("../config/db");
const axios = require("axios");
const fs = require('fs').promises;
const path = require('path');

// Configure Alpha Vantage API
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DIR = path.join(__dirname, '../services/cache');

// Asset mapping configuration
const assets = {
  stocks: ["AAPL", "NVDA", "TSLA"],
  etfs: ["GLD", "SLV"],
  crypto: ["BTC", "ETH", "USDT", "XRP", "SOL"],
  forex: ["EUR", "BGN", "GBP"]
};

// Map asset types to database enum values
const assetTypeMapping = {
  'stocks': 'stock',
  'etfs': 'etf',
  'crypto': 'crypto',
  'forex': 'forex'
};

// Default fallback prices for testing when API fails
const fallbackPrices = {
  // Stocks
  'AAPL': 252.20,
  'NVDA': 950.15,
  'TSLA': 175.10,
  // Crypto
  'BTC': 62350.25,
  'ETH': 3050.80,
  'USDT': 1.00,
  'XRP': 0.51,
  'SOL': 145.75,
  // ETFs
  'GLD': 212.30,
  'SLV': 25.15,
  // Forex (vs USD)
  'EUR': 1.09,
  'BGN': 0.55,
  'GBP': 1.28
};

/**
 * Gets historical prices for an asset
 * @param {string} symbol - The asset symbol
 * @param {string} timeframe - The timeframe (day, week, month, year)
 * @returns {Promise<Array>} - Array of price data objects
 */
async function getHistoricalPrices(symbol, timeframe) {
  try {
    // Special case for 'all' timeframe - get ALL historical data without date filtering
    if (timeframe === 'all') {
      console.log(`Fetching ALL historical price data for ${symbol}`);
      
      // Query to get ALL price history for this symbol
      const [prices] = await pool.query(`
        SELECT timestamp, price 
        FROM investment_prices 
        WHERE symbol = ?
        ORDER BY timestamp ASC
      `, [symbol]);
      
      console.log(`Retrieved ${prices.length} total price points for ${symbol}`);
      
      // Format prices for output
      return prices.map(price => ({
        timestamp: price.timestamp,
        price: parseFloat(price.price)
      }));
    }
    
    // For other timeframes, determine date range based on timeframe
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
    
    // Format dates for MySQL query - use date format only
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Fetching price data for ${symbol} from ${startDateStr} to ${endDateStr}`);
    
    // Query to get price history using DATE() for comparison
    const [prices] = await pool.query(`
      SELECT timestamp, price 
      FROM investment_prices 
      WHERE symbol = ? AND DATE(timestamp) BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `, [symbol, startDateStr, endDateStr]);
    
    console.log(`Retrieved ${prices.length} price points for ${symbol}`);
    
    // If no data found for the date range, try querying for any data for this symbol
    if (prices.length === 0) {
      // Just get the most recent data regardless of date
      const [recentPrices] = await pool.query(`
        SELECT timestamp, price 
        FROM investment_prices 
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `, [symbol]);
      
      console.log(`Retrieved ${recentPrices.length} recent price points for ${symbol}`);
      
      // Format recent prices for output
      if (recentPrices.length > 0) {
        return recentPrices.map(price => ({
          timestamp: price.timestamp,
          price: parseFloat(price.price)
        }));
      }
      
      return [];
    }
    
    // Format prices for output
    return prices.map(price => ({
      timestamp: price.timestamp,
      price: parseFloat(price.price)
    }));
  } catch (error) {
    console.error(`Error in getHistoricalPrices for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Gets the latest price for an asset
 * @param {string} symbol - The asset symbol
 * @returns {Promise<Object>} - Price data object
 */
async function getLatestPrice(symbol) {
  try {
    // Get latest price data
    const [latestPrices] = await pool.query(`
      SELECT * FROM investment_prices 
      WHERE symbol = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol]);
    
    if (latestPrices.length === 0) {
      throw new Error(`No price data found for ${symbol}`);
    }
    
    const latestPrice = latestPrices[0];
    
    // Get day-before price for calculation of price change
    const latestDate = new Date(latestPrice.timestamp);
    const yesterday = new Date(latestDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Use DATE() function to ensure we get the right day
    const [previousPrices] = await pool.query(`
      SELECT * FROM investment_prices 
      WHERE symbol = ? AND DATE(timestamp) < DATE(?)
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol, latestPrice.timestamp]);
    
    let priceChange = 0;
    let changePercent = 0;
    
    if (previousPrices.length > 0) {
      const previousPrice = parseFloat(previousPrices[0].price);
      const currentPrice = parseFloat(latestPrice.price);
      
      priceChange = currentPrice - previousPrice;
      changePercent = (priceChange / previousPrice) * 100;
    }
    
    return {
      symbol: latestPrice.symbol,
      price: parseFloat(latestPrice.price),
      timestamp: latestPrice.timestamp,
      change: priceChange,
      changePercent: changePercent.toFixed(2)
    };
  } catch (error) {
    console.error(`Error in getLatestPrice for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Gets a map of all asset types and their symbols
 * @returns {Promise<Object>} Map of asset types to arrays of symbols
 */
async function getAssetTypeMap() {
  try {
    // Query to get all unique symbols and their asset types
    const [symbols] = await pool.query(`
      SELECT DISTINCT symbol, asset_type 
      FROM investment_prices
      ORDER BY asset_type, symbol
    `);
    
    // Group by asset type
    const assetTypeMap = {
      stock: [],
      crypto: [],
      etf: [],
      forex: [],
      commodity: []
    };
    
    symbols.forEach(row => {
      const type = row.asset_type;
      if (assetTypeMap[type]) {
        assetTypeMap[type].push(row.symbol);
      }
    });
    
    return assetTypeMap;
  } catch (error) {
    console.error('Error in getAssetTypeMap:', error);
    // Return predefined assets as fallback
    return {
      stock: assets.stocks,
      crypto: assets.crypto,
      etf: assets.etfs,
      forex: assets.forex,
      commodity: []
    };
  }
}

/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error.message);
  }
}

/**
 * Fetch and store daily 00:00:00 prices for an asset
 * @param {string} symbol - Symbol to fetch
 * @param {string} assetCategory - Type of asset category
 * @returns {Promise<void>}
 */
async function fetchAndStoreDailyPrice(symbol, assetCategory) {
  // Map to database asset type
  const assetType = assetTypeMapping[assetCategory];
  if (!assetType) {
    console.error(`Invalid asset category: ${assetCategory}`);
    return;
  }

  try {
    console.log(`Fetching daily price for ${symbol} (${assetType})...`);
    
    let url, dataKey, priceKey;
    
    // Configure API call based on asset type
    if (assetCategory === 'stocks' || assetCategory === 'etfs') {
      url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Global Quote';
      priceKey = '05. price';
    } else if (assetCategory === 'crypto') {
      url = `${BASE_URL}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Time Series (Digital Currency Daily)';
      priceKey = '4a. close (USD)';
    } else if (assetCategory === 'forex') {
      url = `${BASE_URL}?function=FX_DAILY&from_symbol=${symbol}&to_symbol=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Time Series FX (Daily)';
      priceKey = '4. close';
    }
    
    // Make API request
    const response = await axios.get(url);
    
    // Show available keys in response for debugging
    console.log(`Response keys for ${symbol}: ${Object.keys(response.data).join(', ')}`);
    
    // Check for API errors
    if (response.data['Error Message']) {
      throw new Error(`API Error: ${response.data['Error Message']}`);
    }
    
    if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
      console.warn(`API rate limit reached for ${symbol}, using fallback price`);
      useFallbackPrice(symbol, assetType);
      return;
    }
    
    if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
      console.warn(`API call frequency exceeded for ${symbol}, using fallback price`);
      useFallbackPrice(symbol, assetType);
      return;
    }
    
    // Process data based on asset type
    let price, date;
    
    try {
      if (assetCategory === 'stocks' || assetCategory === 'etfs') {
        if (!response.data[dataKey]) {
          console.error(`Missing data key "${dataKey}" for ${symbol}`);
          console.error(`Available keys: ${Object.keys(response.data).join(', ')}`);
          throw new Error(`No data found for ${symbol}`);
        }
        
        console.log(`Stock data keys: ${Object.keys(response.data[dataKey]).join(', ')}`);
        
        price = parseFloat(response.data[dataKey][priceKey]);
        date = response.data[dataKey]['07. latest trading day'];
        
        console.log(`Parsed stock price: ${price}, date: ${date}`);
      } else if (assetCategory === 'crypto') {
        // For crypto, we need to handle the response differently
        if (!response.data[dataKey]) {
          console.error(`Missing data key "${dataKey}" for ${symbol}`);
          console.error(`Available keys: ${Object.keys(response.data).join(', ')}`);
          throw new Error(`No data found for ${symbol}`);
        }
        
        const timestamps = Object.keys(response.data[dataKey]);
        if (timestamps.length === 0) {
          throw new Error(`No data points for ${symbol}`);
        }
        
        // Sort timestamps to get most recent
        timestamps.sort((a, b) => new Date(b) - new Date(a));
        date = timestamps[0];
        
        console.log(`Crypto data for ${date}, keys: ${Object.keys(response.data[dataKey][date]).join(', ')}`);
        
        const rawPrice = response.data[dataKey][date][priceKey];
        console.log(`Raw crypto price value: ${rawPrice}`);
        
        price = parseFloat(rawPrice);
        console.log(`Parsed crypto price: ${price}, date: ${date}`);
      } else if (assetCategory === 'forex') {
        // For forex
        if (!response.data[dataKey]) {
          console.error(`Missing data key "${dataKey}" for ${symbol}`);
          console.error(`Available keys: ${Object.keys(response.data).join(', ')}`);
          throw new Error(`No data found for ${symbol}`);
        }
        
        const timestamps = Object.keys(response.data[dataKey]);
        if (timestamps.length === 0) {
          throw new Error(`No data points for ${symbol}`);
        }
        
        // Sort timestamps to get most recent
        timestamps.sort((a, b) => new Date(b) - new Date(a));
        date = timestamps[0];
        
        console.log(`Forex data for ${date}, keys: ${Object.keys(response.data[dataKey][date]).join(', ')}`);
        
        price = parseFloat(response.data[dataKey][date][priceKey]);
        console.log(`Parsed forex price: ${price}, date: ${date}`);
      }
      
      // Check for NaN price
      if (isNaN(price)) {
        console.warn(`Parsed price is NaN for ${symbol}, using fallback`);
        price = getFallbackPrice(symbol);
        console.log(`Using fallback price for ${symbol}: ${price}`);
      }
    } catch (parseError) {
      console.error(`Error parsing data for ${symbol}:`, parseError.message);
      // Use fallback price when parsing fails
      price = getFallbackPrice(symbol);
      date = new Date().toISOString().split('T')[0]; // Use today's date
      console.log(`Using fallback price for ${symbol} due to parsing error: ${price}`);
    }
    
    // Format date to get only the date part with midnight time
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);
    const sqlDate = formattedDate.toISOString().slice(0, 19).replace('T', ' ');
    
    // Check if this price already exists
    const [existingPrice] = await pool.query(`
      SELECT * FROM investment_prices 
      WHERE symbol = ? AND DATE(timestamp) = DATE(?)
    `, [symbol, sqlDate]);
    
    // Insert or update price
    if (existingPrice.length > 0) {
      // Update price if it's different
      const existingPriceValue = parseFloat(existingPrice[0].price);
      if (Math.abs(existingPriceValue - price) > 0.001) {
        console.log(`Updating price for ${symbol} on ${sqlDate}: ${existingPriceValue} -> ${price}`);
        await pool.query(`
          UPDATE investment_prices 
          SET price = ? 
          WHERE id = ?
        `, [price.toFixed(2), existingPrice[0].id]);
      } else {
        console.log(`Price for ${symbol} on ${sqlDate} already exists and is current`);
      }
    } else {
      // Insert new price
      console.log(`Inserting new price for ${symbol} on ${sqlDate}: ${price}`);
      await pool.query(`
        INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
        VALUES (?, ?, ?, ?)
      `, [symbol, price.toFixed(2), sqlDate, assetType]);
    }
  } catch (error) {
    console.error(`Error fetching daily price for ${symbol}:`, error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    
    // Use fallback price when request fails
    await useFallbackPrice(symbol, assetType);
  }
}

/**
 * Use a fallback price when API fails
 * @param {string} symbol - Asset symbol
 * @param {string} assetType - Asset type
 */
async function useFallbackPrice(symbol, assetType) {
  try {
    const price = getFallbackPrice(symbol);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sqlDate = today.toISOString().slice(0, 19).replace('T', ' ');
    
    // Check if this price already exists
    const [existingPrice] = await pool.query(`
      SELECT * FROM investment_prices 
      WHERE symbol = ? AND DATE(timestamp) = DATE(?)
    `, [symbol, sqlDate]);
    
    // Insert or update price
    if (existingPrice.length > 0) {
      // Update price
      console.log(`Updating with fallback price for ${symbol} on ${sqlDate}: ${price}`);
      await pool.query(`
        UPDATE investment_prices 
        SET price = ? 
        WHERE id = ?
      `, [price.toFixed(2), existingPrice[0].id]);
    } else {
      // Insert new price
      console.log(`Inserting fallback price for ${symbol} on ${sqlDate}: ${price}`);
      await pool.query(`
        INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
        VALUES (?, ?, ?, ?)
      `, [symbol, price.toFixed(2), sqlDate, assetType]);
    }
  } catch (error) {
    console.error(`Error using fallback price for ${symbol}:`, error.message);
  }
}

/**
 * Get a fallback price for a symbol
 * @param {string} symbol - Asset symbol
 * @returns {number} - Fallback price
 */
function getFallbackPrice(symbol) {
  return fallbackPrices[symbol] || 100;
}

/**
 * Fetch daily prices for all assets at server startup
 */
async function initializeDailyPrices() {
  console.log("Initializing daily prices at server startup...");
  
  try {
    // Create cache directory if it doesn't exist
    await ensureCacheDir();
    
    // Determine which assets need updating
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`Checking for daily prices for ${todayStr}...`);
    
    const missingAssets = [];
    
    // Check each asset category
    for (const category in assets) {
      for (const symbol of assets[category]) {
        // Skip forex "USD" as it's just used as a currency pair
        if (category === 'forex' && symbol === 'USD') continue;
        
        // Check if we already have today's price
        const [existingPrice] = await pool.query(`
          SELECT * FROM investment_prices 
          WHERE symbol = ? AND DATE(timestamp) = ?
        `, [symbol, todayStr]);
        
        if (existingPrice.length === 0) {
          missingAssets.push({ symbol, category });
        }
      }
    }
    
    console.log(`Found ${missingAssets.length} assets needing daily price updates`);
    
    // Fetch prices for missing assets with a delay to respect API limits
    for (let i = 0; i < missingAssets.length; i++) {
      const { symbol, category } = missingAssets[i];
      await fetchAndStoreDailyPrice(symbol, category);
      
      // Add delay between requests
      if (i < missingAssets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12-second delay
      }
    }
    
    console.log("Daily price initialization complete");
  } catch (error) {
    console.error("Error initializing daily prices:", error.message);
  }
}

module.exports = {
  getHistoricalPrices,
  getLatestPrice,
  getAssetTypeMap,
  fetchAndStoreDailyPrice,
  initializeDailyPrices,
  assets
};