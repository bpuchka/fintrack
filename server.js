require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pool = require("./config/db");
const bcrypt = require("bcryptjs");

const app = express();

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
        req.session.user = { id: user[0].id, email: user[0].email, username: user[0].username };
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
app.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

// API Routes
app.use("/api/auth", require("./routes/auth.routes.js"));
app.use("/api/investments", require("./routes/investment.routes.js"));

// 404 Handler - Catch-all for unmatched routes
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Error Handling Middleware - Must be defined after all other routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
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
