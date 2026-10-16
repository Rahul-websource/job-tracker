require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const app = require("../src/app");
const pool = require("../src/config/db");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await pool.end();
});

test("POST /api/v1/jobs rejects a missing title", async () => {
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company_id: "1",
    }),
  });

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(body.error, "Job title is required");
});

test("POST /api/v1/jobs rejects an invalid company_id", async () => {
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company_id: "invalid",
      title: "Software Engineer",
    }),
  });

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(body.error, "A valid company_id is required");
});

test("POST /api/v1/jobs rejects an invalid job URL", async () => {
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      company_id: "1",
      title: "Software Engineer",
      job_url: "not-a-valid-url",
    }),
  });

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(
    body.error,
    "Job URL must be a valid HTTP or HTTPS URL"
  );
});

test("POST /api/v1/jobs creates a job in PostgreSQL", async () => {
  const title = `Integration Test Job ${randomUUID()}`;

  try {
    const response = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: "1",
        title,
        description: "Integration test description",
        location: "Noida",
        employment_type: "Full-time",
        job_url: "https://example.com/jobs/test",
      }),
    });

    assert.equal(response.status, 201);

    const body = await response.json();

    assert.equal(body.message, "Job created successfully");
    assert.equal(body.job.title, title);
    assert.equal(body.job.company_id, "1");
    assert.equal(body.job.description, "Integration test description");
    assert.equal(body.job.location, "Noida");
    assert.equal(body.job.employment_type, "Full-time");
    assert.equal(
      body.job.job_url,
      "https://example.com/jobs/test"
    );

    assert.match(body.job.id, /^\d+$/);
    assert.ok(body.job.created_at);
    assert.ok(body.job.updated_at);

    // Confirm that PostgreSQL actually stored the job.
    const result = await pool.query(
      `SELECT id, title
       FROM jobs
       WHERE company_id = $1 AND title = $2`,
      ["1", title]
    );

    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].title, title);
  } finally {
    // Delete only this test's uniquely named job.
    await pool.query(
      `DELETE FROM jobs
       WHERE company_id = $1 AND title = $2`,
      ["1", title]
    );
  }
});
test("GET /api/v1/jobs returns jobs with company details", async () => {
  const response = await fetch(`${baseUrl}/api/v1/jobs`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.ok(Array.isArray(body.jobs));
  assert.equal(body.count, body.jobs.length);

  if (body.jobs.length > 0) {
    const job = body.jobs[0];

    assert.ok(job.id);
    assert.ok(job.company_id);
    assert.equal(typeof job.company_name, "string");
    assert.ok(job.company_name.length > 0);
    assert.equal(typeof job.title, "string");
    assert.ok(job.created_at);
  }
});

test("GET /api/v1/jobs returns pagination metadata", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs?page=1&limit=5`
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.pagination.page, 1);
  assert.equal(body.pagination.limit, 5);
  assert.ok(body.pagination.totalJobs >= 0);
  assert.ok(body.pagination.totalPages >= 0);
  assert.ok(body.count <= 5);
  assert.equal(body.count, body.jobs.length);
});

test("GET /api/v1/jobs rejects an invalid page", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs?page=0`
  );

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(
    body.error,
    "page must be a positive integer"
  );
});

test("GET /api/v1/jobs rejects a limit greater than 100", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs?limit=101`
  );

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(
    body.error,
    "limit must be an integer between 1 and 100"
  );
});

test("GET /api/v1/jobs filters jobs by location", async () => {
  const title = `Filtering Test Job ${randomUUID()}`;

  try {
    await pool.query(
      `INSERT INTO jobs (
         company_id,
         title,
         location,
         employment_type
       )
       VALUES ($1, $2, $3, $4)`,
      ["1", title, "Noida", "Internship"]
    );

    const response = await fetch(
      `${baseUrl}/api/v1/jobs?location=Noida&search=${encodeURIComponent(title)}`
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.ok(
      body.jobs.some(
        (job) =>
          job.title === title &&
          job.location === "Noida"
      )
    );

    assert.ok(
      body.jobs.every(
        (job) =>
          job.location &&
          job.location.toLowerCase().includes("noida")
      )
    );
  } finally {
    await pool.query(
      `DELETE FROM jobs
       WHERE company_id = $1 AND title = $2`,
      ["1", title]
    );
  }
});

test("PATCH /api/v1/jobs/:id updates an existing job", async () => {
  const title = `Update Test Job ${randomUUID()}`;
  let jobId;

  try {
    // Create a temporary job for this test.
    const insertResult = await pool.query(
      `INSERT INTO jobs (
         company_id,
         title,
         location,
         employment_type
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ["1", title, "Noida", "Internship"]
    );

    jobId = insertResult.rows[0].id;

    const response = await fetch(
      `${baseUrl}/api/v1/jobs/${jobId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated Software Engineer",
          location: "Gurugram",
        }),
      }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.message, "Job updated successfully");
    assert.equal(body.job.title, "Updated Software Engineer");
    assert.equal(body.job.location, "Gurugram");
    assert.equal(body.job.employment_type, "Internship");
    assert.ok(body.job.updated_at);
  } finally {
    if (jobId) {
      await pool.query(
        "DELETE FROM jobs WHERE id = $1",
        [jobId]
      );
    }
  }
});

test("PATCH /api/v1/jobs/:id returns 404 for a missing job", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs/999999999`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Updated Software Engineer",
      }),
    }
  );

  assert.equal(response.status, 404);

  const body = await response.json();

  assert.equal(body.error, "Job not found");
});

test("PATCH /api/v1/jobs/:id rejects an empty request body", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs/1`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(
    body.error,
    "At least one field must be provided"
  );
});

test("PATCH /api/v1/jobs/:id rejects an invalid job ID", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/jobs/invalid`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Updated Software Engineer",
      }),
    }
  );

  assert.equal(response.status, 400);

  const body = await response.json();

  assert.equal(body.error, "A valid job ID is required");
});
