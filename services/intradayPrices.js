// services/intradayPrices.js
const axios = require("axios");
require("dotenv").config();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";

/**
 * Fetch intraday prices from Alpha Vantage for a specific symbol
 * 
 * @param {string} symbol - The asset symbol (e.g., BTC, AAPL)
 * @param {string} assetType - The asset type (crypto, stock, forex, etc.)
 * @returns {Promise<Array>} - Array of price data objects with timestamp and price
 */
async function fetchIntradayPrices(symbol, assetType) {
  try {
    console.log(`Fetching intraday prices for ${symbol} (${assetType})...`);
    
    let url;
    let dataKey;
    let priceKey;
    
    // Configure API call based on asset type
    if (assetType === 'stock' || assetType === 'etf' || assetType === 'metal') {
      // For stocks, ETFs, and metals use intraday data
      url = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Time Series (5min)';
      priceKey = '4. close';
    } else if (assetType === 'crypto') {
      // For crypto use digital currency intraday
      url = `${BASE_URL}?function=CRYPTO_INTRADAY&symbol=${symbol}&market=USD&interval=5min&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Time Series Crypto (5min)';
      priceKey = '4. close';
    } else if (assetType === 'forex') {
      // For forex use FX intraday
      url = `${BASE_URL}?function=FX_INTRADAY&from_symbol=${symbol}&to_symbol=USD&interval=5min&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;
      dataKey = 'Time Series FX (5min)';
      priceKey = '4. close';
    } else {
      throw new Error(`Unsupported asset type: ${assetType}`);
    }
    
    // Make API request
    const response = await axios.get(url);
    
    // Handle API errors
    if (response.data['Error Message']) {
      throw new Error(`API Error: ${response.data['Error Message']}`);
    }
    
    if (response.data['Information'] && response.data['Information'].includes('API rate limit')) {
      console.warn(`API rate limit reached for ${symbol}, falling back to alternative data`);
      return null; // Signal caller to fall back to other methods
    }
    
    if (response.data['Note'] && response.data['Note'].includes('call frequency')) {
      console.warn(`API call frequency exceeded for ${symbol}, falling back to alternative data`);
      return null; // Signal caller to fall back to other methods
    }
    
    // Check if we have the expected data
    if (!response.data[dataKey]) {
      console.error(`Missing data key "${dataKey}" for ${symbol}`);
      console.error(`Available keys: ${Object.keys(response.data).join(', ')}`);
      return null;
    }
    
    // Parse the time series data
    const timeSeriesData = response.data[dataKey];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Format for Chart.js - only include prices from today
    const priceData = [];
    
    for (const timestamp in timeSeriesData) {
      const date = new Date(timestamp);
      
      // Only include today's data for the daily view
      if (date >= today) {
        const price = parseFloat(timeSeriesData[timestamp][priceKey]);
        
        priceData.push({
          timestamp: timestamp,
          price: price
        });
      }
    }
    
    // Sort by timestamp (oldest first)
    priceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log(`Retrieved ${priceData.length} intraday price points for ${symbol}`);
    return priceData;
  } catch (error) {
    console.error(`Error fetching intraday prices for ${symbol}:`, error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return null; // Signal caller to fall back to other methods
  }
}

/**
 * Generate realistic intraday data when API fails
 * @param {string} symbol - Asset symbol
 * @returns {Array} - Array of price data objects
 */
function generateIntradayFallbackData(symbol) {
  console.log(`Generating fallback intraday data for ${symbol}`);
  
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
  const volatility = isVolatile ? 0.005 : 0.002; // Reduced for more realistic intraday
  
  // Generate data points for today
  const prices = [];
  let currentPrice = basePrice;
  const now = new Date();
  const marketOpen = new Date(now);
  
  // Set market open to 9:30 AM for current day
  marketOpen.setHours(9, 30, 0, 0);
  
  // If current time is before market open, use yesterday's close as starting point
  if (now < marketOpen) {
    marketOpen.setDate(marketOpen.getDate() - 1);
  }
  
  // Generate points from market open to now
  const totalMinutes = Math.floor((now - marketOpen) / (1000 * 60));
  const interval = 5; // 5-minute intervals
  const numPoints = Math.floor(totalMinutes / interval);
  
  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(marketOpen);
    timestamp.setMinutes(marketOpen.getMinutes() + (i * interval));
    
    // Add some random price movement
    const change = currentPrice * (Math.random() * volatility * 2 - volatility);
    
    // Add slight trend
    const trendDirection = Math.random() > 0.48 ? 1 : -1; // Slight bullish bias
    const trend = currentPrice * 0.0002 * trendDirection;
    
    currentPrice += change + trend;
    
    // Ensure price doesn't go too low
    if (currentPrice < basePrice * 0.9) {
      currentPrice = basePrice * 0.9 + (Math.random() * basePrice * 0.02);
    }
    
    // Add some mean reversion to prevent prices from drifting too far
    if (currentPrice > basePrice * 1.1) {
      currentPrice -= currentPrice * 0.01;
    } else if (currentPrice < basePrice * 0.9) {
      currentPrice += currentPrice * 0.01;
    }
    
    prices.push({
      timestamp: timestamp.toISOString(),
      price: currentPrice
    });
  }
  
  return prices;
}

module.exports = {
  fetchIntradayPrices,
  generateIntradayFallbackData
};