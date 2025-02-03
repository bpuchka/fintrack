const User = require("../models/user.model.js");
const bcrypt = require("bcryptjs");

exports.register = (req, res) => {
  if (!req.body) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  User.findByEmail(req.body.email, (err, data) => {
    if (data) {
      res.status(400).send({
        message: "Email already exists"
      });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(req.body.password, salt);

    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hash
    });

    User.create(user, (err, data) => {
      if (err) {
        res.status(500).send({
          message: err.message || "Some error occurred while creating the User."
        });
      } else {
        res.send({ message: "Registration successful" });
      }
    });
  });
};

exports.login = (req, res) => {
  if (!req.body) {
      res.status(400).send({
          message: "Content can not be empty!"
      });
      return;
  }

  User.findByEmail(req.body.email, (err, user) => {
      if (err) {
          res.status(500).send({
              message: "Error retrieving user"
          });
          return;
      }

      if (!user) {
          res.status(404).send({
              message: "User not found"
          });
          return;
      }

      const passwordIsValid = bcrypt.compareSync(
          req.body.password,
          user.password
      );

      if (!passwordIsValid) {
          res.status(401).send({
              message: "Invalid Password!"
          });
          return;
      }

      res.send({
          message: "Login successful",
          user: {
              id: user.id,
              username: user.username,
              email: user.email
          }
      });
  });
};