const jobsRoutes = require("./routes/jobs.routes");
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
app.use("/api/v1/jobs", jobsRoutes);
// Handle unknown routes.
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Malformed JSON sent by the client.
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      error: "Invalid JSON request body",
    });
  }

  // Log unexpected server-side errors.
  console.error("Unhandled application error:", err.message);

  return res.status(500).json({
    error: "Internal server error",
  });
});
module.exports = app;
