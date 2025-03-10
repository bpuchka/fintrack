// models/investment.model.js
const sql = require("../config/db.js");

class Investment {
  constructor(investment) {
    this.user_id = investment.user_id;
    this.investment_type = investment.investment_type;
    this.symbol = investment.symbol;
    this.quantity = investment.quantity;
    this.purchase_price = investment.purchase_price;
    this.currency = investment.currency || 'BGN';
    this.interest_rate = investment.interest_rate;
    this.interest_type = investment.interest_type;
    this.purchase_date = investment.purchase_date;
    this.notes = investment.notes;
  }

  static async create(newInvestment) {
    try {
      const [result] = await sql.query(
        "INSERT INTO user_investments SET ?",
        newInvestment
      );
      return { id: result.insertId, ...newInvestment };
    } catch (err) {
      throw err;
    }
  }

  static async findByUserId(userId) {
    try {
      const [rows] = await sql.query(
        "SELECT * FROM user_investments WHERE user_id = ?",
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
        "SELECT * FROM user_investments WHERE id = ?",
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
        "UPDATE user_investments SET ? WHERE id = ?",
        [investment, id]
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
        "DELETE FROM user_investments WHERE id = ?",
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

  static async getInvestmentsByType(userId, type) {
    try {
      const [rows] = await sql.query(
        "SELECT * FROM user_investments WHERE user_id = ? AND investment_type = ?",
        [userId, type]
      );
      return rows;
    } catch (err) {
      throw err;
    }
  }

  // Get the current value in original currency based on current price
  static calculateCurrentValue(investment, currentPrice) {
    // For very small crypto quantities, we need to handle decimal precision carefully
    const quantity = parseFloat(investment.quantity);
    return quantity * currentPrice;
  }

  // Get the current value converted to BGN
  static calculateCurrentValueInBGN(investment, currentPrice, exchangeRate) {
    const valueInOriginalCurrency = this.calculateCurrentValue(investment, currentPrice);
    return valueInOriginalCurrency * exchangeRate;
  }

  // Calculate profit/loss in original currency
  static calculateProfit(investment, currentPrice) {
    const quantity = parseFloat(investment.quantity);
    const initialInvestment = quantity * investment.purchase_price;
    const currentValue = quantity * currentPrice;
    return currentValue - initialInvestment;
  }

  // Calculate profit/loss percentage
  static calculateProfitPercentage(investment, currentPrice) {
    const initialInvestment = parseFloat(investment.quantity) * investment.purchase_price;
    if (initialInvestment === 0) return 0;
    
    const currentValue = parseFloat(investment.quantity) * currentPrice;
    return ((currentValue - initialInvestment) / initialInvestment) * 100;
  }

  // Calculate monthly profit based on historical data
  static calculateMonthlyProfit(investment, priceHistory) {
    if (!priceHistory || priceHistory.length < 2) {
      return { profit: 0, percentage: 0 }; // Not enough data
    }

    // Sort price history by date (newest first)
    const sortedHistory = [...priceHistory].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Get current price
    const currentPrice = sortedHistory[0].price;
    
    // Find price closest to 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let oldestPrice = sortedHistory[sortedHistory.length - 1].price;
    let closestDateItem = null;
    
    for (const item of sortedHistory) {
      const itemDate = new Date(item.timestamp);
      if (itemDate <= thirtyDaysAgo) {
        closestDateItem = item;
        break;
      }
    }
    
    if (closestDateItem) {
      oldestPrice = closestDateItem.price;
    }

    // Calculate monthly change
    const quantity = parseFloat(investment.quantity);
    const valueNow = quantity * currentPrice;
    const valueThen = quantity * oldestPrice;
    
    // Avoid division by zero
    const percentage = valueThen !== 0 ? ((valueNow - valueThen) / valueThen) * 100 : 0;
    
    return {
      profit: valueNow - valueThen,
      percentage: percentage
    };
  }
}

module.exports = Investment;