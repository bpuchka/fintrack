// routes/investments.routes.js
const express = require("express");
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Main investments page - redirects to portfolio
router.get("/", requireAuth, (req, res) => {
    res.redirect('/portfolio');
});

// Bank investments page
router.get("/bank", requireAuth, (req, res) => {
    // Set the specific variables for the bank investments page
    const pageData = {
        user: req.session.user,
        investmentType: 'bank',
        investmentTypeDisplay: 'Банкови влогове',
        investmentTypeColor: '#6dc0e0'
    };
    
    res.render("investments", pageData);
});

// Crypto investments page
router.get("/crypto", requireAuth, (req, res) => {
    // Set the specific variables for the crypto investments page
    const pageData = {
        user: req.session.user,
        investmentType: 'crypto',
        investmentTypeDisplay: 'Криптовалути',
        investmentTypeColor: '#8e44ad'
    };
    
    res.render("investments", pageData);
});

// Stock investments page
router.get("/stocks", requireAuth, (req, res) => {
    // Set the specific variables for the stock investments page
    const pageData = {
        user: req.session.user,
        investmentType: 'stock',
        investmentTypeDisplay: 'Акции',
        investmentTypeColor: '#27ae60'
    };
    
    res.render("investments", pageData);
});

// Metal investments page
router.get("/metals", requireAuth, (req, res) => {
    // Set the specific variables for the metal investments page
    const pageData = {
        user: req.session.user,
        investmentType: 'metal',
        investmentTypeDisplay: 'Метали',
        investmentTypeColor: '#f39c12'
    };
    
    res.render("investments", pageData);
});

module.exports = router;