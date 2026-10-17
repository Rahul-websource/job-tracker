const express = require("express");

const {
  createApplication,
  getApplications,
  updateApplicationStatus,
  getApplicationHistory,
} = require("../controllers/applications.controller");

const router = express.Router();

// POST /api/v1/applications — create an application
router.post("/", createApplication);

// GET /api/v1/applications — list applications
router.get("/", getApplications);

// PATCH /api/v1/applications/:id — update application status
router.patch("/:id", updateApplicationStatus);

// GET /api/v1/applications/:id/history — get application status history
router.get("/:id/history", getApplicationHistory);

module.exports = router;
