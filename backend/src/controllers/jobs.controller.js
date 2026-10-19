const pool = require("../config/db");

// POST /api/v1/jobs
// Create a new job.
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

    // Validate company_id.
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

    // Validate job title.
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

    // Validate optional text fields.
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

    // Validate job URL.
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
    // Verify that the company belongs to the authenticated user.
    const companyResult = await pool.query(
      `SELECT id
       FROM companies
       WHERE id = $1 AND user_id = $2`,
      [company_id, req.user.id]
    );

    if (companyResult.rowCount === 0) {
      return res.status(404).json({
        error: "Company not found",
      });
    }
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
    if (error.code === "23503") {
      return res.status(400).json({
        error: "The specified company does not exist",
      });
    }

    return next(error);
  }
}

// GET /api/v1/jobs
// List jobs with filtering and pagination.
async function getJobs(req, res, next) {
  try {
    const {
      location,
      employment_type,
      search,
      page = "1",
      limit = "10",
    } = req.query;

    // Validate page.
    if (
      !/^\d+$/.test(page) ||
      !Number.isSafeInteger(Number(page)) ||
      Number(page) < 1
    ) {
      return res.status(400).json({
        error: "page must be a positive integer",
      });
    }

    // Validate limit.
    if (
      !/^\d+$/.test(limit) ||
      !Number.isSafeInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 100
    ) {
      return res.status(400).json({
        error: "limit must be an integer between 1 and 100",
      });
    }

    // Validate filters.
    for (const [field, value] of Object.entries({
      location,
      employment_type,
      search,
    })) {
      if (value !== undefined && typeof value !== "string") {
        return res.status(400).json({
          error: `${field} must be a string`,
        });
      }

      if (typeof value === "string" && value.trim().length > 200) {
        return res.status(400).json({
          error: `${field} must not exceed 200 characters`,
        });
      }
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;

    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({
        error: "Requested page is too large",
      });
    }

    // Build parameterized filters.
    const conditions = ["companies.user_id = $1"];
    const values = [req.user.id];

    if (location?.trim()) {
      values.push(`%${location.trim()}%`);
      conditions.push(`jobs.location ILIKE $${values.length}`);
    }

    if (employment_type?.trim()) {
      values.push(employment_type.trim());
      conditions.push(`jobs.employment_type ILIKE $${values.length}`);
    }

    if (search?.trim()) {
      values.push(`%${search.trim()}%`);
      conditions.push(`jobs.title ILIKE $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Count matching jobs.
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM jobs
      INNER JOIN companies
        ON jobs.company_id = companies.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const totalJobs = Number(countResult.rows[0].total);

    // Fetch the requested page.
    const jobsQuery = `
      SELECT
        jobs.id,
        jobs.company_id,
        companies.name AS company_name,
        jobs.title,
        jobs.description,
        jobs.location,
        jobs.employment_type,
        jobs.job_url,
        jobs.created_at,
        jobs.updated_at
      FROM jobs
      INNER JOIN companies
        ON jobs.company_id = companies.id
      ${whereClause}
      ORDER BY jobs.created_at DESC, jobs.id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const jobsResult = await pool.query(jobsQuery, [
      ...values,
      pageSize,
      offset,
    ]);

    return res.status(200).json({
      count: jobsResult.rows.length,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalJobs,
        totalPages: Math.ceil(totalJobs / pageSize),
      },
      jobs: jobsResult.rows,
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/v1/jobs/:id
// Update selected fields of a job owned by the authenticated user.
async function updateJob(req, res, next) {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({ error: "A valid job ID is required" });
    }

    const allowedFields = ["title", "description", "location", "employment_type", "job_url"];
    const suppliedFields = Object.keys(req.body);

    if (suppliedFields.length === 0) {
      return res.status(400).json({ error: "At least one field must be provided" });
    }

    const unsupportedFields = suppliedFields.filter((field) => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
      return res.status(400).json({ error: `Unsupported field: ${unsupportedFields[0]}` });
    }

    const { title, description, location, employment_type, job_url } = req.body;

    if (Object.hasOwn(req.body, "title") &&
        (typeof title !== "string" || !title.trim())) {
      return res.status(400).json({ error: "Job title must be a non-empty string" });
    }
    if (title !== undefined && title.trim().length > 200) {
      return res.status(400).json({ error: "Job title must not exceed 200 characters" });
    }

    if (Object.hasOwn(req.body, "description") && description !== null &&
        typeof description !== "string") {
      return res.status(400).json({ error: "Description must be a string or null" });
    }

    if (Object.hasOwn(req.body, "location") && location !== null &&
        typeof location !== "string") {
      return res.status(400).json({ error: "Location must be a string or null" });
    }
    if (typeof location === "string" && location.trim().length > 200) {
      return res.status(400).json({ error: "Location must not exceed 200 characters" });
    }

    if (Object.hasOwn(req.body, "employment_type") && employment_type !== null &&
        typeof employment_type !== "string") {
      return res.status(400).json({ error: "Employment type must be a string or null" });
    }
    if (typeof employment_type === "string" && employment_type.trim().length > 50) {
      return res.status(400).json({ error: "Employment type must not exceed 50 characters" });
    }

    if (Object.hasOwn(req.body, "job_url") && job_url !== null && job_url !== "") {
      if (typeof job_url !== "string") {
        return res.status(400).json({ error: "Job URL must be a string or null" });
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

    const values = [];
    const assignments = [];

    for (const field of allowedFields) {
      if (Object.hasOwn(req.body, field)) {
        let value = req.body[field];
        if (typeof value === "string") {
          value = value.trim();
          if (value === "" && field !== "title") value = null;
        }
        values.push(value);
        assignments.push(`${field} = $${values.length}`);
      }
    }

    assignments.push("updated_at = NOW()");
    values.push(id, req.user.id);

    const query = `
      UPDATE jobs
      SET ${assignments.join(", ")}
      WHERE id = $${values.length - 1}
        AND EXISTS (
          SELECT 1
          FROM companies
          WHERE companies.id = jobs.company_id
            AND companies.user_id = $${values.length}
        )
      RETURNING
        id, company_id, title, description, location,
        employment_type, job_url, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(200).json({
      message: "Job updated successfully",
      job: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}


// DELETE /api/v1/jobs/:id
// Delete only a job belonging to the authenticated user.
async function deleteJob(req, res, next) {
  try {
    const { id } = req.params;

    if (
      !/^\d+$/.test(id) ||
      !Number.isSafeInteger(Number(id)) ||
      Number(id) <= 0
    ) {
      return res.status(400).json({
        error: "A valid job ID is required",
      });
    }

    const result = await pool.query(
      `DELETE FROM jobs
       WHERE id = $1
         AND EXISTS (
           SELECT 1
           FROM companies
           WHERE companies.id = jobs.company_id
             AND companies.user_id = $2
         )
       RETURNING id, company_id, title`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    return res.status(200).json({
      message: "Job deleted successfully",
      job: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  createJob,
  getJobs,
  updateJob,
  deleteJob,
};
