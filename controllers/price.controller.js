// controllers/price.controller.js
const Price = require("../models/price.model");

// Get all prices
exports.getAllPrices = async (req, res) => {
    try {
      const prices = await Price.getAll();
      res.json(prices);
    } catch (error) {
      console.error("Error in getAllPrices:", error);
      res.status(500).json({ error: "Error fetching prices", details: error.message });
    }
  };
  

// Get price history for a specific symbol
exports.getPriceBySymbol = async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const prices = await Price.getBySymbol(symbol);
    res.json(prices);
  } catch (error) {
    if (error.kind === "not_found") {
      res.status(404).json({ message: "No data found for this symbol" });
    } else {
      res.status(500).json({ error: "Error fetching price data" });
    }
  }
};
