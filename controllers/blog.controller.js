// controllers/blog.controller.js
const pool = require("../config/db");

// Get all blog posts with pagination for public view
exports.getAllPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6; // Number of posts per page
        const offset = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        
        // Query to get total count for pagination
        let countQuery = "SELECT COUNT(*) as total FROM blog_post";
        let postsQuery = `
            SELECT bp.*, u.username as author 
            FROM blog_post bp
            JOIN users u ON bp.author_id = u.id
            ORDER BY bp.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        let queryParams = [limit, offset];
        
        // If search parameter exists, modify queries
        if (searchQuery) {
            countQuery += " WHERE title LIKE ? OR content LIKE ?";
            postsQuery = `
                SELECT bp.*, u.username as author 
                FROM blog_post bp
                JOIN users u ON bp.author_id = u.id
                WHERE bp.title LIKE ? OR bp.content LIKE ?
                ORDER BY bp.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const searchPattern = `%${searchQuery}%`;
            queryParams = [searchPattern, searchPattern, limit, offset];
        }
        
        // Get total count
        const [countResult] = await pool.query(countQuery, searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : []);
        const total = countResult[0].total;
        
        // Get posts
        const [posts] = await pool.query(postsQuery, queryParams);
        
        // Add excerpt for each post
        posts.forEach(post => {
            // Create an excerpt by removing HTML tags and limiting to ~150 chars
            let plainText = post.content.replace(/<[^>]+>/g, '');
            post.excerpt = plainText.length > 150 ? 
                plainText.substring(0, 150) + '...' : 
                plainText;
        });
        
        // Calculate total pages
        const totalPages = Math.ceil(total / limit);
        
        res.render('blog', {
            posts,
            currentPage: page,
            totalPages,
            user: req.session.user || null,
            searchQuery
        });
    } catch (err) {
        console.error('Error fetching blog posts:', err);
        res.status(500).render('error', { 
            message: 'Failed to load blog posts',
            user: req.session.user || null
        });
    }
};

// Get a single blog post by ID
exports.getPostById = async (req, res) => {
    try {
        const postId = req.params.id;
        
        // Get the current post
        const [posts] = await pool.query(`
            SELECT bp.*, u.username as author 
            FROM blog_post bp
            JOIN users u ON bp.author_id = u.id
            WHERE bp.id = ?
        `, [postId]);
        
        if (posts.length === 0) {
            return res.status(404).render('error', { 
                message: 'Blog post not found',
                user: req.session.user || null
            });
        }
        
        const post = posts[0];
        
        // Get previous post (if any)
        const [prevPosts] = await pool.query(`
            SELECT id, title FROM blog_post
            WHERE created_at < ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [post.created_at]);
        
        // Get next post (if any)
        const [nextPosts] = await pool.query(`
            SELECT id, title FROM blog_post
            WHERE created_at > ?
            ORDER BY created_at ASC
            LIMIT 1
        `, [post.created_at]);
        
        const prevPost = prevPosts.length > 0 ? prevPosts[0] : null;
        const nextPost = nextPosts.length > 0 ? nextPosts[0] : null;
        
        res.render('blog-post', {
            post,
            prevPost,
            nextPost,
            user: req.session.user || null
        });
    } catch (err) {
        console.error('Error fetching blog post:', err);
        res.status(500).render('error', { 
            message: 'Failed to load blog post',
            user: req.session.user || null
        });
    }
};

// Admin: Get all posts for admin management
exports.getAdminPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // More posts per page for admin view
        const offset = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        
        // Query to get total count
        let countQuery = "SELECT COUNT(*) as total FROM blog_post";
        let postsQuery = `
            SELECT bp.*, u.username as author 
            FROM blog_post bp
            JOIN users u ON bp.author_id = u.id
            ORDER BY bp.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        let queryParams = [limit, offset];
        
        // If search parameter exists
        if (searchQuery) {
            countQuery += " WHERE title LIKE ? OR content LIKE ?";
            postsQuery = `
                SELECT bp.*, u.username as author 
                FROM blog_post bp
                JOIN users u ON bp.author_id = u.id
                WHERE bp.title LIKE ? OR bp.content LIKE ?
                ORDER BY bp.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const searchPattern = `%${searchQuery}%`;
            queryParams = [searchPattern, searchPattern, limit, offset];
        }
        
        // Get total count
        const [countResult] = await pool.query(countQuery, searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : []);
        const total = countResult[0].total;
        
        // Get posts
        const [posts] = await pool.query(postsQuery, queryParams);
        
        // Calculate total pages
        const totalPages = Math.ceil(total / limit);
        
        res.render('admin-blog', {
            posts,
            currentPage: page,
            totalPages,
            user: req.session.user
        });
    } catch (err) {
        console.error('Error fetching admin blog posts:', err);
        res.status(500).render('error', { 
            message: 'Failed to load admin blog posts',
            user: req.session.user
        });
    }
};

// These methods are no longer needed as we're using modals
// They're kept as stubs for backward compatibility
exports.getCreateForm = (req, res) => {
    res.redirect('/admin/blog');
};

exports.getEditForm = (req, res) => {
    res.redirect('/admin/blog');
};

// Admin: Create new post
exports.createPost = async (req, res) => {
    try {
        const { title, content } = req.body;
        const authorId = req.session.user.id;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and content are required' 
            });
        }
        
        const [result] = await pool.query(`
            INSERT INTO blog_post (title, content, author_id) 
            VALUES (?, ?, ?)
        `, [title, content, authorId]);
        
        if (result.affectedRows === 1) {
            res.status(201).json({ 
                success: true, 
                message: 'Blog post created successfully',
                postId: result.insertId
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create blog post' 
            });
        }
    } catch (err) {
        console.error('Error creating blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while creating blog post' 
        });
    }
};

// Admin: Update existing post
exports.updatePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and content are required' 
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
                message: 'Blog post updated successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Blog post not found or no changes made' 
            });
        }
    } catch (err) {
        console.error('Error updating blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating blog post' 
        });
    }
};

// Admin: Delete post
exports.deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        
        const [result] = await pool.query(`
            DELETE FROM blog_post WHERE id = ?
        `, [postId]);
        
        if (result.affectedRows === 1) {
            res.json({ 
                success: true, 
                message: 'Blog post deleted successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Blog post not found' 
            });
        }
    } catch (err) {
        console.error('Error deleting blog post:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting blog post' 
        });
    }
};