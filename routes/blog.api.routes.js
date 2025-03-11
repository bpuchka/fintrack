// routes/blog.api.routes.js
const express = require("express");
const router = express.Router();
const blogApiController = require("../controllers/blog.api.controller");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
            success: false, 
            message: "Unauthorized: Admin access required" 
        });
    }
    next();
};

// API Routes
router.get("/:id", blogApiController.getPost);
router.post("/", isAdmin, blogApiController.createPost);
router.put("/:id", isAdmin, blogApiController.updatePost);
router.delete("/:id", isAdmin, blogApiController.deletePost);

module.exports = router;