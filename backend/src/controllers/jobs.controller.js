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

    // 1. Validate company_id.
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

    // 2. Validate job title.
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

    // 4. Validate job URL.
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

    // 5. Insert the job using a parameterized query.
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

    // 1. Validate page.
    if (
      !/^\d+$/.test(page) ||
      !Number.isSafeInteger(Number(page)) ||
      Number(page) < 1
    ) {
      return res.status(400).json({
        error: "page must be a positive integer",
      });
    }

    // 2. Validate limit.
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

    // 3. Validate optional filters.
    for (const [field, value] of Object.entries({
      location,
      employment_type,
      search,
    })) {
      if (typeof value !== "undefined" && typeof value !== "string") {
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

    // 4. Build parameterized filters.
    const conditions = [];
    const values = [];

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

    // 5. Count all jobs matching the filters.
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM jobs
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const totalJobs = Number(countResult.rows[0].total);

    // 6. Fetch the requested page.
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

    // 7. Return jobs and pagination metadata.
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

module.exports = {
  createJob,
  getJobs,
};
