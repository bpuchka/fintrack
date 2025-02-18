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

//redirect / to /home
app.get("/", (req, res) => {
    res.render("home", { user: req.session.user || null });
});

// Routes that don't require authentication
app.get("/home", (req, res) => {
    res.render("home", { user: req.session.user || null });
});


app.get("/register", (req, res) => {
    // Redirect if user is already logged in
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render("register");
});

//register post route
app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Check if email already exists
        const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        await pool.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword]);

        res.json({ message: "Registration successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/login", (req, res) => {
    // Redirect if user is already logged in
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render("login");
});

// Login post route
app.post("/login", async (req, res) => {
    const { email, password, remember } = req.body;
    
    try {
        // Check if user exists in the database
        const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

        if (user.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // Check password using bcrypt
        const validPassword = await bcrypt.compare(password, user[0].password);

        if (!validPassword) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // Save user in session
        req.session.user = { id: user[0].id, email: user[0].email, username: user[0].username };

        // If "Remember Me" is checked, extend session expiration
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
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect("/");
    });
});

// Routes that require authentication
app.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

// API routes
app.use("/api/auth", require("./routes/auth.routes.js"));


// 404 Handler (MUST be the last route)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong!' 
            : err.message 
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});