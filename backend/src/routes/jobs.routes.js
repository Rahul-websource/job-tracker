const express = require("express");

const {
  createJob,
  getJobs,
  updateJob,
  deleteJob,
} = require("../controllers/jobs.controller");

const router = express.Router();

// GET /api/v1/jobs — list jobs
router.get("/", getJobs);

// POST /api/v1/jobs — create a job
router.post("/", createJob);

// PATCH /api/v1/jobs/:id — update a job
router.patch("/:id", updateJob);

// DELETE /api/v1/jobs/:id — delete a job
router.delete("/:id", deleteJob);

module.exports = router;
