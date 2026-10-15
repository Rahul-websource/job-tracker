const express = require("express");

const {
  createCompany,
  getCompanies,
} = require("../controllers/companies.controller");

const router = express.Router();

// GET /api/v1/companies — retrieve companies
router.get("/", getCompanies);

// POST /api/v1/companies — create a company
router.post("/", createCompany);

module.exports = router;
