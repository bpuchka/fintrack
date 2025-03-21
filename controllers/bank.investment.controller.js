// controllers/bank.investment.controller.js
const BankInvestment = require("../models/bank.investment.model.js");

exports.createBankInvestment = async (req, res) => {
  try {
    // Validate request
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Content cannot be empty!"
      });
    }

    // Validate required fields
    if (!req.body.amount || !req.body.interest_rate || !req.body.investment_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide amount, interest rate, and investment date!"
      });
    }

    // Validate amount
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number!"
      });
    }

    // Validate interest rate
    const interestRate = parseFloat(req.body.interest_rate);
    if (isNaN(interestRate) || interestRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Interest rate must be a non-negative number!"
      });
    }

    // Create a new bank investment
    const bankInvestment = new BankInvestment({
      user_id: req.session.user.id,
      amount: amount,
      interest_rate: interestRate,
      interest_type: req.body.interest_type || 'yearly',
      investment_date: req.body.investment_date,
      currency: req.body.currency || 'BGN',
      notes: req.body.notes
    });

    // Save bank investment in the database
    const data = await BankInvestment.create(bankInvestment);
    res.status(201).json({
      success: true,
      message: "Bank investment created successfully!",
      data: data
    });
  } catch (err) {
    console.error("Error creating bank investment:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while creating the bank investment."
    });
  }
};

exports.findAllBankInvestments = async (req, res) => {
  try {
    const bankInvestments = await BankInvestment.findByUserId(req.session.user.id);
    
    // Calculate current value with interest for each investment
    const currentDate = new Date();
    const enhancedInvestments = bankInvestments.map(investment => {
      const currentValue = BankInvestment.calculateCurrentValue(investment, currentDate);
      return {
        ...investment,
        current_value: currentValue,
        profit_percentage: ((currentValue / investment.amount - 1) * 100)
      };
    });
    
    res.json({
      success: true,
      data: enhancedInvestments
    });
  } catch (err) {
    console.error("Error retrieving bank investments:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Some error occurred while retrieving bank investments."
    });
  }
};

exports.findBankInvestmentById = async (req, res) => {
  try {
    const bankInvestment = await BankInvestment.findById(req.params.id);
    
    // Check if user is authorized to view this investment
    if (bankInvestment.user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this bank investment!"
      });
    }
    
    // Calculate current value with interest
    const currentValue = BankInvestment.calculateCurrentValue(bankInvestment);
    
    res.json({
      success: true,
      data: {
        ...bankInvestment,
        current_value: currentValue,
        profit_percentage: ((currentValue / bankInvestment.amount - 1) * 100)
      }
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: `Not found bank investment with id ${req.params.id}.`
      });
    } else {
      console.error("Error retrieving bank investment:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Error retrieving bank investment with id " + req.params.id
      });
    }
  }
};

exports.updateBankInvestment = async (req, res) => {
  try {
    // Validate request
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Content cannot be empty!"
      });
    }

    // Validate required fields
    if (!req.body.amount || req.body.interest_rate === undefined || !req.body.investment_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide amount, interest rate, and investment date!"
      });
    }

    // Validate amount
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number!"
      });
    }

    // Validate interest rate - ensure we're handling zero correctly
    const interestRate = parseFloat(req.body.interest_rate);
    if (isNaN(interestRate) || interestRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Interest rate must be a non-negative number!"
      });
    }

    // First check if the bank investment exists and belongs to the user
    const existingInvestment = await BankInvestment.findById(req.params.id);
    if (existingInvestment.user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this bank investment!"
      });
    }

    // Prepare investment data for update
    const investment = {
      amount: amount,
      interest_rate: interestRate,
      interest_type: req.body.interest_type || existingInvestment.interest_type,
      investment_date: req.body.investment_date,
      currency: req.body.currency || existingInvestment.currency,
      notes: req.body.notes
    };

    // Update the bank investment
    const data = await BankInvestment.update(req.params.id, investment);
    res.json({
      success: true,
      message: "Bank investment updated successfully!",
      data: data
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: `Not found bank investment with id ${req.params.id}.`
      });
    } else {
      console.error("Error updating bank investment:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Error updating bank investment with id " + req.params.id
      });
    }
  }
};

exports.deleteBankInvestment = async (req, res) => {
  try {
    // First check if the bank investment exists and belongs to the user
    const existingInvestment = await BankInvestment.findById(req.params.id);
    if (existingInvestment.user_id !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this bank investment!"
      });
    }

    await BankInvestment.remove(req.params.id);
    res.json({
      success: true,
      message: "Bank investment deleted successfully!"
    });
  } catch (err) {
    if (err.kind === "not_found") {
      res.status(404).json({
        success: false,
        message: `Not found bank investment with id ${req.params.id}.`
      });
    } else {
      console.error("Error deleting bank investment:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Could not delete bank investment with id " + req.params.id
      });
    }
  }
};