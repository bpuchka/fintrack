// controllers/investment.controller.js
const Investment = require("../models/investment.model");
const Price = require("../models/price.model");
const axios = require("axios");

// Helper function to get exchange rates
async function getExchangeRate(fromCurrency, toCurrency = 'BGN') {
  try {
    // Use a free currency API or your preferred provider
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    return response.data.rates[toCurrency];
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Return default values if API fails
    const defaultRates = {
      'USD': 1.79, // USD to BGN
      'EUR': 1.96, // EUR to BGN
      'GBP': 2.30  // GBP to BGN
    };
    return defaultRates[fromCurrency] || 1.0;
  }
}

// Create a new investment
exports.createInvestment = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).send({
        message: "Content cannot be empty!"
      });
    }

    // Parse quantity as a floating point number with higher precision for small amounts
    const quantity = parseFloat(req.body.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).send({
        message: "Quantity must be a positive number!"
      });
    }

    // Create a new investment object
    const investment = new Investment({
      user_id: req.session.user.id,
      investment_type: req.body.investment_type,
      symbol: req.body.symbol.toUpperCase(),
      quantity: quantity,
      purchase_price: parseFloat(req.body.purchase_price),
      currency: req.body.currency || 'BGN',
      interest_rate: req.body.interest_rate,
      interest_type: req.body.interest_type,
      purchase_date: req.body.purchase_date || new Date(),
      notes: req.body.notes
    });

    // Save investment in the database
    const data = await Investment.create(investment);
    res.status(201).send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the investment."
    });
  }
};

// Retrieve all investments for a user
exports.findAllInvestments = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const investments = await Investment.findByUserId(userId);
    
    // For each investment, get the latest price
    const investmentsWithCurrentData = await Promise.all(
      investments.map(async (investment) => {
        try {
          // Skip extra calculations for bank deposits
          if (investment.investment_type === 'bank') {
            return {
              ...investment,
              current_price: 1,
              current_value: parseFloat(investment.quantity),
              current_value_bgn: investment.currency === 'BGN' 
                ? parseFloat(investment.quantity) 
                : parseFloat(investment.quantity) * await getExchangeRate(investment.currency),
              profit: 0, // This would need interest calculation
              profit_percentage: 0,
              monthly_profit: 0,
              monthly_profit_percentage: 0,
              display_currency: investment.currency
            };
          }
          
          // Get latest price data
          const priceData = await Price.getLatest(investment.symbol);
          
          // Get exchange rate if needed
          let exchangeRate = 1.0;
          if (investment.currency !== 'BGN') {
            exchangeRate = await getExchangeRate(investment.currency);
          }
          
          // Calculate current values
          const currentValue = Investment.calculateCurrentValue(investment, priceData.price);
          const currentValueBGN = Investment.calculateCurrentValueInBGN(
            investment, 
            priceData.price, 
            exchangeRate
          );
          
          // Calculate profit/loss
          const profit = Investment.calculateProfit(investment, priceData.price);
          const profitPercentage = Investment.calculateProfitPercentage(investment, priceData.price);
          
          // Get price history for monthly calculations
          const priceHistory = await Price.getBySymbol(investment.symbol);
          const monthlyProfit = Investment.calculateMonthlyProfit(investment, priceHistory);
          
          return {
            ...investment,
            current_price: priceData.price,
            current_value: currentValue,
            current_value_bgn: currentValueBGN,
            profit: profit,
            profit_percentage: profitPercentage,
            monthly_profit: monthlyProfit.profit,
            monthly_profit_percentage: monthlyProfit.percentage,
            display_currency: investment.currency
          };
        } catch (error) {
          console.error(`Error processing investment ${investment.id}:`, error);
          return {
            ...investment,
            current_price: null,
            current_value: null,
            current_value_bgn: null,
            profit: null,
            profit_percentage: null,
            monthly_profit: null,
            monthly_profit_percentage: null,
            display_currency: investment.currency,
            error: "Could not retrieve current data"
          };
        }
      })
    );

    res.send(investmentsWithCurrentData);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving investments."
    });
  }
};

// Find investments by type
exports.findByType = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const type = req.params.type;
    
    // Validate investment type
    const validTypes = ['crypto', 'stock', 'metal', 'bank'];
    if (!validTypes.includes(type)) {
      return res.status(400).send({
        message: "Invalid investment type"
      });
    }
    
    const investments = await Investment.getInvestmentsByType(userId, type);
    
    // Same enrichment as in findAllInvestments
    const investmentsWithCurrentData = await Promise.all(
      investments.map(async (investment) => {
        try {
          // Skip extra calculations for bank deposits
          if (investment.investment_type === 'bank') {
            return {
              ...investment,
              current_price: 1,
              current_value: parseFloat(investment.quantity),
              current_value_bgn: investment.currency === 'BGN' 
                ? parseFloat(investment.quantity) 
                : parseFloat(investment.quantity) * await getExchangeRate(investment.currency),
              profit: 0, // Would need interest calculation
              profit_percentage: 0,
              monthly_profit: 0,
              monthly_profit_percentage: 0,
              display_currency: investment.currency
            };
          }
          
          const priceData = await Price.getLatest(investment.symbol);
          
          let exchangeRate = 1.0;
          if (investment.currency !== 'BGN') {
            exchangeRate = await getExchangeRate(investment.currency);
          }
          
          const currentValue = Investment.calculateCurrentValue(investment, priceData.price);
          const currentValueBGN = Investment.calculateCurrentValueInBGN(
            investment, 
            priceData.price, 
            exchangeRate
          );
          
          const profit = Investment.calculateProfit(investment, priceData.price);
          const profitPercentage = Investment.calculateProfitPercentage(investment, priceData.price);
          
          const priceHistory = await Price.getBySymbol(investment.symbol);
          const monthlyProfit = Investment.calculateMonthlyProfit(investment, priceHistory);
          
          return {
            ...investment,
            current_price: priceData.price,
            current_value: currentValue,
            current_value_bgn: currentValueBGN,
            profit: profit,
            profit_percentage: profitPercentage,
            monthly_profit: monthlyProfit.profit,
            monthly_profit_percentage: monthlyProfit.percentage,
            display_currency: investment.currency
          };
        } catch (error) {
          console.error(`Error processing investment ${investment.id}:`, error);
          return {
            ...investment,
            error: "Could not retrieve current data"
          };
        }
      })
    );

    res.send(investmentsWithCurrentData);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving investments."
    });
  }
};

module.exports = exports;