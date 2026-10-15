const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// Check whether the API server is responding.
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "job-tracker-api",
    timestamp: new Date().toISOString(),
  });
});

// Check whether the API can query PostgreSQL.
router.get("/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

module.exports = router;
