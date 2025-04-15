require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pool = require("./config/db");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");
const { 
    fetchAndStoreHistoricalCrypto, 
    fetchAndStoreCurrentPrices, 
    fetchAndStoreLastMonthData, 
    checkApiStatus 
  } = require("./services/fetchPrices");

const app = express();

const priceRoutes = require("./routes/price.routes");
app.use("/api/prices", priceRoutes);


// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Set EJS as templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session Configuration - Must be before routes
app.use(session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Public Routes
app.get("/", async (req, res) => {
    try {
        // Fetch the latest blog post
        const [latestPost] = await pool.query(`
            SELECT bp.*, u.username as author 
            FROM blog_post bp
            JOIN users u ON bp.author_id = u.id
            ORDER BY bp.created_at DESC
            LIMIT 1
        `);
        
        // Create an excerpt for the post if it exists
        let blogPost = null;
        if (latestPost && latestPost.length > 0) {
            blogPost = latestPost[0];
            // Create an excerpt by removing HTML tags and limiting to ~400 chars
            let plainText = blogPost.content.replace(/<[^>]+>/g, '');
            blogPost.excerpt = plainText.length > 400 ? 
                plainText.substring(0, 400) + '...' : 
                plainText;
        }
        
        // Calculate portfolio value if user is logged in
        if (req.session.user) {
            try {
                const userId = req.session.user.id;
                
                // Get regular investments
                const [regularInvestments] = await pool.query(
                    `SELECT * FROM user_investments WHERE user_id = ?`, 
                    [userId]
                );
                
                // Get bank investments 
                const [bankInvestmentsRaw] = await pool.query(
                    `SELECT 
                        id,
                        user_id,
                        'bank' AS investment_type,
                        CONCAT('BANK_', currency) AS symbol,
                        amount AS quantity,
                        1 AS purchase_price,
                        currency,
                        interest_rate,
                        interest_type,
                        investment_date AS purchase_date,
                        notes
                    FROM bank_investment 
                    WHERE user_id = ?`, 
                    [userId]
                );
                
                // Combine both types of investments
                const investments = [...regularInvestments, ...bankInvestmentsRaw];
                
                // Get latest price data for proper valuation
                const [latestPrices] = await pool.query(`
                    SELECT ip1.* 
                    FROM investment_prices ip1
                    INNER JOIN (
                        SELECT symbol, MAX(timestamp) as max_timestamp
                        FROM investment_prices
                        GROUP BY symbol
                    ) ip2 ON ip1.symbol = ip2.symbol AND ip1.timestamp = ip2.max_timestamp
                `);
                
                // Create a price lookup map
                const priceMap = {};
                latestPrices.forEach(price => {
                    priceMap[price.symbol] = price.price;
                });
                
                // Define currency rates (same as in portfolio route)
                const currencyRates = {
                    'BGN': 1,
                    'USD': 1.79,
                    'EUR': 1.96,
                    'GBP': 2.30
                };
                
                // Calculate total portfolio value
                let totalValue = 0;
                
                // Process each investment
                for (const investment of investments) {
                    // Convert string values to numbers
                    const quantity = parseFloat(investment.quantity);
                    const purchasePrice = parseFloat(investment.purchase_price);
                    const interestRate = investment.interest_rate ? parseFloat(investment.interest_rate) : 0;
                    
                    // Get currency conversion rate
                    const currency = investment.currency || 'BGN';
                    const currencyRate = currencyRates[currency] || 1;
                    
                    if (investment.investment_type === 'bank') {
                        // For bank deposits, calculate with interest
                        const monthsHeld = monthsBetween(new Date(investment.purchase_date), new Date());
                        let interestMultiplier = 1;
                        
                        // Apply interest based on type (same logic as portfolio.routes.js)
                        switch(investment.interest_type || 'yearly') {
                            case 'daily':
                                interestMultiplier = 1 + ((interestRate / 100) * (monthsHeld * 30) / 365);
                                break;
                            case 'monthly_1':
                                interestMultiplier = 1 + ((interestRate / 100) * monthsHeld / 12);
                                break;
                            case 'monthly_3':
                                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 3) / 4);
                                break;
                            case 'monthly_6':
                                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 6) / 2);
                                break;
                            case 'yearly':
                                interestMultiplier = 1 + ((interestRate / 100) * Math.floor(monthsHeld / 12));
                                break;
                        }
                        
                        // Calculate current value with interest and convert to BGN
                        const currentValue = quantity * interestMultiplier * currencyRate;
                        totalValue += currentValue;
                    } else {
                        // For other investments, use latest price data
                        let currentPrice = purchasePrice; // Default to purchase price
                        
                        if (priceMap[investment.symbol]) {
                            currentPrice = parseFloat(priceMap[investment.symbol]);
                        }
                        
                        // Calculate current value and convert to BGN
                        const currentValue = quantity * currentPrice * currencyRate;
                        totalValue += currentValue;
                    }
                }
                
                // Update session with the calculated value
                req.session.user.portfolioValue = totalValue.toFixed(2);
                
            } catch (error) {
                console.error("Error calculating portfolio value for homepage:", error);
                // Don't update if there's an error
            }
        }
        
        // Render the page with all the data
        res.render("home", { 
            user: req.session.user || null,
            latestPost: blogPost
        });
        
    } catch (error) {
        console.error("Error loading home page:", error);
        // Still render the home page even if there are errors
        res.render("home", { 
            user: req.session.user || null,
            latestPost: null
        });
    }
});

