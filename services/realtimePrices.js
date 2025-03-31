const axios = require("axios");
require("dotenv").config();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";

// Cache to store prices and reduce API calls
let priceCache = {};
let lastCacheRefresh = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Get real-time price for a symbol
 * @param {string} symbol - Asset symbol
 * @param {string} assetType - Type of asset (stock, crypto, forex, etc.)
 * @returns {Promise<Object>} Price data object
 */
async function getRealTimePrice(symbol, assetType) {
  // Check cache first
  const cacheKey = `${symbol}_${assetType}`;
  const now = new Date();
  
  if (priceCache[cacheKey] && 
      lastCacheRefresh && 
      (now - lastCacheRefresh) < CACHE_DURATION) {
    console.log(`Using cached price for ${symbol}`);
    return priceCache[cacheKey];
  }

  // Determine the correct API function for this asset type
  let apiFunction, responseProcessor;
  
  switch (assetType) {
    case 'crypto':
      apiFunction = 'CURRENCY_EXCHANGE_RATE';
      responseProcessor = processCryptoResponse;
      break;
    case 'stock':
    case 'etf':
      apiFunction = 'GLOBAL_QUOTE';
      responseProcessor = processStockResponse;
      break;
    case 'forex':
      apiFunction = 'CURRENCY_EXCHANGE_RATE';
      responseProcessor = processForexResponse;
      break;
    default:
      throw new Error(`Unsupported asset type: ${assetType}`);
  }

  try {
    console.log(`Fetching real-time price for ${symbol} (${assetType})`);
    
    let params = {};
    
    // Build parameters based on asset type
    if (assetType === 'crypto') {
      params = {
        function: apiFunction,
        from_currency: symbol,
        to_currency: 'USD',
        apikey: ALPHA_VANTAGE_API_KEY
      };
    } else if (assetType === 'forex') {
      params = {
        function: apiFunction,
        from_currency: symbol,
        to_currency: 'USD',
        apikey: ALPHA_VANTAGE_API_KEY
      };
    } else {
      // Stock/ETF
      params = {
        function: apiFunction,
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      };
    }
    
    // Make API request
    const response = await axios.get(BASE_URL, { params });
    
    // Process response based on asset type
    const result = responseProcessor(response.data, symbol);
    
    // Update cache
    priceCache[cacheKey] = result;
    lastCacheRefresh = now;
    
    return result;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    // In case of API error, return a default response
    return {
      symbol: symbol,
      price: null,
      change: null,
      changePercent: null,
      error: error.message
    };
  }
}

/**
 * Process crypto API response
 */
function processCryptoResponse(data, symbol) {
  if (data['Realtime Currency Exchange Rate']) {
    const exchangeRate = data['Realtime Currency Exchange Rate'];
    const price = parseFloat(exchangeRate['5. Exchange Rate']);
    
    // Crypto doesn't provide direct change data in this endpoint,
    // so we'll return just the current price
    return {
      symbol: symbol,
      price: price,
      currency: 'USD',
      lastUpdated: exchangeRate['6. Last Refreshed'] || new Date().toISOString(),
      change: null,
      changePercent: null
    };
  }
  
  throw new Error(`Invalid response for ${symbol}`);
}

/**
 * Process stock/ETF API response
 */
function processStockResponse(data, symbol) {
  if (data['Global Quote']) {
    const quote = data['Global Quote'];
    
    // Extract data
    const price = parseFloat(quote['05. price']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
    
    return {
      symbol: symbol,
      price: price,
      change: change,
      changePercent: changePercent,
      volume: parseInt(quote['06. volume'], 10),
      tradingDay: quote['07. latest trading day'],
      currency: 'USD'
    };
  }
  
  throw new Error(`Invalid response for ${symbol}`);
}

/**
 * Process forex API response
 */
function processForexResponse(data, symbol) {
  if (data['Realtime Currency Exchange Rate']) {
    const exchangeRate = data['Realtime Currency Exchange Rate'];
    const price = parseFloat(exchangeRate['5. Exchange Rate']);
    
    return {
      symbol: symbol,
      price: price,
      currency: 'USD',
      lastUpdated: exchangeRate['6. Last Refreshed'] || new Date().toISOString(),
      change: null,
      changePercent: null
    };
  }
  
  throw new Error(`Invalid response for ${symbol}`);
}

/**
 * Get real-time prices for multiple symbols
 * @param {Array<Object>} assets - Array of asset objects with symbol and type properties
 * @returns {Promise<Object>} - Object mapping symbols to price data
 */
async function getBatchRealTimePrices(assets) {
  // Use some rate limiting to avoid API limits
  const batchResults = {};
  
  // Process in batches of 5 with delay between batches
  for (let i = 0; i < assets.length; i += 5) {
    const batch = assets.slice(i, i + 5);
    
    // Process batch in parallel
    const batchPromises = batch.map(asset => 
      getRealTimePrice(asset.symbol, asset.assetType)
        .then(result => {
          batchResults[asset.symbol] = result;
        })
        .catch(err => {
          console.error(`Error fetching price for ${asset.symbol}:`, err);
          batchResults[asset.symbol] = {
            symbol: asset.symbol,
            price: null,
            error: err.message
          };
        })
    );
    
    await Promise.all(batchPromises);
    
    // Add delay between batches to respect API rate limits
    if (i + 5 < assets.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return batchResults;
}

/**
 * Clear the price cache
 */
function clearPriceCache() {
  priceCache = {};
  lastCacheRefresh = null;
  console.log('Price cache cleared');
}

module.exports = {
  getRealTimePrice,
  getBatchRealTimePrices,
  clearPriceCache
};