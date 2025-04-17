/**
 * Complete Historical Data Population Script for FinTrack
 * 
 * This script fetches and stores full historical price data for all assets
 * defined in your application from the beginning of their listing to the
 * present date.
 * 
 * Usage: node populate-historical-data.js [--force] [--category=<category>] [--symbol=<symbol>]
 *   --force      Override existing data
 *   --category   Process only a specific category (stocks, crypto, etfs, forex)
 *   --symbol     Process only a specific symbol (e.g., AAPL, BTC)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const pool = require('../config/db');
const fs = require('fs').promises;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('force', {
    type: 'boolean',
    description: 'Override existing data'
  })
  .option('category', {
    type: 'string',
    description: 'Process only a specific category'
  })
  .option('symbol', {
    type: 'string',
    description: 'Process only a specific symbol'
  })
  .help()
  .argv;

// Configure Alpha Vantage API
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";
const CACHE_DIR = path.join(__dirname, '../services/cache');

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

// Time between API calls (5 seconds = 12 calls per minute, within 5 call limit)
const API_DELAY = 5000;

/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('Cache directory ready');
  } catch (error) {
    console.error('Error creating cache directory:', error.message);
  }
}

/**
 * Logs operation details to a file for reference and resuming
 * @param {string} operation - Operation being performed
 * @param {Object} details - Operation details
 */
async function logOperation(operation, details) {
  try {
    const logFile = path.join(CACHE_DIR, 'operation_log.json');
    
    // Read existing log or create empty array
    let log = [];
    try {
      const logData = await fs.readFile(logFile, 'utf8');
      log = JSON.parse(logData);
    } catch (error) {
      // Ignore if file doesn't exist yet
    }
    
    // Add new entry
    log.push({
      timestamp: new Date().toISOString(),
      operation,
      ...details
    });
    
    // Write updated log
    await fs.writeFile(logFile, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error('Error logging operation:', error.message);
  }
}

/**
 * Check if we've already processed this symbol
 * @param {string} symbol - The asset symbol
 * @param {string} category - Asset category
 * @returns {Promise<boolean>} - Whether this symbol has been processed
 */
async function hasProcessedSymbol(symbol, category) {
  if (argv.force) {
    return false; // Force reprocessing
  }
  
  try {
    // Check if we have data in the database
    const [results] = await pool.query(
      'SELECT COUNT(*) as count FROM investment_prices WHERE symbol = ?',
      [symbol]
    );
    
    return results[0].count > 0;
  } catch (error) {
    console.error(`Error checking processing status for ${symbol}:`, error.message);
    return false;
  }
}

/**
 * Fetch full historical data for a stock or ETF
 * @param {string} symbol - The stock/ETF symbol
 * @returns {Promise<Object>} - The historical data
 */
async function fetchStockHistorical(symbol) {
  console.log(`Fetching full historical data for stock/ETF ${symbol}...`);
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  const response = await axios.get(url);
  
  // Check for API errors
  if (response.data['Error Message']) {
    throw new Error(`API Error: ${response.data['Error Message']}`);
  }
  
  // Check for API limits
  if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
    throw new Error('API call frequency exceeded. Please wait before making another call.');
  }
  
  // Validate response
  if (!response.data['Time Series (Daily)']) {
    throw new Error(`No daily time series data found for ${symbol}`);
  }
  
  return {
    metaData: response.data['Meta Data'],
    timeSeriesData: response.data['Time Series (Daily)'],
    dataKey: '5. adjusted close'
  };
}

/**
 * Fetch full historical data for a cryptocurrency
 * @param {string} symbol - The crypto symbol
 * @returns {Promise<Object>} - The historical data
 */
async function fetchCryptoHistorical(symbol) {
  console.log(`Fetching full historical data for crypto ${symbol}...`);
  const url = `${BASE_URL}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  const response = await axios.get(url);
  
  // Check for API errors
  if (response.data['Error Message']) {
    throw new Error(`API Error: ${response.data['Error Message']}`);
  }
  
  // Check for API limits
  if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
    throw new Error('API call frequency exceeded. Please wait before making another call.');
  }
  
  // Validate response
  if (!response.data['Time Series (Digital Currency Daily)']) {
    throw new Error(`No daily time series data found for ${symbol}`);
  }
  
  return {
    metaData: response.data['Meta Data'],
    timeSeriesData: response.data['Time Series (Digital Currency Daily)'],
    dataKey: '4. close'
  };
}

/**
 * Fetch full historical data for a forex pair
 * @param {string} symbol - The forex symbol
 * @returns {Promise<Object>} - The historical data
 */
async function fetchForexHistorical(symbol) {
  console.log(`Fetching full historical data for forex ${symbol}/USD...`);
  const url = `${BASE_URL}?function=FX_DAILY&from_symbol=${symbol}&to_symbol=USD&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
  
  const response = await axios.get(url);
  
  // Check for API errors
  if (response.data['Error Message']) {
    throw new Error(`API Error: ${response.data['Error Message']}`);
  }
  
  // Check for API limits
  if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
    throw new Error('API call frequency exceeded. Please wait before making another call.');
  }
  
  // Validate response
  if (!response.data['Time Series FX (Daily)']) {
    throw new Error(`No daily time series data found for ${symbol}/USD`);
  }
  
  return {
    metaData: response.data['Meta Data'],
    timeSeriesData: response.data['Time Series FX (Daily)'],
    dataKey: '4. close'
  };
}

/**
 * Store historical data in the database
 * @param {string} symbol - The asset symbol
 * @param {Object} data - The processed historical data
 * @param {string} assetType - The asset type for the database
 * @returns {Promise<number>} - Number of records inserted
 */
