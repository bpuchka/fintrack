const axios = require("axios");
const pool = require("../config/db");
const fs = require('fs').promises;
const path = require('path');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DIR = path.join(__dirname, 'cache');

const DEFAULT_TIMEZONE = 'UTC';

// Asset categories and symbols
const assets = {
  stocks: ["AAPL", "NVDA", "TSLA"],
  etfs: ["GLD", "SLV"],
  crypto: ["BTC", "ETH", "USDT", "XRP", "SOL"],
  forex: ["EUR", "BGN", "GBP"] // These will be paired with USD
};

// Map asset types to your table's enum values
const assetTypeMapping = {
  'stocks': 'stock',
  'etfs': 'etf',
  'crypto': 'crypto',
  'forex': 'forex'
};

/**
 * Helper function to standardize date formatting for database
 * Always creates UTC midnight timestamps
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string for DB
 */
function formatDateForDB(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  // Create date in UTC at midnight
  const utcDate = new Date(Date.UTC(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    0, 0, 0, 0
  ));
  return utcDate.toISOString().slice(0, 19).replace('T', ' ');
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
 * Saves data to cache
 * @param {string} symbol - The asset symbol
 * @param {string} assetType - Type of asset
 * @param {object} data - Data to cache
 */
async function saveToCache(symbol, assetType, data) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${symbol}_${assetType}.json`);
    await fs.writeFile(cacheFile, JSON.stringify(data));
    console.log(`Cached data for ${symbol}`);
  } catch (error) {
    console.error(`Error caching data for ${symbol}:`, error.message);
  }
}

/**
 * Gets data from cache
 * @param {string} symbol - The asset symbol
 * @param {string} assetType - Type of asset
 * @returns {Promise<object|null>} - Cached data or null
 */
async function getFromCache(symbol, assetType) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${symbol}_${assetType}.json`);
    const data = await fs.readFile(cacheFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading cache for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Checks if we have cached data for an asset
 * @param {string} symbol - The asset symbol
 * @param {string} assetType - Type of asset
 * @returns {Promise<boolean>} - Whether cache exists
 */
async function hasCachedData(symbol, assetType) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${symbol}_${assetType}.json`);
    await fs.access(cacheFile);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch and store intraday prices for all assets
 * Wrapper for compatibility with server.js
 * @param {boolean} useCache - Whether to use cached data
 * @returns {Promise<void>}
 */
async function fetchAndStoreIntradayPrices(useCache = false) {
  return fetchAndStoreCurrentPrices(useCache);
}

/**
 * Fetch current prices for all assets using bulk quotes API
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<Object>} - Object with symbols as keys and prices as values
 */
async function fetchBulkQuotes(useCache = true) {
  try {
    await ensureCacheDir();
    
    // Create a flat list of all symbols
    let allSymbols = [];
    let symbolToTypeMap = {};
    
    for (const type in assets) {
      for (const symbol of assets[type]) {
        if (type === 'forex') {
          if (symbol !== 'USD') {  // USD is the base, not needed in forex pairs
            // For forex, format as currency pairs with USD
            const forexSymbol = `${symbol}USD`;
            allSymbols.push(forexSymbol);
            symbolToTypeMap[forexSymbol] = type;
          }
        } else {
          allSymbols.push(symbol);
          symbolToTypeMap[symbol] = type;
        }
      }
    }
    
    // Join symbols with commas for the API call
    const symbolsString = allSymbols.join(',');
    
    console.log(`Fetching bulk quotes for: ${symbolsString}`);
    
    // Check if we have cached data for all symbols and use it if requested
    let cachedResults = {};
    let missingSymbols = [];
    
    if (useCache) {
      for (const symbol of allSymbols) {
        const type = symbolToTypeMap[symbol];
        if (await hasCachedData(symbol, type)) {
          const cachedData = await getFromCache(symbol, type);
          if (cachedData) {
            cachedResults[symbol] = cachedData;
          } else {
            missingSymbols.push(symbol);
          }
        } else {
          missingSymbols.push(symbol);
        }
      }
    } else {
      missingSymbols = [...allSymbols];
    }
    
    // Only make API call if we have missing symbols
    let apiResults = {};
    if (missingSymbols.length > 0) {
      // Make the bulk API call
      const url = `${BASE_URL}?function=BATCH_STOCK_QUOTES&symbols=${missingSymbols.join(',')}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await axios.get(url);
      
      // Process the API response
      if (response.data && response.data['Stock Quotes']) {
        const quotes = response.data['Stock Quotes'];
        quotes.forEach(quote => {
          const symbol = quote['1. symbol'];
          const price = parseFloat(quote['2. price']);
          apiResults[symbol] = { price, timestamp: new Date() };
          
          // Cache this result
          const type = symbolToTypeMap[symbol];
          saveToCache(symbol, type, { price, timestamp: new Date() });
        });
      } else if (response.data && response.data['Note']) {
        console.warn(`API rate limit note: ${response.data['Note']}`);
      } else {
        console.error('Unexpected API response format:', response.data);
      }
    }
    
    // Combine cached and API results
    return { ...cachedResults, ...apiResults };
  } catch (error) {
    console.error('Error fetching bulk quotes:', error);
    return {};
  }
}

