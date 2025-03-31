// routes/realtime-prices.routes.js
const express = require("express");
const router = express.Router();
const { getRealTimePrice, getBatchRealTimePrices } = require("../services/realtimePrices");

/**
 * Define common asset mappings for API calls
 */
const SUPPORTED_ASSETS = {
  // Crypto
  'BTC': { type: 'crypto', name: 'Bitcoin' },
  'ETH': { type: 'crypto', name: 'Ethereum' },
  'USDT': { type: 'crypto', name: 'Tether' },
  'XRP': { type: 'crypto', name: 'Ripple' },
  'SOL': { type: 'crypto', name: 'Solana' },
  
  // Stocks
  'AAPL': { type: 'stock', name: 'Apple Inc.' },
  'NVDA': { type: 'stock', name: 'NVIDIA Corporation' },
  'TSLA': { type: 'stock', name: 'Tesla Inc.' },
  
  // ETFs (Metals)
  'GLD': { type: 'etf', name: 'SPDR Gold Shares' },
  'SLV': { type: 'etf', name: 'iShares Silver Trust' },
  
  // Forex
  'EUR': { type: 'forex', name: 'Euro' },
  'BGN': { type: 'forex', name: 'Bulgarian Lev' },
  'GBP': { type: 'forex', name: 'British Pound' }
};

/**
 * Get asset mappings
 * Route: GET /api/realtime-prices/assets/mappings
 */
router.get("/assets/mappings", (req, res) => {
  res.json(SUPPORTED_ASSETS);
});

/**
 * Get real-time price for a single asset
 * Route: GET /api/realtime-prices/:symbol?type=assetType
 */
router.get("/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const assetType = req.query.type || 'stock'; // Default to stock if not specified
    
    const priceData = await getRealTimePrice(symbol, assetType);
    
    if (!priceData || priceData.error) {
      return res.status(404).json({
        success: false,
        message: priceData?.error || "Failed to fetch price data",
        data: null
      });
    }
    
    res.json({
      success: true,
      data: priceData
    });
  } catch (error) {
    console.error("Error fetching real-time price:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time price data",
      error: error.message
    });
  }
});

/**
 * Get real-time prices for multiple assets
 * Route: POST /api/realtime-prices/batch
 * Body: { assets: [{ symbol: 'AAPL', assetType: 'stock' }, ...] }
 */
router.post("/batch", async (req, res) => {
  try {
    const { assets } = req.body;
    
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Please provide an array of assets."
      });
    }
    
    // Limit to 50 assets per request - using paid tier capacity
    if (assets.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Too many assets requested. Maximum 50 assets per request."
      });
    }
    
    const priceData = await getBatchRealTimePrices(assets);
    
    res.json({
      success: true,
      data: priceData
    });
  } catch (error) {
    console.error("Error fetching batch real-time prices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch batch real-time price data",
      error: error.message
    });
  }
});

module.exports = router;