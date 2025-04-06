// scripts/check-tables.js
require('dotenv').config();
const pool = require('../config/db');

/**
 * Script to check and create necessary tables for the asset page
 * Run this with: node scripts/check-tables.js
 */
async function checkAndCreateTables() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Checking for required tables...');
    
    // Check if investment_prices table exists
    const [priceTableExists] = await connection.query(`
      SHOW TABLES LIKE 'investment_prices'
    `);
    
    if (priceTableExists.length === 0) {
      console.log('Creating investment_prices table...');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS investment_prices (
          id INT NOT NULL AUTO_INCREMENT,
          symbol VARCHAR(10) NOT NULL,
          price DECIMAL(15,4) NOT NULL,
          timestamp DATETIME NOT NULL,
          asset_type ENUM('stock', 'crypto', 'commodity', 'forex', 'etf') NULL DEFAULT NULL,
          PRIMARY KEY (id),
          INDEX (symbol, timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      console.log('investment_prices table created.');
    } else {
      console.log('investment_prices table exists.');
    }
    
    // Check if transactions table exists
    const [transactionsTableExists] = await connection.query(`
      SHOW TABLES LIKE 'transactions'
    `);
    
    if (transactionsTableExists.length === 0) {
      console.log('Creating transactions table...');
      
      await connection.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          symbol VARCHAR(10) NOT NULL,
          action ENUM('buy', 'sell') NOT NULL,
          quantity DECIMAL(15,8) NOT NULL,
          price DECIMAL(15,4) NOT NULL,
          total DECIMAL(15,4) NOT NULL,
          transaction_date DATETIME NOT NULL,
          PRIMARY KEY (id),
          INDEX (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      console.log('transactions table created.');
    } else {
      console.log('transactions table exists.');
    }
    
    // Insert sample data if investment_prices is empty
    const [priceCount] = await connection.query(`
      SELECT COUNT(*) as count FROM investment_prices
    `);
    
    if (priceCount[0].count === 0) {
      console.log('Inserting sample price data...');
      
      // Sample data for BTC (Bitcoin)
      await insertSampleData(connection, 'BTC', 35000, 5000, 'crypto');
      
      // Sample data for AAPL (Apple)
      await insertSampleData(connection, 'AAPL', 175, 15, 'stock');
      
      // Sample data for ETH (Ethereum)
      await insertSampleData(connection, 'ETH', 2000, 300, 'crypto');
      
      // Sample data for TSLA (Tesla)
      await insertSampleData(connection, 'TSLA', 250, 25, 'stock');
      
      // Sample data for GLD (Gold ETF)
      await insertSampleData(connection, 'GLD', 190, 10, 'metal');
      
      console.log('Sample price data inserted.');
    }
    
    console.log('Database check completed.');
  } catch (error) {
    console.error('Error checking/creating tables:', error);
  } finally {
    // Release connection
    connection.release();
  }
}

/**
 * Insert sample price data for a symbol
 * @param {Object} connection - MySQL connection
 * @param {string} symbol - Asset symbol
 * @param {number} basePrice - Base price
 * @param {number} volatility - Price volatility (max deviation in absolute value)
 * @param {string} assetType - Type of asset
 */
async function insertSampleData(connection, symbol, basePrice, volatility, assetType) {
  // Generate price data for the last 60 days
  const days = 60;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    // Calculate date (going backward from today)
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Multiple price points per day for more detail
    for (let hour = 0; hour < 24; hour += 4) {
      date.setHours(hour);
      
      // Add some random volatility to the price
      const change = (Math.random() * 2 - 1) * volatility;
      const trendFactor = 0.01; // Small upward trend
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
      `, [symbol, price, date, assetType]);
    }
  }
  
  console.log(`Sample data inserted for ${symbol}`);
}

// Run the script
checkAndCreateTables()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });