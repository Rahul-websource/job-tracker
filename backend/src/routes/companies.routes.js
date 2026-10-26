const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");

const {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} = require("../controllers/companies.controller");

const router = express.Router();

// List all companies owned by the authenticated user.
router.get("/", authenticateToken, getCompanies);

// Create a company.
router.post("/", authenticateToken, createCompany);

// Get one company and its associated jobs.
router.get("/:id", authenticateToken, getCompanyById);

// Update company details.
router.patch("/:id", authenticateToken, updateCompany);

// Delete a company only when it has no linked jobs.
router.delete("/:id", authenticateToken, deleteCompany);

module.exports = router;
