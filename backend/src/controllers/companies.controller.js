const pool = require("../config/db");

async function createCompany(req, res, next) {
  try {
    const { name, website, location, notes } = req.body;

    // 1. Company name is required.
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Company name is required",
      });
    }

    const normalizedName = name.trim();

    // 2. Validate company name length.
    if (normalizedName.length > 200) {
      return res.status(400).json({
        error: "Company name must not exceed 200 characters",
      });
    }

    // 3. Website is optional, but must be a valid URL if provided.
    if (website !== undefined && website !== null && website !== "") {
      if (typeof website !== "string") {
        return res.status(400).json({
          error: "Website must be a string",
        });
      }

      try {
        const parsedUrl = new URL(website);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return res.status(400).json({
          error: "Website must be a valid HTTP or HTTPS URL",
        });
      }
    }

    // 4. Validate location.
    if (location !== undefined && location !== null) {
      if (typeof location !== "string") {
        return res.status(400).json({
          error: "Location must be a string",
        });
      }

      if (location.trim().length > 200) {
        return res.status(400).json({
          error: "Location must not exceed 200 characters",
        });
      }
    }

    // 5. Validate notes.
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string") {
        return res.status(400).json({
          error: "Notes must be a string",
        });
      }
    }

    // Temporary development-only user.
    // Authentication ke baad ise authenticated user ID se replace karenge.
    const userId = req.user.id;

    const query = `
      INSERT INTO companies (user_id, name, website, location, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, website, location, notes, created_at, updated_at
    `;

    const values = [
      userId,
      normalizedName,
      website ? website.trim() : null,
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

    next(error);
  }
}

async function getCompanies(req, res, next) {
  try {
    // Temporary development-only user.
    const userId = req.user.id;
    const query = `
      SELECT id, user_id, name, website, location, notes, created_at, updated_at
      FROM companies
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `;

    const result = await pool.query(query, [userId]);

    return res.status(200).json({
      count: result.rows.length,
      companies: result.rows,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createCompany, getCompanies };
