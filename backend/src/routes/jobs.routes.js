const express = require("express");

const {
  createJob,
  getJobs,
  updateJob,
} = require("../controllers/jobs.controller");

const router = express.Router();

// GET /api/v1/jobs — list jobs
router.get("/", getJobs);

// POST /api/v1/jobs — create a job
router.post("/", createJob);

// PATCH /api/v1/jobs/:id — update a job
router.patch("/:id", updateJob);

module.exports = router;
