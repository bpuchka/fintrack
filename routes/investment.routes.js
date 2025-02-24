require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Function to fetch real-time investment prices
async function getInvestmentPrice(symbol) {
    const url = `https://www.alphavantage.co/query`;
    try {
        const response = await axios.get(url, {
            params: {
                function: "GLOBAL_QUOTE",
                symbol: symbol,
                apikey: API_KEY
            }
        });

        const data = response.data["Global Quote"];
        if (!data) {
            throw new Error("Invalid response from API");
        }

        return {
            symbol: data["01. symbol"],
            price: parseFloat(data["05. price"]),
            change: parseFloat(data["09. change"]),
            changePercent: data["10. change percent"]
        };
    } catch (error) {
        console.error("Error fetching investment price:", error);
        return null;
    }
}

// API route to get investment price dynamically
router.get("/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const investmentData = await getInvestmentPrice(symbol);
    if (!investmentData) {
        return res.status(500).json({ error: "Failed to fetch investment data" });
    }
    res.json(investmentData);
});

module.exports = router;