/**
 * Fetch and store current prices for all supported assets
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<void>}
 */
async function fetchAndStoreCurrentPrices(useCache = true) {
  try {
    console.log("Starting current price fetch using bulk API...");
    
    // Fetch all prices using bulk API
    const prices = await fetchBulkQuotes(useCache);
    
    // Prepare database connection
    const connection = await pool.getConnection();
    
    try {
      // Begin transaction
      await connection.beginTransaction();
      
      // Create records to insert
      const records = [];
      
      for (const symbol in prices) {
        // Determine the asset type
        let assetType;
        let baseSymbol = symbol;
        
        // Handle forex pairs (e.g., EURUSD -> EUR)
        if (symbol.endsWith('USD') && symbol.length > 3) {
          baseSymbol = symbol.slice(0, -3);
          assetType = 'forex';
        } else {
          // Find asset type from our mapping
          for (const type in assets) {
            if (assets[type].includes(baseSymbol)) {
              assetType = type;
              break;
            }
          }
        }
        
        // Skip if we couldn't determine asset type
        if (!assetType) {
          console.warn(`Could not determine asset type for ${symbol}, skipping`);
          continue;
        }
        
        // Map to database enum value
        const mappedAssetType = assetTypeMapping[assetType];
        if (!mappedAssetType) {
          console.warn(`Invalid asset type mapping for: ${assetType}, skipping`);
          continue;
        }
        
        // Create record with standardized UTC midnight timestamp
        const price = prices[symbol].price;
        const formattedDate = formatDateForDB(new Date());
        
        // Log what we're about to do
        console.log(`Processing price for ${baseSymbol} with UTC timestamp: ${formattedDate}`);
        
        records.push([baseSymbol, price, formattedDate, mappedAssetType]);
      }
      
      // Insert into database if we have records
      if (records.length > 0) {
        // Check for existing records first to avoid duplicates
        for (const record of records) {
          const [symbol, price, timestamp, assetType] = record;
          
          // Check if this price already exists for today using DATE() function
          const [existingPrices] = await connection.query(`
            SELECT * FROM investment_prices 
            WHERE symbol = ? AND DATE(timestamp) = DATE(?)
            ORDER BY timestamp DESC LIMIT 1
          `, [symbol, formattedDate]);
          
          if (existingPrices.length > 0) {
            console.log(`Price for ${symbol} already exists for ${timestamp.split(' ')[0]}, updating...`);
            
            // Update existing price
            await connection.query(`
              UPDATE investment_prices 
              SET price = ? 
              WHERE id = ?
            `, [price, existingPrices[0].id]);
          } else {
            console.log(`Inserting new price for ${symbol} on ${timestamp}: ${price}`);
            
            // Insert new price
            await connection.query(`
              INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
              VALUES (?, ?, ?, ?)
            `, [symbol, price, timestamp, assetType]);
          }
        }
        
        // Commit transaction
        await connection.commit();
        console.log(`Successfully stored ${records.length} current prices`);
      } else {
        console.warn("No valid price records to insert");
        await connection.commit();
      }
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection
      connection.release();
    }
  } catch (error) {
    console.error("Error in fetchAndStoreCurrentPrices:", error.message);
  }
}

