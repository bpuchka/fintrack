// scripts/fetch-btc-prices.js
require('dotenv').config();
const axios = require('axios');
const pool = require('../config/db');

/**
 * Script to fetch real Bitcoin prices from CoinGecko API and store them in the database
 * Run this with: node scripts/fetch-btc-prices.js
 * 
 * Note: CoinGecko API has rate limits, so this is for demonstration purposes
 */
async function fetchBitcoinPrices() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Fetching Bitcoin price data from CoinGecko...');
    
    // Fetch BTC price history for the last 90 days (max without API key)
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart', 
      {
        params: {
          vs_currency: 'usd',
          days: '90',
          interval: 'daily'
        }
      }
    );
    
    if (!response.data || !response.data.prices || !Array.isArray(response.data.prices)) {
      throw new Error('Invalid data received from CoinGecko API');
    }
    
    console.log(`Received ${response.data.prices.length} price points for BTC`);
    
    // Clear existing BTC prices to avoid duplicates
    await connection.query(`
      DELETE FROM investment_prices WHERE symbol = 'BTC'
    `);
    
    console.log('Cleared existing BTC price data.');
    
    // Insert new price data
    let insertCount = 0;
    
    for (const pricePoint of response.data.prices) {
      const timestamp = new Date(pricePoint[0]); // Unix timestamp in milliseconds
      const price = pricePoint[1]; // Price in USD
      
      await connection.query(`
        INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
        VALUES (?, ?, ?, ?)
      `, ['BTC', price, timestamp, 'crypto']);
      
      insertCount++;
    }
    
    console.log(`Successfully inserted ${insertCount} BTC price points.`);
    
  } catch (error) {
    console.error('Error fetching/storing Bitcoin prices:', error);
    
    // If API call fails, insert some realistic mock data
    if (error.response && error.response.status === 429) {
      console.log('Rate limit exceeded. Inserting mock data instead...');
      await insertMockBitcoinData(connection);
    }
  } finally {
    // Release connection
    connection.release();
  }
}

/**
 * Insert mock Bitcoin price data if API call fails
 * @param {Object} connection - MySQL connection
 */
async function insertMockBitcoinData(connection) {
  try {
    // Base price and volatility for BTC
    const basePrice = 35000;
    const volatility = 2000;
    
    // Generate price data for the last 90 days
    const days = 90;
    const now = new Date();
    
    // Clear existing BTC prices
    await connection.query(`
      DELETE FROM investment_prices WHERE symbol = 'BTC'
    `);
    
    console.log('Cleared existing BTC price data.');
    
    let insertCount = 0;
    
    for (let i = days; i >= 0; i--) {
      // Calculate date (going backward from today)
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some random volatility to the price
      // Use a random walk pattern for more realistic price movement
      const change = (Math.random() * 2 - 1) * volatility * Math.sqrt(1/days);
      const trendFactor = 0.005; // Small upward trend
      const trend = basePrice * trendFactor * (1 - i/days);
      
      // Calculate price with some randomness and trend
      let price = basePrice + change + trend;
      
      // Ensure price doesn't go negative
      if (price <= 0) {
        price = basePrice * 0.1; // Minimum price is 10% of base price
      }
      
      // Insert the price data
      await connection.query(`
        INSERT INTO investment_prices (symbol, price, timestamp, asset_type)
        VALUES (?, ?, ?, ?)
      `, ['BTC', price, date, 'crypto']);
      
      insertCount++;
    }
    
    console.log(`Successfully inserted ${insertCount} mock BTC price points.`);
  } catch (error) {
    console.error('Error inserting mock Bitcoin data:', error);
  }
}

// Run the script
fetchBitcoinPrices()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });