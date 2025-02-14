const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load environment variables

// geenrating jtw token
const generateToken = (user) => {
  return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Token expires in 1 hour
  );
};

//user registration
exports.register = async (req, res) => {
  try {
      if (!req.body) {
          return res.status(400).json({ message: "Content cannot be empty!" });
      }

      const existingUser = await new Promise((resolve, reject) => {
          User.findByEmail(req.body.email, (err, data) => {
              if (err) reject(err);
              resolve(data);
          });
      });

      if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(req.body.password, salt);

      const user = new User({
          username: req.body.username,
          email: req.body.email,
          password: hash,
      });

      await new Promise((resolve, reject) => {
          User.create(user, (err, data) => {
              if (err) reject(err);
              resolve(data);
          });
      });

      res.status(201).json({ message: "Registration successful" });
  } catch (error) {
      res.status(500).json({ message: error.message || "Error registering user." });
  }
};

//user login
exports.login = async (req, res) => {
  try {
      if (!req.body) {
          return res.status(400).json({ message: "Content cannot be empty!" });
      }

      const user = await new Promise((resolve, reject) => {
          User.findByEmail(req.body.email, (err, data) => {
              if (err) reject(err);
              resolve(data);
          });
      });

      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      const passwordIsValid = await bcrypt.compare(req.body.password, user.password);
      if (!passwordIsValid) {
          return res.status(401).json({ message: "Invalid Password!" });
      }

      const token = generateToken(user);
      
      // Set user session
      req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email
      };

      res.json({
          message: "Login successful",
          user: { id: user.id, username: user.username, email: user.email },
          token
      });
  } catch (error) {
      console.error("Login error:", error); // Add this for debugging
      res.status(500).json({ message: "Error logging in" });
  }
};

//user logout 
exports.logout = async (req, res) => {
  try {
      // Since JWT is stateless, we can't really "invalidate" it on the server side
      // The client should remove the token from their storage
      res.json({ message: "Logged out successfully" });
  } catch (error) {
      res.status(500).json({ message: "Error logging out" });
  }
};

//middleware to verify token
exports.verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
      return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
          return res.status(401).json({ message: "Unauthorized! Invalid token" });
      }
      req.user = decoded; // Attach user info to request
      next();
  });
};