const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");
const {
  createCompany,
  getCompanies,
} = require("../controllers/companies.controller");

const router = express.Router();

// GET /api/v1/companies — retrieve companies
router.get("/", authenticateToken, getCompanies);
router.post("/", authenticateToken, createCompany);

module.exports = router;