/**
 * Consistently format dates with a constant time (00:00:00 UTC)
 * This ensures all daily prices have the exact same timestamp format
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string for DB with constant time
 */
function formatDateWithConstantTime(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  // Always use 00:00:00 UTC for consistency
  const utcDate = new Date(Date.UTC(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    0, 0, 0, 0
  ));
  return utcDate.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Fetch and store last month (30 days) of price data for an asset
 * Uses 'compact' output size option for API efficiency
 * 
 * @param {string} symbol - The asset symbol (e.g., BTC, AAPL)
 * @param {string} category - The asset category (stocks, etfs, crypto, forex)
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<number>} - Number of records inserted/updated
 */
async function fetchLastMonthPrices(symbol, category, useCache = true) {
  try {
    await ensureCacheDir();
    
    // Map asset category to your table's enum values
    const assetType = assetTypeMapping[category];
    if (!assetType) {
      throw new Error(`Invalid asset category mapping for: ${category}`);
    }
    
    // Use cache if requested
    let data;
    let isFromCache = false;
    
    if (useCache && await hasCachedData(symbol, assetType)) {
      data = await getFromCache(symbol, assetType);
      if (data) {
        console.log(`Using cached data for ${symbol} (${category})`);
        isFromCache = true;
      }
    }
    
    // If no cached data, fetch from API
    if (!data) {
      let url;
      let dataKey;
      let priceKey;
      
      // Different endpoints based on asset type
      if (category === 'stocks' || category === 'etfs') {
        url = `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Daily)';
        priceKey = '5. adjusted close';
      } else if (category === 'crypto') {
        url = `${BASE_URL}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Digital Currency Daily)';
        priceKey = '4. close';
      } else if (category === 'forex') {
        url = `${BASE_URL}?function=FX_DAILY&from_symbol=${symbol}&to_symbol=USD&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series FX (Daily)';
        priceKey = '4. close';
      } else {
        throw new Error(`Unsupported asset category: ${category}`);
      }
      
      console.log(`Fetching last month data for ${symbol} (${category})...`);
      const response = await axios.get(url);
      
      // Check for API errors
      if (response.data['Error Message']) {
        throw new Error(`API Error: ${response.data['Error Message']}`);
      }
      
      if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
        throw new Error(`API rate limit reached: ${response.data['Information']}`);
      }
      
      if (response.data['Note']) {
        console.warn(`API Note: ${response.data['Note']}`);
        if (response.data['Note'].includes('call frequency')) {
          throw new Error('API call frequency exceeded');
        }
      }
      
      // Check if we have the expected data
      if (!response.data[dataKey]) {
        throw new Error(`No data found for ${symbol} under key "${dataKey}"`);
      }
      
      data = {
        dataKey,
        priceKey,
        data: response.data[dataKey]
      };
      
      // Save to cache
      await saveToCache(symbol, assetType, data);
    }
    
    // Process the data for database insertion
    const timeSeriesData = isFromCache ? data.data : data.data;
    const actualPriceKey = isFromCache ? data.priceKey : data.priceKey;
    
    // Calculate date 30 days ago for filtering
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Use database connection from pool
    const connection = await pool.getConnection();
    let recordCount = 0;
    
    try {
      // Begin transaction
      await connection.beginTransaction();
      
      // Process each date in the time series
      for (const date in timeSeriesData) {
        const dateObj = new Date(date);
        
        // Only process data from the last 30 days
        if (dateObj >= thirtyDaysAgo) {
          const price = parseFloat(timeSeriesData[date][actualPriceKey]);
          if (!isNaN(price)) {
            // Format date with constant time (00:00 UTC)
            const formattedDate = formatDateWithConstantTime(dateObj);
            
            // Check if this price already exists for the day using exact timestamp match
            const [existingPrices] = await connection.query(`
              SELECT * FROM investment_prices 
              WHERE symbol = ? AND timestamp = ?
            `, [symbol, formattedDate]);
            
            if (existingPrices.length > 0) {
              console.log(`Price for ${symbol} already exists for ${formattedDate}, updating...`);
              
              // Update existing price
              await connection.query(`
                UPDATE investment_prices 
                SET price = ? 
                WHERE id = ?
              `, [price.toFixed(4), existingPrices[0].id]);
            } else {
              console.log(`Inserting new price for ${symbol} on ${formattedDate}: ${price}`);
              
              // Insert new price
              await connection.query(`
                INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
                VALUES (?, ?, ?, ?)
              `, [symbol, price.toFixed(4), formattedDate, assetType]);
            }
            
            recordCount++;
          } else {
            console.warn(`Invalid price for ${symbol} on ${date}: ${timeSeriesData[date][actualPriceKey]}`);
          }
        }
      }
      
      // Commit transaction
      await connection.commit();
      console.log(`Successfully processed ${recordCount} prices for ${symbol}`);
      
      return recordCount;
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection
      connection.release();
    }
  } catch (error) {
    console.error(`Error processing last month data for ${symbol} (${category}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Update price data for all assets for the last 30 days
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<number>} - Total number of records updated
 */
async function fetchAndStoreLastMonthData(useCache = true) {
  try {
    console.log("Starting last month data fetch for all assets...");
    let totalRecords = 0;
    
    // Process each asset category
    for (const category in assets) {
      for (const symbol of assets[category]) {
        // Skip USD for forex as it's just used as a comparison currency
        if (category === 'forex' && symbol === 'USD') continue;
        
        try {
          const recordCount = await fetchLastMonthPrices(symbol, category, useCache);
          totalRecords += recordCount;
          
          // Add a delay to respect API rate limits
          console.log(`Waiting 3 seconds before next API call...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error.message);
        }
      }
    }
    
    console.log(`Last month data fetch completed. Updated ${totalRecords} total records.`);
    return totalRecords;
  } catch (error) {
    console.error("Error in fetchAndStoreLastMonthData:", error.message);
    return 0;
  }
}

/**
 * Fetch and store historical data for cryptos
 * This still needs to be done individually as bulk historical data is not available
 * in the free tier of Alpha Vantage
 * @param {boolean} useCache - Whether to use cached data if available
 */
async function fetchAndStoreHistoricalCrypto(useCache = true) {
  try {
    console.log("Starting historical crypto data fetch...");
    
    // Process each crypto symbol
    for (const symbol of assets.crypto) {
      try {
        await fetchHistoricalPrices(symbol, 'crypto', useCache);
        // Add a delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 second delay
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error.message);
      }
    }
    
    console.log("Historical crypto data fetch completed");
  } catch (error) {
    console.error("Error in fetchAndStoreHistoricalCrypto:", error.message);
  }
}

/**
 * Fetch historical prices for a single asset
 * @param {string} symbol - The asset symbol
 * @param {string} assetType - Type of asset (stocks, etfs, crypto, forex)
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<void>}
 */
async function fetchHistoricalPrices(symbol, assetType, useCache = true) {
  try {
    await ensureCacheDir();
    
    let data;
    let isFromCache = false;
    
    // Try to use cached data if requested
    if (useCache && await hasCachedData(symbol, assetType)) {
      data = await getFromCache(symbol, assetType);
      if (data) {
        console.log(`Using cached data for ${symbol} (${assetType})`);
        isFromCache = true;
      }
    }
    
    // If no cached data, fetch from API
    if (!data) {
      let url;
      let dataKey;
      let priceKey;
      
      // Different endpoints based on asset type
      if (assetType === 'stocks' || assetType === 'etfs') {
        url = `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Daily)';
        priceKey = '5. adjusted close';
      } else if (assetType === 'crypto') {
        url = `${BASE_URL}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Digital Currency Daily)';
        priceKey = '4. close';
      } else if (assetType === 'forex') {
        url = `${BASE_URL}?function=FX_DAILY&from_symbol=${symbol}&to_symbol=USD&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series FX (Daily)';
        priceKey = '4. close';
      }

      console.log(`Fetching data for ${symbol} (${assetType})...`);
      const response = await axios.get(url);
      
      // Check for API errors
      if (response.data['Error Message']) {
        throw new Error(`API Error: ${response.data['Error Message']}`);
      }
      
      if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
        throw new Error(`API rate limit reached: ${response.data['Information']}`);
      }
      
      if (response.data['Note']) {
        console.warn(`API Note: ${response.data['Note']}`);
        if (response.data['Note'].includes('call frequency')) {
          throw new Error('API call frequency exceeded');
        }
      }

      // Check if we have the expected data
      if (!response.data[dataKey]) {
        throw new Error(`No data found for ${symbol} under key "${dataKey}"`);
      }

      data = {
        dataKey,
        priceKey,
        data: response.data[dataKey]
      };
      
      // Save to cache
      await saveToCache(symbol, assetType, data);
    }
    
    // Map to your table's enum values
    const mappedAssetType = assetTypeMapping[assetType];
    if (!mappedAssetType) {
      throw new Error(`Invalid asset type mapping for: ${assetType}`);
    }

    // Process the data for database insertion
    const timeSeriesData = isFromCache ? data.data : data.data;
    const actualPriceKey = isFromCache ? data.priceKey : data.priceKey;

    // Use database connection from pool
    const connection = await pool.getConnection();
    let recordCount = 0;
    
    try {
      // Begin transaction
      await connection.beginTransaction();

      // Process each date in the time series
      for (const date in timeSeriesData) {
        const price = parseFloat(timeSeriesData[date][actualPriceKey]);
        if (!isNaN(price)) {
          // Format date as UTC midnight
          const formattedDate = formatDateForDB(date);
          
          // Check if this price already exists for the day
          const [existingPrices] = await connection.query(`
            SELECT * FROM investment_prices 
            WHERE symbol = ? AND DATE(timestamp) = DATE(?)
          `, [symbol, formattedDate]);
          
          if (existingPrices.length > 0) {
            // Update existing price
            await connection.query(`
              UPDATE investment_prices 
              SET price = ? 
              WHERE id = ?
            `, [price.toFixed(4), existingPrices[0].id]);
          } else {
            // Insert new price
            await connection.query(`
              INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
              VALUES (?, ?, ?, ?)
            `, [symbol, price.toFixed(4), formattedDate, mappedAssetType]);
          }
          
          recordCount++;
        } else {
          console.warn(`Invalid price for ${symbol} on ${date}: ${timeSeriesData[date][actualPriceKey]}`);
        }
      }

      // Commit transaction
      await connection.commit();
      console.log(`Successfully processed ${recordCount} historical prices for ${symbol}`);
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection
      connection.release();
    }
  } catch (error) {
    console.error(`Error processing ${symbol} (${assetType}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Check the Alpha Vantage API status
 * @returns {Promise<boolean>} Whether the API is available
 */
async function checkApiStatus() {
  try {
    // Simple API check
    const response = await axios.get(`${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=1min&apikey=${ALPHA_VANTAGE_API_KEY}`);
    
    if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
      console.warn(`API rate limit reached: ${response.data['Information']}`);
      return false;
    }
    
    if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
      console.warn("API call frequency exceeded. Try again later.");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("API check failed:", error.message);
    return false;
  }
}

// Export functions
module.exports = {
  fetchAndStoreCurrentPrices,
  fetchAndStoreHistoricalCrypto,
  fetchHistoricalPrices,
  fetchAndStoreIntradayPrices,
  fetchLastMonthPrices,
  fetchAndStoreLastMonthData,
  checkApiStatus,
  assets,
  assetTypeMapping
};