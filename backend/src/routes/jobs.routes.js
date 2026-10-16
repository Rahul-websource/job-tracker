const express = require("express");

const {
  createJob,
  getJobs,
} = require("../controllers/jobs.controller");

const router = express.Router();

// GET /api/v1/jobs — list jobs
router.get("/", getJobs);

// POST /api/v1/jobs — create a job
router.post("/", createJob);

module.exports = router;
