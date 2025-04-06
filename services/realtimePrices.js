// services/realtimePrices.js
const axios = require("axios");
require("dotenv").config();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";

// Cache to store prices with appropriate duration
let priceCache = {};
let lastCacheRefresh = null;
const CACHE_DURATION = 55 * 1000; // 55 seconds cache (just under 1 minute)

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
    console.log(`Using cached price for ${symbol} (expires in ${((CACHE_DURATION - (now - lastCacheRefresh))/1000).toFixed(1)}s)`);
    return priceCache[cacheKey];
  }

  // Determine the correct API function for this asset type
  let apiFunction, responseProcessor, additionalParams = {};
  
  switch (assetType) {
    case 'crypto':
      apiFunction = 'CRYPTO_INTRADAY';
      responseProcessor = processIntradayCryptoResponse;
      additionalParams = {
        symbol: symbol,
        market: 'USD',
        interval: '1min',
        outputsize: 'compact' // Just need the latest data
      };
      break;
    case 'stock':
    case 'etf':
      apiFunction = 'GLOBAL_QUOTE';
      responseProcessor = processStockResponse;
      additionalParams = {
        symbol: symbol
      };
      break;
    case 'forex':
      apiFunction = 'FX_INTRADAY';
      responseProcessor = processIntradayForexResponse;
      additionalParams = {
        from_symbol: symbol,
        to_symbol: 'USD',
        interval: '1min',
        outputsize: 'compact' // Just need the latest data
      };
      break;
    default:
      throw new Error(`Unsupported asset type: ${assetType}`);
  }

  try {
    console.log(`Fetching real-time price for ${symbol} (${assetType}) using ${apiFunction}`);
    
    // Build the common parameters
    const params = {
      function: apiFunction,
      apikey: ALPHA_VANTAGE_API_KEY,
      ...additionalParams
    };
    
    // Make API request
    const response = await axios.get(BASE_URL, { params });
    
    // Check for API limits or errors in the response
    if (response.data['Note'] || response.data['Information']) {
      console.warn(`API Note for ${symbol}:`, response.data['Note'] || response.data['Information']);
    }
    
    // Process response based on asset type
    const result = responseProcessor(response.data, symbol);
    
    console.log(`New price data for ${symbol}: Price=${result.price}, Change=${result.change}, Last Updated=${result.lastUpdated}`);
    
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
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Process intraday crypto API response
 */
function processIntradayCryptoResponse(data, symbol) {
  // Check for metadata and time series
  const metaDataKey = 'Meta Data';
  const timeSeriesKey = `Time Series Crypto (1min)`;
  
  if (!data[metaDataKey] || !data[timeSeriesKey]) {
    throw new Error(`Invalid intraday crypto response for ${symbol}`);
  }
  
  // Get the most recent timestamp
  const timestamps = Object.keys(data[timeSeriesKey]);
  if (timestamps.length === 0) {
    throw new Error(`No data points in intraday crypto response for ${symbol}`);
  }
  
  // Sort timestamps in descending order (newest first)
  timestamps.sort((a, b) => new Date(b) - new Date(a));
  const latestTimestamp = timestamps[0];
  const latestData = data[timeSeriesKey][latestTimestamp];
  
  // Calculate change and change percentage if possible
  let change = null;
  let changePercent = null;
  
  if (timestamps.length > 1) {
    const prevTimestamp = timestamps[1];
    const prevData = data[timeSeriesKey][prevTimestamp];
    
    const latestPrice = parseFloat(latestData['4. close']);
    const prevPrice = parseFloat(prevData['4. close']);
    
    change = latestPrice - prevPrice;
    changePercent = (change / prevPrice) * 100;
  }
  
  return {
    symbol: symbol,
    price: parseFloat(latestData['4. close']),
    open: parseFloat(latestData['1. open']),
    high: parseFloat(latestData['2. high']),
    low: parseFloat(latestData['3. low']),
    volume: parseFloat(latestData['5. volume']),
    change: change,
    changePercent: changePercent,
    currency: 'USD',
    lastUpdated: latestTimestamp
  };
}

/**
 * Process intraday forex API response
 */
function processIntradayForexResponse(data, symbol) {
  // Check for metadata and time series
  const metaDataKey = 'Meta Data';
  const timeSeriesKey = `Time Series FX (1min)`;
  
  if (!data[metaDataKey] || !data[timeSeriesKey]) {
    throw new Error(`Invalid intraday forex response for ${symbol}`);
  }
  
  // Get the most recent timestamp
  const timestamps = Object.keys(data[timeSeriesKey]);
  if (timestamps.length === 0) {
    throw new Error(`No data points in intraday forex response for ${symbol}`);
  }
  
  // Sort timestamps in descending order (newest first)
  timestamps.sort((a, b) => new Date(b) - new Date(a));
  const latestTimestamp = timestamps[0];
  const latestData = data[timeSeriesKey][latestTimestamp];
  
  // Calculate change and change percentage if possible
  let change = null;
  let changePercent = null;
  
  if (timestamps.length > 1) {
    const prevTimestamp = timestamps[1];
    const prevData = data[timeSeriesKey][prevTimestamp];
    
    const latestPrice = parseFloat(latestData['4. close']);
    const prevPrice = parseFloat(prevData['4. close']);
    
    change = latestPrice - prevPrice;
    changePercent = (change / prevPrice) * 100;
  }
  
  return {
    symbol: symbol,
    price: parseFloat(latestData['4. close']),
    open: parseFloat(latestData['1. open']),
    high: parseFloat(latestData['2. high']),
    low: parseFloat(latestData['3. low']),
    change: change,
    changePercent: changePercent,
    currency: 'USD',
    lastUpdated: latestTimestamp
  };
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
      currency: 'USD',
      lastUpdated: new Date().toISOString()
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
  // Utilizing paid tier capacity (75 calls per minute)
  const batchResults = {};
  
  // Check if we need to refresh data
  const now = new Date();
  const needsRefresh = !lastCacheRefresh || (now - lastCacheRefresh) >= CACHE_DURATION;
  
  if (!needsRefresh) {
    console.log(`Using cached data for batch (expires in ${((CACHE_DURATION - (now - lastCacheRefresh))/1000).toFixed(1)}s)`);
    
    // Return cached data for all requested assets
    for (const asset of assets) {
      const cacheKey = `${asset.symbol}_${asset.assetType}`;
      if (priceCache[cacheKey]) {
        batchResults[asset.symbol] = priceCache[cacheKey];
      }
    }
    
    // Only fetch data for assets not in cache
    const uncachedAssets = assets.filter(asset => {
      const cacheKey = `${asset.symbol}_${asset.assetType}`;
      return !priceCache[cacheKey];
    });
    
    if (uncachedAssets.length === 0) {
      return batchResults;
    }
    
    // Continue with fetching only uncached assets
    assets = uncachedAssets;
  }
  
  console.log(`Fetching fresh data for ${assets.length} assets`);
  
  // Process in batches of 10 to maximize throughput while respecting API limits
  for (let i = 0; i < assets.length; i += 10) {
    const batch = assets.slice(i, i + 10);
    
    // Process batch in parallel - with premium API we can make more concurrent requests
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
            error: err.message,
            lastUpdated: new Date().toISOString()
          };
        })
    );
    
    await Promise.all(batchPromises);
    
    // Add a short delay between batches to prevent rate limiting
    if (i + 10 < assets.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Update last cache refresh time
  lastCacheRefresh = now;
  
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

// Clear cache periodically to ensure fresh data
setInterval(clearPriceCache, 10 * 60 * 1000); // Clear every 10 minutes

module.exports = {
  getRealTimePrice,
  getBatchRealTimePrices,
  clearPriceCache
};