// Redirect /home to root for consistency
app.get("/home", (req, res) => {
    res.redirect('/');
});

// Helper function to calculate months between two dates (same as in portfolio.routes.js)
function monthsBetween(date1, date2) {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
}

app.get("/register", (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render("register");
});

// Blog Routes
app.use("/blog", require("./routes/blog.routes.js"));

// Admin middleware - make sure this is defined before admin routes
function isAdmin(req, res, next) {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).redirect('/login');
    }
    next();
}

// Register POST route
app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Email already exists" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await pool.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword]);
        res.json({ message: "Registration successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render("login");
});

// Login POST route
app.post("/login", async (req, res) => {
    const { email, password, remember } = req.body;
    try {
        const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (user.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        const validPassword = await bcrypt.compare(password, user[0].password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        req.session.user = { 
            id: user[0].id, 
            email: user[0].email, 
            username: user[0].username,
            isAdmin: user[0].isAdmin === 1  // Add this line
        };

        if (remember) {
            req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        }
        res.json({ success: true, message: "Login successful", token: "fake-jwt-token" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: "Error logging out" });
        }
        res.clearCookie('connect.sid');
        res.redirect("/");
    });
});

// Authenticated Route
app.get("/portfolio", requireAuth, (req, res) => {
    res.render("portfolio", { user: req.session.user });
});

app.get("/portfolio/history", requireAuth, (req, res) => {
    res.render("portfolio-history", { user: req.session.user });
});

app.get("/investments/bank", requireAuth, (req, res) => {
    res.render("bankinvestment", { user: req.session.user });
});

app.get("/profile", requireAuth, (req, res) => {
    res.render("profile", { user: req.session.user });
});

app.get("/investments", requireAuth, (req, res) => {
    res.render("investments", { user: req.session.user });
});

// API Routes
app.use("/api/auth", require("./routes/auth.routes.js"));
app.use("/api/prices", require("./routes/price.routes.js"));
app.use("/api/prices", require("./routes/investment-prices.routes.js"));
app.use("/api/investments", require("./routes/investments.routes.js"));
app.use("/api/bank-investments", require("./routes/bank.investment.routes.js"));
app.use("/api/portfolio", require("./routes/portfolio.routes.js"));
app.use("/api/blog", require("./routes/blog.api.routes.js"));
app.use("/api/realtime-prices", require("./routes/realtime-prices.routes.js"));
app.use("/api/prices", require("./routes/price-data.routes.js"));
app.use("/api/asset", require("./routes/asset.routes.js"));

// Page Routes
app.use("/blog", require("./routes/blog.routes.js"));
app.use("/admin/blog", isAdmin, require("./routes/blog.routes.js"));
app.use("/profile", require("./routes/profile.routes.js"));
app.use("/investments", require("./routes/investments-page.routes.js"));
app.use("/asset", require("./routes/asset.routes.js")); 
app.get("/investments/bank", requireAuth, async (req, res) => {
    try {
        res.render("bankinvestment", { user: req.session.user });
    } catch (error) {
        console.error("Error rendering bank investments page:", error);
        res.status(500).render("error", { 
            error: { message: "Error loading bank investments page" },
            user: req.session.user
        });
    }
});


// 404 Handler - Catch-all for unmatched routes
app.use((req, res, next) => {
    // Skip 404 handling for the home route
    if (req.path === '/' || req.path === '/home') {
        return next();
    }
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Error Handling Middleware - Must be defined after all other routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        error: {
            message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
        },
        user: req.session.user || null
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}.`);
    
    // Update last 30 days of price data when server starts
    try {
        // Check if API is available
        const apiAvailable = await checkApiStatus();
        
        if (apiAvailable) {
            console.log("API available. Fetching last month (30 days) of price data...");
            // Use cache if available to reduce API calls
            await fetchAndStoreLastMonthData(true);
            console.log("Last month data update completed.");
        } else {
            console.log("API not available. Skipping price data update.");
        }
    } catch (error) {
        console.error("Error updating last month price data:", error);
    }
    
    // Initialize daily prices after server starts
    try {
        const PriceData = require("./models/price-data.model");
        await PriceData.initializeDailyPrices();
    } catch (error) {
        console.error("Error initializing price data:", error);
    }
});

// And update the daily CRON job to use the last month function as well:

// CRON JOBS
cron.schedule("0 0 * * *", async () => {
    console.log("Running daily price update...");
    try {
        const apiAvailable = await checkApiStatus();
        
        if (apiAvailable) {
            // Update the price data for each asset
            console.log("Updating last month data for all assets...");
            await fetchAndStoreLastMonthData(true);
            console.log("Daily price update complete.");
        } else {
            console.log("API not available. Skipping daily price update.");
        }
    } catch (error) {
        console.error("Error in daily price update:", error);
    }
});