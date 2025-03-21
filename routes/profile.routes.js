// routes/profile.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    next();
};

// Render profile page
router.get("/", requireAuth, (req, res) => {
    res.render("profile", { user: req.session.user });
});

// Update profile info (username and email)
router.post("/update-info", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { username, email } = req.body;
        
        // Validate data
        if (!username || username.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: "Потребителското име трябва да е поне 6 символа" 
            });
        }
        
        if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Невалиден формат на имейл" 
            });
        }
        
        // Check if email already exists (but not for the current user)
        const [existingUsers] = await pool.query(
            "SELECT * FROM users WHERE email = ? AND id != ?", 
            [email, userId]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Този имейл вече се използва от друг потребител" 
            });
        }
        
        // Update user
        const [result] = await pool.query(
            "UPDATE users SET username = ?, email = ? WHERE id = ?", 
            [username, email, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Потребителят не е намерен" 
            });
        }
        
        // Update session data
        req.session.user.username = username;
        req.session.user.email = email;
        
        res.json({ 
            success: true, 
            message: "Профилната информация беше обновена успешно" 
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ 
            success: false, 
            message: "Възникна грешка при обновяване на профила" 
        });
    }
});

// Update password
router.post("/update-password", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { currentPassword, newPassword } = req.body;
        
        // Validate new password
        if (!newPassword || !currentPassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Текущата и новата парола са задължителни" 
            });
        }
        
        // Validate new password format
        const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                success: false, 
                message: "Паролата трябва да е 8-32 символа и да включва главна буква, малка буква, цифра и специален символ" 
            });
        }
        
        // Get current user data
        const [users] = await pool.query(
            "SELECT * FROM users WHERE id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Потребителят не е намерен" 
            });
        }
        
        const user = users[0];
        
        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ 
                success: false, 
                message: "Текущата парола е грешна" 
            });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        const [result] = await pool.query(
            "UPDATE users SET password = ? WHERE id = ?", 
            [hashedPassword, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(500).json({ 
                success: false, 
                message: "Неуспешно обновяване на паролата" 
            });
        }
        
        res.json({ 
            success: true, 
            message: "Паролата беше сменена успешно" 
        });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ 
            success: false, 
            message: "Възникна грешка при обновяване на паролата" 
        });
    }
});

// Logout from all devices
router.post("/logout-all", requireAuth, async (req, res) => {
    try {
        // Destroy the current session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: "Грешка при излизане" 
                });
            }
            
            res.clearCookie('connect.sid');
            res.json({ 
                success: true, 
                message: "Успешно излизане от всички устройства" 
            });
        });
    } catch (error) {
        console.error("Error logging out:", error);
        res.status(500).json({ 
            success: false, 
            message: "Възникна грешка при излизане" 
        });
    }
});

// Delete account
router.delete("/delete-account", requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Begin a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Delete user from database
            await connection.query("DELETE FROM users WHERE id = ?", [userId]);
            
            // Commit transaction
            await connection.commit();
            
            // Destroy session
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                
                res.clearCookie('connect.sid');
                res.json({ 
                    success: true, 
                    message: "Акаунтът беше изтрит успешно" 
                });
            });
        } catch (error) {
            // Rollback in case of error
            await connection.rollback();
            throw error;
        } finally {
            // Release connection
            connection.release();
        }
    } catch (error) {
        console.error("Error deleting account:", error);
        res.status(500).json({ 
            success: false, 
            message: "Възникна грешка при изтриване на акаунта" 
        });
    }
});

module.exports = router;