async function storeHistoricalData(symbol, data, assetType) {
  console.log(`Processing historical data for ${symbol}...`);
  
  const timeSeriesData = data.timeSeriesData;
  const dataKey = data.dataKey;
  
  // Get database connection from pool
  const connection = await pool.getConnection();
  
  try {
    // Begin transaction
    await connection.beginTransaction();
    
    // Prepare batch insert
    const records = [];
    for (const date in timeSeriesData) {
      const price = parseFloat(timeSeriesData[date][dataKey]);
      if (!isNaN(price)) {
        // Convert date string to MySQL datetime format
        // Ensure timestamp is set to 00:00:00 for daily data
        const formattedDate = new Date(date);
        const utcDate = new Date(Date.UTC(
          formattedDate.getFullYear(),
          formattedDate.getMonth(),
          formattedDate.getDate(),
          0, 0, 0, 0
        ));
        const mysqlDateTime = utcDate.toISOString().slice(0, 19).replace('T', ' ');        
        
        records.push([symbol, price.toFixed(2), mysqlDateTime, assetType]);
      }
    }
    
    console.log(`Prepared ${records.length} historical records for ${symbol}`);
    
    // If no records, just return
    if (records.length === 0) {
      await connection.commit();
      return 0;
    }
    
    // Create temporary table
    await connection.query(`
      CREATE TEMPORARY TABLE temp_investment_prices (
        symbol VARCHAR(10) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        timestamp DATETIME NOT NULL,
        asset_type ENUM('stock','crypto','etf','forex') NOT NULL
      )
    `);
    
    // Insert in batches to prevent memory issues
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Insert batch
      const insertQuery = "INSERT INTO temp_investment_prices (symbol, price, timestamp, asset_type) VALUES ?";
      await connection.query(insertQuery, [batch]);
      
      insertedCount += batch.length;
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} for ${symbol}`);
    }
    
    // Use ON DUPLICATE KEY to handle existing records
    const updateQuery = `
      INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
      SELECT symbol, price, timestamp, asset_type FROM temp_investment_prices
      ON DUPLICATE KEY UPDATE price = VALUES(price)
    `;
    
    await connection.query(updateQuery);
    
    // Drop temporary table
    await connection.query("DROP TEMPORARY TABLE temp_investment_prices");
    
    // Commit transaction
    await connection.commit();
    console.log(`Successfully stored ${insertedCount} historical prices for ${symbol}`);
    
    return insertedCount;
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    throw error;
  } finally {
    // Release connection
    connection.release();
  }
}

/**
 * Process an individual asset
 * @param {string} symbol - Asset symbol
 * @param {string} category - Asset category
 */
async function processAsset(symbol, category) {
  try {
    // Skip if already processed and not forcing
    if (await hasProcessedSymbol(symbol, category) && !argv.force) {
      console.log(`Skipping ${symbol} - already processed. Use --force to reprocess.`);
      await logOperation('skip', { symbol, category, reason: 'already_processed' });
      return;
    }
    
    // Get asset type for database
    const assetType = assetTypeMapping[category];
    if (!assetType) {
      throw new Error(`Unknown asset category: ${category}`);
    }
    
    // Fetch historical data based on asset category
    let historicalData;
    
    switch (category) {
      case 'stocks':
      case 'etfs':
        historicalData = await fetchStockHistorical(symbol);
        break;
      case 'crypto':
        historicalData = await fetchCryptoHistorical(symbol);
        break;
      case 'forex':
        historicalData = await fetchForexHistorical(symbol);
        break;
      default:
        throw new Error(`Unsupported asset category: ${category}`);
    }
    
    // Store data in database
    const recordCount = await storeHistoricalData(symbol, historicalData, assetType);
    
    // Log operation
    await logOperation('process_complete', { 
      symbol, 
      category, 
      recordCount,
      firstDate: Object.keys(historicalData.timeSeriesData).pop(),
      lastDate: Object.keys(historicalData.timeSeriesData)[0]
    });
    
    console.log(`Completed processing ${symbol} - inserted/updated ${recordCount} records`);
  } catch (error) {
    console.error(`Error processing ${symbol}:`, error.message);
    await logOperation('error', { 
      symbol, 
      category, 
      error: error.message 
    });
  }
}

/**
 * Main function to process all assets
 */
async function main() {
  try {
    console.log('Starting full historical data population script');
    console.log(`API rate limiting: ${API_DELAY/1000} seconds between requests`);
    
    // Create cache directory
    await ensureCacheDir();
    
    // Track API calls to stay within limits
    let apiCallsToday = 0;
    
    // Get all assets to process based on command line filters
    let assetsToProcess = [];
    
    if (argv.symbol) {
      // Find the category for this symbol
      let symbolCategory = null;
      for (const category in assets) {
        if (assets[category].includes(argv.symbol)) {
          symbolCategory = category;
          break;
        }
      }
      
      if (symbolCategory) {
        assetsToProcess.push({ symbol: argv.symbol, category: symbolCategory });
      } else {
        console.error(`Symbol ${argv.symbol} not found in any category`);
        process.exit(1);
      }
    } else if (argv.category) {
      // Process all symbols in the specified category
      if (!assets[argv.category]) {
        console.error(`Category ${argv.category} not found`);
        process.exit(1);
      }
      
      assetsToProcess = assets[argv.category].map(symbol => ({ 
        symbol, 
        category: argv.category 
      }));
    } else {
      // Process all assets
      for (const category in assets) {
        for (const symbol of assets[category]) {
          assetsToProcess.push({ symbol, category });
        }
      }
    }
    
    console.log(`Processing ${assetsToProcess.length} assets`);
    
    // Process each asset with API rate limiting
    for (let i = 0; i < assetsToProcess.length; i++) {
      const { symbol, category } = assetsToProcess[i];
      
      // Skip forex "USD" as it's just used as a currency pair
      if (category === 'forex' && symbol === 'USD') continue;
      
      console.log(`Processing ${i+1}/${assetsToProcess.length}: ${symbol} (${category})`);
      
      // Process the asset
      await processAsset(symbol, category);
      apiCallsToday++;
      
      // Check if we're approaching API limits
      if (apiCallsToday >= 450) {
        console.warn('Approaching daily API call limit (450/500). Stopping for today.');
        break;
      }
      
      // Add delay before next API call (except for the last one)
      if (i < assetsToProcess.length - 1) {
        console.log(`Waiting ${API_DELAY/1000} seconds before next API call...`);
        await new Promise(resolve => setTimeout(resolve, API_DELAY));
      }
    }
    
    console.log('Historical data population complete');
    console.log(`Made approximately ${apiCallsToday} API calls`);
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    // Close database connection pool
    await pool.end();
  }
}

// Run the script
main();