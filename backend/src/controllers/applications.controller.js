const pool = require("../config/db");

const VALID_STATUSES = [
  "applied",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

// POST /api/v1/applications
// Create an application and record its initial status atomically.
async function createApplication(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "A valid JSON object is required",
    });
  }

  const { user_id, job_id, status = "applied", notes, follow_up_at } = body;

  // Validate user ID.
  if (
    user_id === undefined ||
    !/^\d+$/.test(String(user_id)) ||
    !Number.isSafeInteger(Number(user_id)) ||
    Number(user_id) <= 0
  ) {
    return res.status(400).json({
      error: "A valid user_id is required",
    });
  }

  // Validate job ID.
  if (
    job_id === undefined ||
    !/^\d+$/.test(String(job_id)) ||
    !Number.isSafeInteger(Number(job_id)) ||
    Number(job_id) <= 0
  ) {
    return res.status(400).json({
      error: "A valid job_id is required",
    });
  }

  // Validate status.
  if (
    typeof status !== "string" ||
    !VALID_STATUSES.includes(status.trim().toLowerCase())
  ) {
    return res.status(400).json({
      error: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Validate optional notes.
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      error: "Notes must be a string or null",
    });
  }

  // Validate optional follow-up date.
  if (follow_up_at !== undefined && follow_up_at !== null) {
    if (typeof follow_up_at !== "string" || !follow_up_at.trim()) {
      return res.status(400).json({
        error: "follow_up_at must be a valid date-time string or null",
      });
    }

    const parsedDate = new Date(follow_up_at);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: "follow_up_at must be a valid date-time string or null",
      });
    }
  }

  const normalizedStatus = status.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `INSERT INTO applications (
         user_id,
         job_id,
         status,
         notes,
         follow_up_at
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         user_id,
         job_id,
         status,
         applied_at,
         follow_up_at,
         notes,
         created_at,
         updated_at`,
      [
        String(user_id),
        String(job_id),
        normalizedStatus,
        notes?.trim() || null,
        follow_up_at ? new Date(follow_up_at).toISOString() : null,
      ]
    );

    const application = insertResult.rows[0];

    await client.query(
      `INSERT INTO status_history (
         application_id,
         old_status,
         new_status,
         notes
       )
       VALUES ($1, NULL, $2, $3)`,
      [application.id, application.status, "Initial application status"]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        error: "An application already exists for this user and job",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        error: "The specified user or job does not exist",
      });
    }

    return next(error);
  } finally {
    client.release();
  }
}


