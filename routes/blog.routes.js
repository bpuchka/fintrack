// routes/blog.routes.js
const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blog.controller");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).redirect('/login');
    }
    next();
};

// Public routes
router.get("/", blogController.getAllPosts);
router.get("/:id", blogController.getPostById);

// Admin routes for page rendering
router.get("/admin/blog", isAdmin, blogController.getAdminPosts);

// These routes are maintained for backward compatibility
// but their functionality is now handled through the API
router.get("/admin/blog/create", isAdmin, blogController.getCreateForm);
router.get("/admin/blog/edit/:id", isAdmin, blogController.getEditForm);

module.exports = router;