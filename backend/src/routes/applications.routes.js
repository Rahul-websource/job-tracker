const express = require("express");

const {
  createApplication,
  getApplications,
  updateApplicationStatus,
} = require("../controllers/applications.controller");

const router = express.Router();

// POST /api/v1/applications — create an application
router.post("/", createApplication);

// GET /api/v1/applications — list applications
router.get("/", getApplications);

// PATCH /api/v1/applications/:id — update application status
router.patch("/:id", updateApplicationStatus);

module.exports = router;
