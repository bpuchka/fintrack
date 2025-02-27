const axios = require("axios");
const pool = require("../config/db");
const fs = require('fs').promises;
const path = require('path');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DIR = path.join(__dirname, 'cache');

// Asset categories and symbols
const assets = {
  //stocks: ["AAPL", "NVDA", "TSLA"],
 // etfs: ["GLD", "SLV"],  // Changed from commodities to etfs
  crypto: ["BTC", "ETH", "USDT", "XRP", "SOL"],
  //forex: ["EUR", "BGN", "GBP"] // These will be paired with USD
};

// Map asset types to your table's enum values
const assetTypeMapping = {
  'stocks': 'stock',
  'etfs': 'etf',         // Changed from commodities to etfs
  'crypto': 'crypto',
  'forex': 'forex'
};

// Map for API request type - GLD and SLV need to be treated as stocks for API calls
const apiRequestTypeMapping = {
  'stocks': 'stocks',
  'etfs': 'stocks',     // ETFs use stock API endpoints
  'crypto': 'crypto',
  'forex': 'forex'
};

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
      
      // Get the appropriate API request type for this asset
      const apiRequestType = apiRequestTypeMapping[assetType] || assetType;
      
      // Different endpoints based on API request type
      if (apiRequestType === 'stocks') {
        url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Daily)';
        priceKey = '4. close';
      } else if (apiRequestType === 'crypto') {
        url = `${BASE_URL}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series (Digital Currency Daily)';
        priceKey = '4. close';  // Fixed: Changed from '4a. close (USD)' to '4. close'
      } else if (apiRequestType === 'forex') {
        url = `${BASE_URL}?function=FX_DAILY&from_symbol=${symbol}&to_symbol=USD&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
        dataKey = 'Time Series FX (Daily)';
        priceKey = '4. close';
      }

      console.log(`Fetching data for ${symbol} (${assetType}) using ${apiRequestType} endpoint...`);
      const response = await axios.get(url);
      
      // Log response keys for debugging
      console.log(`API response keys for ${symbol}:`, Object.keys(response.data));
      
      // Check for API error messages
      if (response.data['Error Message']) {
        throw new Error(`API Error: ${response.data['Error Message']}`);
      }
      
      // Check for rate limit
      if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
        throw new Error(`API rate limit reached: ${response.data['Information']}`);
      }
      
      if (response.data['Note']) {
        console.warn(`API Note: ${response.data['Note']}`);
        if (response.data['Note'].includes('call frequency')) {
          throw new Error('API call frequency exceeded');
        }
      }

      // Check if we have the expected data structure
      if (!response.data[dataKey]) {
        console.error(`Data structure for ${symbol} is:`, JSON.stringify(response.data, null, 2));
        throw new Error(`No data found for ${symbol} under key "${dataKey}"`);
      }

      // Log first data entry to verify structure
      const dateKeys = Object.keys(response.data[dataKey]);
      if (dateKeys.length > 0) {
        const firstDate = dateKeys[0];
        console.log(`Sample data for ${symbol} on ${firstDate}:`, 
          JSON.stringify(response.data[dataKey][firstDate], null, 2));
        console.log(`Price using key "${priceKey}":`, response.data[dataKey][firstDate][priceKey]);
      }

      data = {
        dataKey,
        priceKey,
        data: response.data[dataKey]
      };
      
      // Save successful response to cache
      await saveToCache(symbol, assetType, data);
    }
    
    // Map to your table's enum values
    const mappedAssetType = assetTypeMapping[assetType];
    if (!mappedAssetType) {
      throw new Error(`Invalid asset type mapping for: ${assetType}`);
    }

    // If we're using cached data, the structure is different
    const timeSeriesData = isFromCache ? data.data : data.data;
    const actualPriceKey = isFromCache ? data.priceKey : data.priceKey;

    // Use database connection from pool
    const connection = await pool.getConnection();
    
    try {
      // Begin transaction for better performance with many inserts
      await connection.beginTransaction();

      // Prepare and execute batch insert
      const records = [];
      for (const date in timeSeriesData) {
        const price = parseFloat(timeSeriesData[date][actualPriceKey]);
        if (!isNaN(price)) {
          // Format date as MySQL datetime
          const formattedDate = new Date(date).toISOString().slice(0, 19).replace('T', ' ');
          records.push([symbol, price.toFixed(2), formattedDate, mappedAssetType]);
        } else {
          console.warn(`Invalid price for ${symbol} on ${date}: ${timeSeriesData[date][actualPriceKey]}`);
        }
      }

      // Check if we have any valid records
      if (records.length > 0) {
        // Create temporary table for the batch that matches your schema
        await connection.query(`
          CREATE TEMPORARY TABLE temp_investment_prices (
            symbol VARCHAR(10) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            timestamp DATETIME NOT NULL,
            asset_type ENUM('stock','crypto','etf','forex') NOT NULL
          )
        `);

        // Insert records into temporary table
        const insertQuery = "INSERT INTO temp_investment_prices (symbol, price, timestamp, asset_type) VALUES ?";
        await connection.query(insertQuery, [records]);

        // Move data from temporary table to actual table with ON DUPLICATE KEY UPDATE
        await connection.query(`
          INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
          SELECT symbol, price, timestamp, asset_type FROM temp_investment_prices
          ON DUPLICATE KEY UPDATE price = VALUES(price)
        `);

        // Drop temporary table
        await connection.query("DROP TEMPORARY TABLE temp_investment_prices");

        // Commit the transaction
        await connection.commit();
        console.log(`Successfully stored ${records.length} historical prices for ${symbol}`);
      } else {
        console.warn(`No valid price records found for ${symbol}`);
        await connection.commit();
      }
    } catch (error) {
      // Rollback in case of error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }
  } catch (error) {
    console.error(`Error processing ${symbol} (${assetType}):`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    // Rethrow rate limit errors so the main function can handle them
    if (error.message.includes('rate limit') || error.message.includes('call frequency')) {
      throw error;
    }
  }
}

