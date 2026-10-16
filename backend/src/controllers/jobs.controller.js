const pool = require("../config/db");

async function createJob(req, res, next) {
  try {
    const {
      company_id,
      title,
      description,
      location,
      employment_type,
      job_url,
    } = req.body;

    // 1. Company ID is required.
    if (
      company_id === undefined ||
      company_id === null ||
      !/^\d+$/.test(String(company_id)) ||
      !Number.isSafeInteger(Number(company_id)) ||
      Number(company_id) <= 0
    ) {
      return res.status(400).json({
        error: "A valid company_id is required",
      });
    }

    // 2. Job title is required.
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Job title is required",
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        error: "Job title must not exceed 200 characters",
      });
    }

    // 3. Validate optional text fields.
    if (description != null && typeof description !== "string") {
      return res.status(400).json({
        error: "Description must be a string",
      });
    }

    if (location != null && typeof location !== "string") {
      return res.status(400).json({
        error: "Location must be a string",
      });
    }

    if (location && location.trim().length > 200) {
      return res.status(400).json({
        error: "Location must not exceed 200 characters",
      });
    }

    if (
      employment_type != null &&
      (typeof employment_type !== "string" ||
        employment_type.trim().length > 50)
    ) {
      return res.status(400).json({
        error: "Employment type must be a string of at most 50 characters",
      });
    }

    // 4. Validate the optional job URL.
    if (job_url != null && job_url !== "") {
      if (typeof job_url !== "string") {
        return res.status(400).json({
          error: "Job URL must be a string",
        });
      }

      try {
        const parsedUrl = new URL(job_url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Unsupported URL protocol");
        }
      } catch {
        return res.status(400).json({
          error: "Job URL must be a valid HTTP or HTTPS URL",
        });
      }
    }

    // 5. Insert the job using a parameterized SQL query.
    const query = `
      INSERT INTO jobs (
        company_id,
        title,
        description,
        location,
        employment_type,
        job_url
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        company_id,
        title,
        description,
        location,
        employment_type,
        job_url,
        created_at,
        updated_at
    `;

    const values = [
      company_id,
      title.trim(),
      description?.trim() || null,
      location?.trim() || null,
      employment_type?.trim() || null,
      job_url?.trim() || null,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      message: "Job created successfully",
      job: result.rows[0],
    });
  } catch (error) {
    // PostgreSQL foreign-key violation.
    if (error.code === "23503") {
      return res.status(400).json({
        error: "The specified company does not exist",
      });
    }

    return next(error);
  }
}

module.exports = {
  createJob,
};
