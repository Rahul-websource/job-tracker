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
