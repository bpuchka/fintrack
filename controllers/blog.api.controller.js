// controllers/blog.api.controller.js
const pool = require("../config/db");

// Get a single blog post by ID for editing
exports.getPost = async (req, res) => {
    try {
        const postId = req.params.id;
        
        const [posts] = await pool.query(`
            SELECT * FROM blog_post WHERE id = ?
        `, [postId]);
        
        if (posts.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Blog post not found" 
            });
        }
        
        res.json({ 
            success: true, 
            post: posts[0] 
        });
    } catch (err) {
        console.error('Error fetching blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: "Server error while fetching post" 
        });
    }
};

// Create new post
exports.createPost = async (req, res) => {
    try {
        const { title, content } = req.body;
        const authorId = req.session.user.id;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: "Title and content are required" 
            });
        }
        
        const [result] = await pool.query(`
            INSERT INTO blog_post (title, content, author_id) 
            VALUES (?, ?, ?)
        `, [title, content, authorId]);
        
        if (result.affectedRows === 1) {
            res.status(201).json({ 
                success: true, 
                message: "Blog post created successfully",
                postId: result.insertId
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to create blog post" 
            });
        }
    } catch (err) {
        console.error('Error creating blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: "Server error while creating blog post" 
        });
    }
};

// Update existing post
exports.updatePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: "Title and content are required" 
            });
        }
        
        const [result] = await pool.query(`
            UPDATE blog_post 
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [title, content, postId]);
        
        if (result.affectedRows === 1) {
            res.json({ 
                success: true, 
                message: "Blog post updated successfully" 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Blog post not found or no changes made" 
            });
        }
    } catch (err) {
        console.error('Error updating blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: "Server error while updating blog post" 
        });
    }
};

// Delete post
exports.deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        
        const [result] = await pool.query(`
            DELETE FROM blog_post WHERE id = ?
        `, [postId]);
        
        if (result.affectedRows === 1) {
            res.json({ 
                success: true, 
                message: "Blog post deleted successfully" 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "Blog post not found" 
            });
        }
    } catch (err) {
        console.error('Error deleting blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: "Server error while deleting blog post" 
        });
    }
};