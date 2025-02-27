const mysql = require("mysql2/promise");
require("dotenv").config(); // Load environment variables

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Add this to handle authentication issues
    ssl: false,
    authPlugins: {
        mysql_native_password: () => () => Buffer.from(process.env.DB_PASSWORD)
    }
});

module.exports = pool;