/**
 * Fetch and store historical data for all assets with proper rate limiting
 * @param {number} batchSize - Number of assets to process in each batch (optional)
 * @param {number} delay - Delay in milliseconds between requests (optional)
 * @param {boolean} useCache - Whether to use cached data if available
 * @returns {Promise<void>}
 */
async function fetchAndStoreHistoricalPrices(batchSize = 5, delay = 15000, useCache = true) {
  try {
    console.log("Starting historical data fetch...");
    console.log(`Using batch size: ${batchSize}, delay: ${delay}ms, useCache: ${useCache}`);
    
    // Create a flat list of all asset requests
    const requests = [];
    for (const type in assets) {
      const symbols = assets[type];
      for (const symbol of symbols) {
        requests.push({ symbol, type });
      }
    }
    
    // Counter for API calls to monitor rate limit
    let apiCallsMade = 0;
    const maxApiCalls = 25; // Free tier limit
    
    // Process requests
    for (let i = 0; i < requests.length; i++) {
      const { symbol, type } = requests[i];
      
      try {
        // Skip if we're about to exceed API limit
        if (apiCallsMade >= maxApiCalls && !useCache) {
          console.warn(`Stopping due to API rate limit (${apiCallsMade}/${maxApiCalls} calls made)`);
          break;
        }
        
        // Try to fetch data (will use cache if available and requested)
        await fetchHistoricalPrices(symbol, type, useCache);
        
        // Only increment counter if the request likely used an API call
        if (!useCache || !(await hasCachedData(symbol, type))) {
          apiCallsMade++;
        }
        
        // If we have more requests to process, wait before the next one
        if (i < requests.length - 1) {
          console.log(`Waiting ${delay/1000} seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        // If we hit a rate limit, stop processing
        if (error.message.includes('rate limit') || error.message.includes('call frequency')) {
          console.warn(`API rate limit reached after ${apiCallsMade} calls. Stopping.`);
          break;
        }
      }
    }
    
    console.log(`Finished fetching and storing data. Made ${apiCallsMade} API calls out of ${maxApiCalls} daily limit.`);
  } catch (error) {
    console.error("Error during batch processing:", error.message);
  }
}

/**
 * Check the Alpha Vantage API status by making a simple request
 */
async function checkApiStatus() {
  try {
    // Check if we can access the API
    const response = await axios.get(`${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=1min&apikey=${ALPHA_VANTAGE_API_KEY}`);
    
    // Check for rate limit in the response
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

// Export functions for use in other modules
module.exports = {
  fetchAndStoreHistoricalPrices,
  checkApiStatus,
  assets
};