// GET /api/v1/applications
// List applications with job/company details, filters, and pagination.
async function getApplications(req, res, next) {
  try {
    const {
      user_id = "1",
      status,
      page = "1",
      limit = "10",
    } = req.query;

    // Validate user ID.
    if (
      !/^\d+$/.test(user_id) ||
      !Number.isSafeInteger(Number(user_id)) ||
      Number(user_id) <= 0
    ) {
      return res.status(400).json({
        error: "A valid user_id is required",
      });
    }

    // Validate pagination.
    if (
      !/^\d+$/.test(page) ||
      !Number.isSafeInteger(Number(page)) ||
      Number(page) < 1
    ) {
      return res.status(400).json({
        error: "page must be a positive integer",
      });
    }

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

    // Validate optional status filter.
    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !VALID_STATUSES.includes(status.trim().toLowerCase())
      ) {
        return res.status(400).json({
          error: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
    }

    const userId = String(user_id);
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;

    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({
        error: "Requested page is too large",
      });
    }

    const values = [userId];
    const conditions = ["applications.user_id = $1"];

    if (status !== undefined) {
      values.push(status.trim().toLowerCase());
      conditions.push(`applications.status = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM applications
       ${whereClause}`,
      values
    );

    const totalApplications = Number(countResult.rows[0].total);

    const applicationsResult = await pool.query(
      `SELECT
         applications.id,
         applications.user_id,
         applications.job_id,
         applications.status,
         applications.applied_at,
         applications.follow_up_at,
         applications.notes,
         applications.created_at,
         applications.updated_at,
         jobs.title AS job_title,
         jobs.location AS job_location,
         jobs.employment_type,
         companies.name AS company_name,
         COALESCE(
           (
             SELECT status_history.changed_at
             FROM status_history
             WHERE status_history.application_id = applications.id
             ORDER BY status_history.changed_at DESC, status_history.id DESC
             LIMIT 1
           ),
           applications.created_at
         ) AS last_status_change_at
       FROM applications
       INNER JOIN jobs
         ON jobs.id = applications.job_id
       INNER JOIN companies
         ON companies.id = jobs.company_id
       ${whereClause}
       ORDER BY applications.created_at DESC, applications.id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, pageSize, offset]
    );

    return res.status(200).json({
      count: applicationsResult.rows.length,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        totalApplications,
        totalPages: Math.ceil(totalApplications / pageSize),
      },
      applications: applicationsResult.rows,
    });
  } catch (error) {
    return next(error);
  }
}


// PATCH /api/v1/applications/:id
// Update application status and record its history atomically.
async function updateApplicationStatus(req, res, next) {
  const { id } = req.params;
  const body = req.body;

  // Validate application ID.
  if (
    !/^[1-9]\d*$/.test(id) ||
    !Number.isSafeInteger(Number(id))
  ) {
    return res.status(400).json({
      error: "A valid application ID is required",
    });
  }

  // Validate request body.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "A valid JSON object is required",
    });
  }

  const { status, notes, follow_up_at } = body;

  // Require a new status.
  if (
    typeof status !== "string" ||
    !VALID_STATUSES.includes(status.trim().toLowerCase())
  ) {
    return res.status(400).json({
      error: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Validate optional notes.
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      error: "Notes must be a string or null",
    });
  }

  // Validate optional follow-up date.
  if (follow_up_at !== undefined && follow_up_at !== null) {
    if (typeof follow_up_at !== "string" || !follow_up_at.trim()) {
      return res.status(400).json({
        error: "follow_up_at must be a valid date-time string or null",
      });
    }

    const parsedDate = new Date(follow_up_at);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        error: "follow_up_at must be a valid date-time string or null",
      });
    }
  }

  const normalizedStatus = status.trim().toLowerCase();
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Lock the row to prevent concurrent status updates from overwriting
    // each other's history.
    const existingResult = await client.query(
      `SELECT id, status
       FROM applications
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Application not found",
      });
    }

    const existingApplication = existingResult.rows[0];
    const oldStatus = existingApplication.status;

    const updateResult = await client.query(
      `UPDATE applications
       SET status = $1,
           notes = CASE WHEN $2::boolean THEN $3 ELSE notes END,
           follow_up_at = CASE WHEN $4::boolean THEN $5::timestamptz ELSE follow_up_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING
         id,
         user_id,
         job_id,
         status,
         applied_at,
         follow_up_at,
         notes,
         created_at,
         updated_at`,
      [
        normalizedStatus,
        Object.hasOwn(body, "notes"),
        notes === undefined ? null : notes?.trim() || null,
        Object.hasOwn(body, "follow_up_at"),
        follow_up_at ? new Date(follow_up_at).toISOString() : null,
        id,
      ]
    );

    const application = updateResult.rows[0];

    // Record a history entry only when the status actually changes.
    if (oldStatus !== normalizedStatus) {
      await client.query(
        `INSERT INTO status_history (
           application_id,
           old_status,
           new_status,
           notes
         )
         VALUES ($1, $2, $3, $4)`,
        [
          id,
          oldStatus,
          normalizedStatus,
          "Application status updated",
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Application status updated successfully",
      application,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Preserve the original error if rollback itself fails.
      }
    }

    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
}
// GET /api/v1/applications/:id/history
// Retrieve the status history of an application in chronological order.
async function getApplicationHistory(req, res, next) {
  const { id } = req.params;

  // Validate application ID.
  if (
    !/^[1-9]\d*$/.test(id) ||
    !Number.isSafeInteger(Number(id))
  ) {
    return res.status(400).json({
      error: "A valid application ID is required",
    });
  }

  try {
    // Check whether the application exists.
    const applicationResult = await pool.query(
      `SELECT id
       FROM applications
       WHERE id = $1`,
      [id]
    );

    if (applicationResult.rows.length === 0) {
      return res.status(404).json({
        error: "Application not found",
      });
    }

    // Fetch the application's status history, oldest entry first.
    const historyResult = await pool.query(
      `SELECT
         id,
         old_status,
         new_status,
         changed_at,
         notes
       FROM status_history
       WHERE application_id = $1
       ORDER BY changed_at ASC, id ASC`,
      [id]
    );

    return res.status(200).json({
      application_id: applicationResult.rows[0].id,
      count: historyResult.rows.length,
      history: historyResult.rows,
    });
  } catch (error) {
    return next(error);
  }
}
module.exports = {
  createApplication,
  getApplications,
  updateApplicationStatus,
  getApplicationHistory,
};
