const express = require("express");
const router = express.Router();
const priceController = require("../controllers/price.controller");

// Route to get all prices
router.get("/", priceController.getAllPrices);

// Route to get price history for a specific symbol
router.get("/:symbol", priceController.getPriceBySymbol);

module.exports = router;
