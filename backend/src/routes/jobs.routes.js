const express = require("express");

const {
  createJob,
} = require("../controllers/jobs.controller");

const router = express.Router();

// POST /api/v1/jobs — create a job
router.post("/", createJob);

module.exports = router;
