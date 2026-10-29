require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const pool = require("../src/config/db");

let server;
let baseUrl;
let fixture;

function authHeaders(userId, json = true) {
  const token = jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );

  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function createFixture() {
  const suffix = randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["Interview Test User", `interview-${suffix}@example.com`,
       await bcrypt.hash("TestPassword!123", 4)]
    );
    const userId = userResult.rows[0].id;

    const companyResult = await client.query(
      `INSERT INTO companies (user_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, `Interview Test Company ${suffix}`]
    );
    const companyId = companyResult.rows[0].id;

    const jobResult = await client.query(
      `INSERT INTO jobs (company_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      [companyId, `Interview Test Job ${suffix}`]
    );
    const jobId = jobResult.rows[0].id;

    const applicationResult = await client.query(
      `INSERT INTO applications (user_id, job_id, status)
       VALUES ($1, $2, 'applied')
       RETURNING id`,
      [userId, jobId]
    );

    await client.query("COMMIT");

    return {
      userId: String(userId),
      applicationId: String(applicationResult.rows[0].id),
      jobId: String(jobId),
      companyId: String(companyId),
      email: `interview-${suffix}@example.com`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupFixture(data) {
  if (!data) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM interviews WHERE application_id = $1",
      [data.applicationId]
    );

    await client.query(
      "DELETE FROM applications WHERE id = $1",
      [data.applicationId]
    );

    await client.query(
      "DELETE FROM jobs WHERE id = $1",
      [data.jobId]
    );

    await client.query(
      "DELETE FROM companies WHERE id = $1",
      [data.companyId]
    );

    await client.query(
      "DELETE FROM users WHERE id = $1",
      [data.userId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function request(path, options = {}, userId = fixture.userId) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...authHeaders(userId),
      ...(options.headers || {}),
    },
  });
}

test.before(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
  fixture = await createFixture();
});

test.after(async () => {
  try {
    await cleanupFixture(fixture);
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }

    await pool.end();
  }
});

test("POST /api/v1/interviews creates an interview", async () => {
  const response = await request("/api/v1/interviews", {
    method: "POST",
    body: JSON.stringify({
      application_id: fixture.applicationId,
      interview_round: "Technical Round",
      scheduled_at: "2030-01-15T10:00:00Z",
      interview_type: "Technical",
      meeting_url: "https://example.com/meeting",
      notes: "Integration test",
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(String(body.interview.application_id), fixture.applicationId);
  assert.equal(body.interview.interview_round, "Technical Round");
  assert.equal(body.interview.outcome, "scheduled");
});

test("GET /api/v1/interviews lists the user's interviews", async () => {
  const response = await request("/api/v1/interviews");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.interviews));
});

test("POST /api/v1/interviews rejects invalid application IDs", async () => {
  const response = await request("/api/v1/interviews", {
    method: "POST",
    body: JSON.stringify({
      application_id: "invalid",
      interview_round: "Technical",
      scheduled_at: "2030-01-15T10:00:00Z",
    }),
  });

  assert.equal(response.status, 400);
});

test("GET /api/v1/interviews/:id rejects invalid IDs", async () => {
  const response = await request("/api/v1/interviews/not-an-id");

  assert.equal(response.status, 400);
});

test("Interview endpoints require authentication", async () => {
  const response = await fetch(`${baseUrl}/api/v1/interviews`);

  assert.equal(response.status, 401);
});

test("Interview endpoints do not expose another user's application", async () => {
  const response = await request("/api/v1/interviews", {
    method: "POST",
    body: JSON.stringify({
      application_id: "999999999",
      interview_round: "Technical",
      scheduled_at: "2030-01-15T10:00:00Z",
    }),
  });

  assert.equal(response.status, 404);
});


async function createTestInterview() {
  const response = await request("/api/v1/interviews", {
    method: "POST",
    body: JSON.stringify({
      application_id: fixture.applicationId,
      interview_round: "Test Round",
      scheduled_at: "2030-01-15T10:00:00Z",
      interview_type: "Technical",
      notes: "CRUD integration test",
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  return body.interview;
}

test("GET /api/v1/interviews/:id retrieves an owned interview", async () => {
  const interview = await createTestInterview();

  try {
    const response = await request(`/api/v1/interviews/${interview.id}`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(String(body.interview.id), String(interview.id));
    assert.equal(body.interview.interview_round, "Test Round");
  } finally {
    await pool.query("DELETE FROM interviews WHERE id = $1", [interview.id]);
  }
});

test("PATCH /api/v1/interviews/:id updates an owned interview", async () => {
  const interview = await createTestInterview();

  try {
    const response = await request(`/api/v1/interviews/${interview.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        interview_round: "Final Round",
        outcome: "completed",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.interview.interview_round, "Final Round");
    assert.equal(body.interview.outcome, "completed");
  } finally {
    await pool.query("DELETE FROM interviews WHERE id = $1", [interview.id]);
  }
});

test("PATCH /api/v1/interviews/:id rejects an empty body", async () => {
  const interview = await createTestInterview();

  try {
    const response = await request(`/api/v1/interviews/${interview.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
  } finally {
    await pool.query("DELETE FROM interviews WHERE id = $1", [interview.id]);
  }
});

test("DELETE /api/v1/interviews/:id deletes an owned interview", async () => {
  const interview = await createTestInterview();

  const response = await request(`/api/v1/interviews/${interview.id}`, {
    method: "DELETE",
  });

  assert.equal(response.status, 200);

  const result = await pool.query(
    "SELECT id FROM interviews WHERE id = $1",
    [interview.id]
  );

  assert.equal(result.rowCount, 0);
});

test("Another user cannot retrieve or delete an interview", async () => {
  const interview = await createTestInterview();
  const otherUserId = "999999999";

  try {
    const getResponse = await request(
      `/api/v1/interviews/${interview.id}`,
      {},
      otherUserId
    );
    assert.equal(getResponse.status, 404);

    const deleteResponse = await request(
      `/api/v1/interviews/${interview.id}`,
      { method: "DELETE" },
      otherUserId
    );
    assert.equal(deleteResponse.status, 404);

    const stillExists = await pool.query(
      "SELECT id FROM interviews WHERE id = $1",
      [interview.id]
    );
    assert.equal(stillExists.rowCount, 1);
  } finally {
    await pool.query("DELETE FROM interviews WHERE id = $1", [interview.id]);
  }
});
