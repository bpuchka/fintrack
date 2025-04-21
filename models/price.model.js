// models/price.model.js
const sql = require("../config/db.js");

const Price = function (price) {
  this.symbol = price.symbol;
  this.price = price.price;
  this.timestamp = price.timestamp;
  this.asset_type = price.asset_type;
};

// Insert a new price record into the database
Price.create = async (newPrice) => {
  try {
    const [result] = await sql
      .promise()
      .query("INSERT INTO investment_prices SET ?", newPrice);
    return { id: result.insertId, ...newPrice };
  } catch (err) {
    throw err;
  }
};

// Retrieve the most recent price for a given symbol
Price.getLatest = async (symbol) => {
  try {
    const [rows] = await sql
      .promise()
      .query(
        "SELECT * FROM investment_prices ",
        "WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1",
        [symbol]
      );
    if (rows.length) {
      return rows[0];
    }
    throw { kind: "not_found" };
  } catch (err) {
    throw err;
  }
};

// Retrieve all prices
Price.getAll = async () => {
    try {
      const [rows] = await sql.query("SELECT * FROM investment_prices ORDER BY timestamp DESC");
      return rows;
    } catch (err) {
      throw err;
    }
  };

// Retrieve price history for a given symbol
Price.getBySymbol = async (symbol) => {
  try {
    const [rows] = await sql
      .promise()
      .query(
        "SELECT * FROM investment_prices WHERE symbol = ? ORDER BY timestamp DESC",
        [symbol]
      );
    if (rows.length) {
      return rows;
    }
    throw { kind: "not_found" };
  } catch (err) {
    throw err;
  }
};

module.exports = Price;
