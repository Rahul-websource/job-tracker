const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  register,
  login,
} = require("../controllers/auth.controller");

const router = express.Router();

// Limit repeated login attempts from the same IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
});

// Limit repeated account registrations from the same IP.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Please try again in one hour.",
  },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

module.exports = router;
