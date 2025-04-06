const axios = require("axios");
const pool = require("../config/db");
const fs = require('fs').promises;
const path = require('path');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DIR = path.join(__dirname, 'cache');

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
        
        // Create record
        const price = prices[symbol].price;
        const formattedDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        records.push([baseSymbol, price, formattedDate, mappedAssetType]);
      }
      
      // Insert into database if we have records
      if (records.length > 0) {
        // Create temporary table
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
        
        // Move data to actual table with ON DUPLICATE KEY UPDATE
        await connection.query(`
          INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
          SELECT symbol, price, timestamp, asset_type FROM temp_investment_prices
          ON DUPLICATE KEY UPDATE price = VALUES(price)
        `);
        
        // Drop temporary table
        await connection.query("DROP TEMPORARY TABLE temp_investment_prices");
        
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
    
    try {
      // Begin transaction
      await connection.beginTransaction();

      // Prepare batch insert
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

      // Insert records if we have any
      if (records.length > 0) {
        // Create temporary table
        await connection.query(`
          CREATE TEMPORARY TABLE temp_investment_prices (
            symbol VARCHAR(10) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            timestamp DATETIME NOT NULL,
            asset_type ENUM('stock','crypto','etf','forex') NOT NULL
          )
        `);

        // Insert records
        const insertQuery = "INSERT INTO temp_investment_prices (symbol, price, timestamp, asset_type) VALUES ?";
        await connection.query(insertQuery, [records]);

        // Move data to actual table
        await connection.query(`
          INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
          SELECT symbol, price, timestamp, asset_type FROM temp_investment_prices
          ON DUPLICATE KEY UPDATE price = VALUES(price)
        `);

        // Drop temporary table
        await connection.query("DROP TEMPORARY TABLE temp_investment_prices");

        // Commit transaction
        await connection.commit();
        console.log(`Successfully stored ${records.length} historical prices for ${symbol}`);
      } else {
        console.warn(`No valid price records found for ${symbol}`);
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
  checkApiStatus,
  assets
};