const pool = require("../config/db");

const VALID_OUTCOMES = new Set([
  "scheduled",
  "completed",
  "passed",
  "failed",
  "cancelled",
]);

function parseId(value) {
  if (!/^[1-9]\d*$/.test(String(value))) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function validateInterview(body, partial = false) {
  const allowed = new Set([
    "application_id",
    "interview_round",
    "scheduled_at",
    "interview_type",
    "meeting_url",
    "notes",
    "outcome",
  ]);

  const keys = Object.keys(body || {});

  if (keys.some((key) => !allowed.has(key))) {
    return "Request contains unsupported fields.";
  }

  if (!partial || "application_id" in body) {
    if (parseId(body.application_id) === null) {
      return "application_id must be a positive integer.";
    }
  }

  if (!partial || "interview_round" in body) {
    if (
      typeof body.interview_round !== "string" ||
      !body.interview_round.trim() ||
      body.interview_round.trim().length > 100
    ) {
      return "interview_round is required and must be at most 100 characters.";
    }
  }

  if (!partial || "scheduled_at" in body) {
    if (
      typeof body.scheduled_at !== "string" ||
      !body.scheduled_at.trim() ||
      Number.isNaN(Date.parse(body.scheduled_at))
    ) {
      return "scheduled_at must be a valid date and time.";
    }
  }

  for (const field of ["interview_type", "meeting_url", "notes"]) {
    if (field in body && body[field] !== null &&
        typeof body[field] !== "string") {
      return field + " must be a string or null.";
    }
  }

  if ("interview_type" in body && body.interview_type !== null &&
      body.interview_type.length > 50) {
    return "interview_type must be at most 50 characters.";
  }

  if ("outcome" in body && body.outcome !== null &&
      !VALID_OUTCOMES.has(body.outcome)) {
    return "outcome must be scheduled, completed, passed, failed, or cancelled.";
  }

  return null;
}

async function getOwnedInterview(interviewId, userId) {
  const result = await pool.query(
    `SELECT i.*
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
      WHERE i.id = $1 AND a.user_id = $2`,
    [interviewId, userId]
  );

  return result.rows[0] || null;
}

async function createInterview(req, res) {
  const error = validateInterview(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const application = await pool.query(
      "SELECT id FROM applications WHERE id = $1 AND user_id = $2",
      [req.body.application_id, req.user.id]
    );

    if (!application.rowCount) {
      return res.status(404).json({ error: "Application not found." });
    }

    const result = await pool.query(
      `INSERT INTO interviews
       (application_id, interview_round, scheduled_at, interview_type,
        meeting_url, notes, outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.body.application_id,
        req.body.interview_round.trim(),
        req.body.scheduled_at,
        req.body.interview_type ?? null,
        req.body.meeting_url ?? null,
        req.body.notes ?? null,
        req.body.outcome ?? "scheduled",
      ]
    );

    return res.status(201).json({ interview: result.rows[0] });
  } catch (err) {
    console.error("createInterview failed:", err.message);
    return res.status(500).json({ error: "Failed to create interview." });
  }
}

async function getInterviews(req, res) {
  try {
    const result = await pool.query(
      `SELECT i.*
         FROM interviews i
         JOIN applications a ON a.id = i.application_id
        WHERE a.user_id = $1
        ORDER BY i.scheduled_at ASC, i.id ASC`,
      [req.user.id]
    );

    return res.json({ interviews: result.rows });
  } catch (err) {
    console.error("getInterviews failed:", err.message);
    return res.status(500).json({ error: "Failed to fetch interviews." });
  }
}

async function getInterviewById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid interview ID." });
  }

  try {
    const interview = await getOwnedInterview(id, req.user.id);

    if (!interview) {
      return res.status(404).json({ error: "Interview not found." });
    }

    return res.json({ interview });
  } catch (err) {
    console.error("getInterviewById failed:", err.message);
    return res.status(500).json({ error: "Failed to fetch interview." });
  }
}

async function updateInterview(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid interview ID." });
  }

  const body = req.body || {};
  if (!Object.keys(body).length) {
    return res.status(400).json({ error: "Provide at least one field to update." });
  }

  const error = validateInterview(body, true);
  if (error) return res.status(400).json({ error });

  const fields = {
    application_id: "application_id",
    interview_round: "interview_round",
    scheduled_at: "scheduled_at",
    interview_type: "interview_type",
    meeting_url: "meeting_url",
    notes: "notes",
    outcome: "outcome",
  };

  try {
    const existing = await getOwnedInterview(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: "Interview not found." });
    }

    if ("application_id" in body) {
      const application = await pool.query(
        "SELECT id FROM applications WHERE id = $1 AND user_id = $2",
        [body.application_id, req.user.id]
      );

      if (!application.rowCount) {
        return res.status(404).json({ error: "Application not found." });
      }
    }

    const updates = Object.keys(body);
    const values = updates.map((key) =>
      key === "interview_round" ? body[key].trim() : body[key]
    );
    const assignments = updates.map(
      (key, index) => fields[key] + " = $" + (index + 1)
    );

    assignments.push("updated_at = NOW()");
    values.push(id);

    const result = await pool.query(
      `UPDATE interviews SET ${assignments.join(", ")}
        WHERE id = $${values.length}
        RETURNING *`,
      values
    );

    return res.json({ interview: result.rows[0] });
  } catch (err) {
    console.error("updateInterview failed:", err.message);
    return res.status(500).json({ error: "Failed to update interview." });
  }
}

async function deleteInterview(req, res) {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid interview ID." });
  }

  try {
    const existing = await getOwnedInterview(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: "Interview not found." });
    }

    await pool.query("DELETE FROM interviews WHERE id = $1", [id]);

    return res.json({ message: "Interview deleted successfully." });
  } catch (err) {
    console.error("deleteInterview failed:", err.message);
    return res.status(500).json({ error: "Failed to delete interview." });
  }
}

module.exports = {
  createInterview,
  getInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
};
