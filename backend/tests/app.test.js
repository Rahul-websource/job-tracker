require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../src/app");

function authHeaders(userId = "1") {
  const token = jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );

  return { Authorization: `Bearer ${token}` };
}



test("GET / returns the Job Tracker welcome message", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      message: "Welcome to Job Tracker API",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
test("GET /health returns a successful health check", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health`
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "job-tracker-api");
    assert.ok(body.timestamp);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
test("Unknown routes return 404", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/unknown`
    );

    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      error: "Route not found",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
test("Invalid JSON returns 400 Bad Request", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"name":',
      }
    );

    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
test("POST /api/v1/companies rejects a missing company name", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          website: "https://example.com",
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Company name is required",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});

test("POST /api/v1/companies rejects an empty company name", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: "   ",
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Company name is required",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});

test("POST /api/v1/companies rejects an invalid website URL", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: "Example Company",
          website: "not-a-valid-url",
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Website must be a valid HTTP or HTTPS URL",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});

test("POST /api/v1/companies rejects a website using an unsupported protocol", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: "Example Company",
          website: "ftp://example.com",
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: "Website must be a valid HTTP or HTTPS URL",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
