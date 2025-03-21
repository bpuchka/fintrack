// controllers/bank.investment.controller.js
const BankInvestment = require("../models/bank.investment.model.js");

// Create a new bank investment
exports.createBankInvestment = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Content cannot be empty!"
      });
    }

    // Parse amount as a floating point number
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number!"
      });
    }

    // Parse interest rate
    const interestRate = parseFloat(req.body.interestRate);
    if (isNaN(interestRate) || interestRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Interest rate must be a non-negative number!"
      });
    }

    // Create a new bank investment object
    const bankInvestment = new BankInvestment({
      user_id: req.session.user.id,
      amount: amount,
      interest_rate: interestRate,
      interest_type: req.body.interestType || 'yearly',
      investment_date: req.body.investmentDate || new Date(),
      currency: req.body.currency || 'BGN',
      notes: req.body.notes
    });

    // Save bank investment in the database
    const data = await BankInvestment.create(bankInvestment);
    res.status(201).json({
      success: true,
      message: "Bank investment was created successfully",
      data: data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while creating the bank investment."
    });
  }
};

// Retrieve all bank investments for a user
exports.findAllBankInvestments = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bankInvestments = await BankInvestment.findByUserId(userId);
    
    // Calculate current values with interest
    const processedInvestments = bankInvestments.map(investment => {
      const currentValue = BankInvestment.calculateCurrentValue(investment);
      const initialAmount = parseFloat(investment.amount);
      const profit = currentValue - initialAmount;
      const profitPercentage = initialAmount > 0 ? ((currentValue / initialAmount) - 1) * 100 : 0;
      
      return {
        ...investment,
        currentValue,
        profit,
        profitPercentage
      };
    });
    
    res.json({
      success: true,
      data: processedInvestments
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while retrieving bank investments."
    });
  }
};

// Find a single bank investment by ID
exports.findBankInvestmentById = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const investmentId = req.params.id;
    
    const investment = await BankInvestment.findById(investmentId);
    
    // Check if investment belongs to user
    if (investment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this investment"
      });
    }
    
    // Calculate current value with interest
    const currentValue = BankInvestment.calculateCurrentValue(investment);
    const initialAmount = parseFloat(investment.amount);
    const profit = currentValue - initialAmount;
    const profitPercentage = initialAmount > 0 ? ((currentValue / initialAmount) - 1) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        ...investment,
        currentValue,
        profit,
        profitPercentage
      }
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: "Bank investment not found with ID " + req.params.id
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error retrieving bank investment with ID " + req.params.id
      });
    }
  }
};

// Update a bank investment
exports.updateBankInvestment = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Content cannot be empty!"
      });
    }

    const userId = req.session.user.id;
    const investmentId = req.params.id;
    
    // Check if investment exists and belongs to user
    const existingInvestment = await BankInvestment.findById(investmentId);
    if (existingInvestment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to modify this investment"
      });
    }
    
    // Parse amount
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number!"
      });
    }
    
    // Parse interest rate
    const interestRate = parseFloat(req.body.interestRate);
    if (isNaN(interestRate) || interestRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Interest rate must be a non-negative number!"
      });
    }
    
    // Create updated investment object
    const bankInvestment = {
      amount: amount,
      interest_rate: interestRate,
      interest_type: req.body.interestType || existingInvestment.interest_type,
      investment_date: req.body.investmentDate || existingInvestment.investment_date,
      currency: req.body.currency || existingInvestment.currency,
      notes: req.body.notes
    };
    
    const result = await BankInvestment.update(investmentId, bankInvestment);
    
    res.json({
      success: true,
      message: "Bank investment was updated successfully",
      data: result
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: "Bank investment not found with ID " + req.params.id
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error updating bank investment with ID " + req.params.id
      });
    }
  }
};

// Delete a bank investment
exports.deleteBankInvestment = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const investmentId = req.params.id;
    
    // Check if investment exists and belongs to user
    const existingInvestment = await BankInvestment.findById(investmentId);
    if (existingInvestment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this investment"
      });
    }
    
    await BankInvestment.remove(investmentId);
    
    res.json({
      success: true,
      message: "Bank investment was deleted successfully"
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: "Bank investment not found with ID " + req.params.id
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Could not delete bank investment with ID " + req.params.id
      });
    }
  }
};