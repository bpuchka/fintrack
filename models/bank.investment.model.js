// models/bank.investment.model.js
const sql = require("../config/db.js");

class BankInvestment {
  constructor(investment) {
    this.user_id = investment.user_id;
    this.amount = investment.amount;
    this.interest_rate = investment.interest_rate;
    this.interest_type = investment.interest_type || 'yearly';
    this.investment_date = investment.investment_date;
    this.currency = investment.currency || 'BGN';
    this.notes = investment.notes;
    // No reference to original_investment_id as it's no longer needed
  }

  static async create(newInvestment) {
    try {
      const [result] = await sql.query(
        "INSERT INTO bank_investment (user_id, amount, interest_rate, interest_type, investment_date, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          newInvestment.user_id, 
          newInvestment.amount,
          newInvestment.interest_rate,
          newInvestment.interest_type,
          newInvestment.investment_date,
          newInvestment.currency,
          newInvestment.notes
        ]
      );
      return { id: result.insertId, ...newInvestment };
    } catch (err) {
      throw err;
    }
  }

  static async findByUserId(userId) {
    try {
      const [rows] = await sql.query(
        "SELECT * FROM bank_investment WHERE user_id = ? ORDER BY investment_date DESC",
        [userId]
      );
      return rows;
    } catch (err) {
      throw err;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await sql.query(
        "SELECT * FROM bank_investment WHERE id = ?",
        [id]
      );
      if (rows.length) {
        return rows[0];
      }
      throw { kind: "not_found" };
    } catch (err) {
      throw err;
    }
  }

  static async update(id, investment) {
    try {
      const [result] = await sql.query(
        "UPDATE bank_investment SET amount = ?, interest_rate = ?, interest_type = ?, investment_date = ?, currency = ?, notes = ? WHERE id = ?",
        [
          investment.amount,
          investment.interest_rate,
          investment.interest_type,
          investment.investment_date,
          investment.currency,
          investment.notes,
          id
        ]
      );
      if (result.affectedRows === 0) {
        throw { kind: "not_found" };
      }
      return { id, ...investment };
    } catch (err) {
      throw err;
    }
  }

  static async remove(id) {
    try {
      const [result] = await sql.query(
        "DELETE FROM bank_investment WHERE id = ?",
        [id]
      );
      if (result.affectedRows === 0) {
        throw { kind: "not_found" };
      }
      return result;
    } catch (err) {
      throw err;
    }
  }

  // Helper function to calculate months between two dates
  static monthsBetween(date1, date2) {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
  }

  // Calculate current value with interest
  static calculateCurrentValue(investment, targetDate = new Date()) {
    // Convert to JS date objects if they are strings
    const investmentDate = new Date(investment.investment_date);
    const calculationDate = new Date(targetDate);
    
    // Get interest rate as a decimal
    const interestRate = parseFloat(investment.interest_rate) / 100;
    
    // Calculate months held
    const monthsHeld = this.monthsBetween(investmentDate, calculationDate);
    
    // Initial amount
    const initialAmount = parseFloat(investment.amount);
    
    // Calculate interest multiplier based on interest type
    let interestMultiplier = 1;
    
    switch(investment.interest_type) {
      case 'daily':
        // Simplified daily calculation (30 days per month)
        interestMultiplier = 1 + (interestRate * (monthsHeld * 30) / 365);
        break;
      case 'monthly_1':
        interestMultiplier = 1 + (interestRate * monthsHeld / 12);
        break;
      case 'monthly_3':
        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 3) / 4);
        break;
      case 'monthly_6':
        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 6) / 2);
        break;
      case 'yearly':
      default:
        interestMultiplier = 1 + (interestRate * Math.floor(monthsHeld / 12));
        break;
    }
    
    // Calculate and return final value
    return initialAmount * interestMultiplier;
  }
}

module.exports = BankInvestment;