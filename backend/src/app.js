const express = require("express");
const healthRoutes = require("./routes/health.routes");
const companiesRoutes = require("./routes/companies.routes");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to Job Tracker API",
  });
});

app.use("/health", healthRoutes);
app.use("/api/v1/companies", companiesRoutes);
// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  console.error("Unhandled application error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

module.exports = app;
