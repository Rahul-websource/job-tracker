require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const app = require("../src/app");
const pool = require("../src/config/db");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await pool.end();
});

test("POST /api/v1/applications creates an application and initial status history", async () => {
  const title = `Application Test Job ${randomUUID()}`;
  let jobId;
  let applicationId;

  try {
    const jobResult = await pool.query(
      `INSERT INTO jobs (company_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      ["1", title]
    );

    jobId = jobResult.rows[0].id;

    const response = await fetch(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        job_id: jobId,
        status: "applied",
        notes: "Integration test application",
      }),
    });

    assert.equal(response.status, 201);

    const body = await response.json();

    assert.equal(body.message, "Application created successfully");
    assert.equal(body.application.user_id, "1");
    assert.equal(body.application.job_id, String(jobId));
    assert.equal(body.application.status, "applied");

    applicationId = body.application.id;

    const historyResult = await pool.query(
      `SELECT old_status, new_status
       FROM status_history
       WHERE application_id = $1`,
      [applicationId]
    );

    assert.equal(historyResult.rowCount, 1);
    assert.equal(historyResult.rows[0].old_status, null);
    assert.equal(historyResult.rows[0].new_status, "applied");
  } finally {
    if (applicationId) {
      await pool.query(
        "DELETE FROM applications WHERE id = $1",
        [applicationId]
      );
    }

    if (jobId) {
      await pool.query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
  }
});

test("POST /api/v1/applications rejects an invalid user ID", async () => {
  const response = await fetch(`${baseUrl}/api/v1/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: 0,
      job_id: 24,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "A valid user_id is required");
});

test("POST /api/v1/applications rejects an invalid status", async () => {
  const response = await fetch(`${baseUrl}/api/v1/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: 1,
      job_id: 24,
      status: "pending",
    }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Status must be one of/);
});

test("POST /api/v1/applications rejects a non-existent job", async () => {
  const missingJobResult = await pool.query(
    "SELECT (COALESCE(MAX(id), 0) + 1000000)::text AS id FROM jobs"
  );

  const response = await fetch(`${baseUrl}/api/v1/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: 1,
      job_id: missingJobResult.rows[0].id,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).error,
    "The specified user or job does not exist"
  );
});

test("POST /api/v1/applications rejects a duplicate application", async () => {
  const title = `Duplicate Application Test ${randomUUID()}`;
  let jobId;
  let applicationId;

  try {
    const jobResult = await pool.query(
      `INSERT INTO jobs (company_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      ["1", title]
    );

    jobId = jobResult.rows[0].id;

    const payload = {
      user_id: 1,
      job_id: jobId,
      status: "applied",
    };

    const firstResponse = await fetch(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(firstResponse.status, 201);

    const firstBody = await firstResponse.json();
    applicationId = firstBody.application.id;

    const secondResponse = await fetch(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(secondResponse.status, 409);
    assert.equal(
      (await secondResponse.json()).error,
      "An application already exists for this user and job"
    );
  } finally {
    if (applicationId) {
      await pool.query(
        "DELETE FROM applications WHERE id = $1",
        [applicationId]
      );
    }

    if (jobId) {
      await pool.query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
  }
});

// GET /api/v1/applications integration tests

test("GET /api/v1/applications returns applications with job and company details", async () => {
  const uniqueId = randomUUID();
  let jobId;
  let applicationId;

  try {
    const jobResult = await pool.query(
      `INSERT INTO jobs (company_id, title, location, employment_type)
       VALUES (1, $1, $2, $3)
       RETURNING id`,
      [`Application GET Test ${uniqueId}`, "Bengaluru", "Full-time"]
    );
    jobId = jobResult.rows[0].id;

    const createResponse = await fetch(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        job_id: jobId,
        status: "applied",
        notes: "GET endpoint integration test",
      }),
    });

    assert.equal(createResponse.status, 201);
    const createBody = await createResponse.json();
    applicationId = createBody.application.id;

    const response = await fetch(
      `${baseUrl}/api/v1/applications?user_id=1`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.applications));
    assert.ok(body.count >= 1);
    assert.ok(body.applications.some((application) =>
      String(application.id) === String(applicationId)
    ));

    const application = body.applications.find(
      (item) => String(item.id) === String(applicationId)
    );

    assert.equal(application.job_title, `Application GET Test ${uniqueId}`);
    assert.equal(application.company_name, "Google");
    assert.equal(application.status, "applied");
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 10);
  } finally {
    if (applicationId !== undefined) {
      await pool.query("DELETE FROM applications WHERE id = $1", [
        applicationId,
      ]);
    }
    if (jobId !== undefined) {
      await pool.query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
  }
});

test("GET /api/v1/applications filters applications by status", async () => {
  const uniqueId = randomUUID();
  let jobId;
  let applicationId;

  try {
    const jobResult = await pool.query(
      `INSERT INTO jobs (company_id, title, location, employment_type)
       VALUES (1, $1, $2, $3)
       RETURNING id`,
      [`Application Status Test ${uniqueId}`, "Delhi", "Full-time"]
    );
    jobId = jobResult.rows[0].id;

    const createResponse = await fetch(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: 1,
        job_id: jobId,
        status: "interview",
      }),
    });

    assert.equal(createResponse.status, 201);
    const createBody = await createResponse.json();
    applicationId = createBody.application.id;

    const response = await fetch(
      `${baseUrl}/api/v1/applications?user_id=1&status=interview`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(body.applications.some((application) =>
      String(application.id) === String(applicationId)
    ));
    assert.ok(body.applications.every(
      (application) => application.status === "interview"
    ));
  } finally {
    if (applicationId !== undefined) {
      await pool.query("DELETE FROM applications WHERE id = $1", [
        applicationId,
      ]);
    }
    if (jobId !== undefined) {
      await pool.query("DELETE FROM jobs WHERE id = $1", [jobId]);
    }
  }
});

test("GET /api/v1/applications rejects an invalid status", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/applications?status=unknown`
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /status/i);
});

test("GET /api/v1/applications rejects an invalid page", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/applications?page=0`
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /page/i);
});

test("GET /api/v1/applications rejects a limit greater than 100", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/applications?limit=101`
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /limit/i);
});
