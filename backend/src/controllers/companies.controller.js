const pool = require("../config/db");

function validateCompanyFields({ name, website, location, notes }, requireName = true) {
  if (requireName && (typeof name !== "string" || !name.trim())) {
    return "Company name is required";
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return "Company name must be a non-empty string";
    }

    if (name.trim().length > 200) {
      return "Company name must not exceed 200 characters";
    }
  }

  if (website !== undefined && website !== null && website !== "") {
    if (typeof website !== "string") {
      return "Website must be a string";
    }

    try {
      const parsedUrl = new URL(website);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return "Website must be a valid HTTP or HTTPS URL";
    }
  }

  if (location !== undefined && location !== null) {
    if (typeof location !== "string") {
      return "Location must be a string";
    }

    if (location.trim().length > 200) {
      return "Location must not exceed 200 characters";
    }
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return "Notes must be a string";
  }

  return null;
}

async function createCompany(req, res, next) {
  try {
    const { name, website, location, notes } = req.body;

    const validationError = validateCompanyFields(req.body);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const query = `
      INSERT INTO companies (user_id, name, website, location, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, website, location, notes, created_at, updated_at
    `;

    const values = [
      req.user.id,
      name.trim(),
      website?.trim() || null,
      location?.trim() || null,
      notes?.trim() || null,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      message: "Company created successfully",
      company: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This company already exists for this user",
      });
    }

    return next(error);
  }
}

async function getCompanies(req, res, next) {
  try {
    const result = await pool.query(
      `
        SELECT
          companies.id,
          companies.user_id,
          companies.name,
          companies.website,
          companies.location,
          companies.notes,
          companies.created_at,
          companies.updated_at,
          COUNT(jobs.id)::int AS job_count
        FROM companies
        LEFT JOIN jobs ON jobs.company_id = companies.id
        WHERE companies.user_id = $1
        GROUP BY companies.id
        ORDER BY companies.created_at DESC, companies.id DESC
      `,
      [req.user.id]
    );

    return res.status(200).json({
      count: result.rows.length,
      companies: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function getCompanyById(req, res, next) {
  try {
    const companyResult = await pool.query(
      `
        SELECT id, user_id, name, website, location, notes, created_at, updated_at
        FROM companies
        WHERE id = $1 AND user_id = $2
      `,
      [req.params.id, req.user.id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const jobsResult = await pool.query(
      `
        SELECT
          jobs.id,
          jobs.company_id,
          jobs.title,
          jobs.description,
          jobs.location,
          jobs.employment_type,
          jobs.job_url,
          jobs.created_at,
          jobs.updated_at
        FROM jobs
        WHERE jobs.company_id = $1
        ORDER BY jobs.created_at DESC, jobs.id DESC
      `,
      [companyResult.rows[0].id]
    );

    return res.status(200).json({
      company: companyResult.rows[0],
      jobs: jobsResult.rows,
      jobCount: jobsResult.rows.length,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCompany(req, res, next) {
  try {
    const { name, website, location, notes } = req.body;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "Request body must not be empty" });
    }

    const validationError = validateCompanyFields(req.body, false);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const allowedFields = {
      name: name === undefined ? undefined : name.trim(),
      website: website === undefined ? undefined : website?.trim() || null,
      location: location === undefined ? undefined : location?.trim() || null,
      notes: notes === undefined ? undefined : notes?.trim() || null,
    };

    const fields = Object.entries(allowedFields).filter(
      ([, value]) => value !== undefined
    );

    if (fields.length === 0) {
      return res.status(400).json({
        error: "Provide at least one field to update",
      });
    }

    const setClause = fields
      .map(([field], index) => `${field} = $${index + 1}`)
      .concat("updated_at = CURRENT_TIMESTAMP")
      .join(", ");

    const values = fields.map(([, value]) => value);
    values.push(req.params.id, req.user.id);

    const result = await pool.query(
      `
        UPDATE companies
        SET ${setClause}
        WHERE id = $${values.length - 1}
          AND user_id = $${values.length}
        RETURNING id, user_id, name, website, location, notes, created_at, updated_at
      `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    return res.status(200).json({
      message: "Company updated successfully",
      company: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This company already exists for this user",
      });
    }

    return next(error);
  }
}

async function deleteCompany(req, res, next) {
  const { id } = req.params;

  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  ) {
    return res.status(400).json({
      error: "A valid company ID is required",
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // Lock the company row to coordinate with concurrent job creation.
    const companyResult = await client.query(
      `SELECT id
       FROM companies
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [id, req.user.id]
    );

    if (companyResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Company not found",
      });
    }

    const companyId = companyResult.rows[0].id;

    const jobsResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM jobs WHERE company_id = $1",
      [companyId]
    );

    const linkedJobs = jobsResult.rows[0].count;

    if (linkedJobs > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: "This company has linked jobs. Delete or reassign its jobs before deleting the company.",
        linkedJobs,
      });
    }

    const result = await client.query(
      `DELETE FROM companies
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [companyId, req.user.id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Company not found",
      });
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Company deleted successfully",
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Failed to roll back company deletion transaction:",
          rollbackError.message
        );
      }
    }

    // Database-level protection against deleting a company with linked jobs.
    if (error.code === "23503" || error.code === "23514") {
      return res.status(409).json({
        error: "This company cannot be deleted while dependent records exist.",
      });
    }

    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};
