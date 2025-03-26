require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pool = require("./config/db");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");
const { fetchAndStoreDailyPrices, fetchAndStoreIntradayPrices } = require("./services/fetchPrices");


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
app.get("/", (req, res) => {
    res.render("home", { user: req.session.user || null });
});

app.get("/home", (req, res) => {
    res.render("home", { user: req.session.user || null });
});

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

// Page Routes
app.use("/blog", require("./routes/blog.routes.js"));
app.use("/admin/blog", isAdmin, require("./routes/blog.routes.js"));
app.use("/profile", require("./routes/profile.routes.js"));
app.use("/investments", require("./routes/investments-page.routes.js"));


// 404 Handler - Catch-all for unmatched routes
app.use((req, res, next) => {
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
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});

/* ✅ CRON JOBS (placed last)
cron.schedule("0 0 * * *", async () => {
    console.log("Running daily price update...");
    await fetchAndStoreDailyPrices();
    console.log("Daily price update complete.");
  });
  
cron.schedule("* /5 * * * *", async () => { "  // kato se maha komentara da se mahne razstoqnieto mezhdu / i *
    console.log("Running intraday price update...");
    await fetchAndStoreIntradayPrices();
    console.log("Intraday price update complete.");
  }); */
