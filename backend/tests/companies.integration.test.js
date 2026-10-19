const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");

require("dotenv").config();

const app = require("../src/app");
const pool = require("../src/config/db");

function authHeaders(userId = "1") {
  const token = jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" }
  );

  return { Authorization: `Bearer ${token}` };
}



test("GET /api/v1/companies returns companies from PostgreSQL", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/companies`,
      { headers: authHeaders() }
    );

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.companies));
    assert.equal(body.count, body.companies.length);

    for (const company of body.companies) {
      assert.equal(company.user_id, "1");
      assert.equal(typeof company.name, "string");
    }
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

test("POST /api/v1/companies creates a company in PostgreSQL", async () => {
  const server = app.listen(0);
  const companyName = `Integration Test ${randomUUID()}`;

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
          name: companyName,
          website: "https://example.com",
          location: "Test Location",
          notes: "Created by an automated integration test",
        }),
      }
    );

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.company.name, companyName);
    assert.equal(body.company.website, "https://example.com");
    assert.equal(body.company.location, "Test Location");
    assert.equal(body.company.user_id, "1");
  } finally {
    try {
      await pool.query(
        "DELETE FROM companies WHERE user_id = $1 AND name = $2",
        [1, companyName]
      );
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
  }
});

test("POST /api/v1/companies rejects a duplicate company", async () => {
  const server = app.listen(0);
  const companyName = `Duplicate Test ${randomUUID()}`;

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/v1/companies`;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
          ...authHeaders(),
      },
      body: JSON.stringify({
        name: companyName,
      }),
    };

    const firstResponse = await fetch(url, options);

    assert.equal(firstResponse.status, 201);

    const secondResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
          ...authHeaders(),
      },
      body: JSON.stringify({
        name: companyName,
      }),
    });

    const secondBody = await secondResponse.json();

    assert.equal(secondResponse.status, 409);
    assert.deepEqual(secondBody, {
      error: "This company already exists for this user",
    });
  } finally {
    try {
      await pool.query(
        "DELETE FROM companies WHERE user_id = $1 AND name = $2",
        [1, companyName]
      );
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
  }
});

test("GET /api/v1/companies only returns companies owned by the authenticated user", async () => {
  const server = app.listen(0);

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/v1/companies`;

    const user1Response = await fetch(url, {
      headers: authHeaders("1"),
    });

    const user41Response = await fetch(url, {
      headers: authHeaders("41"),
    });

    const user1Body = await user1Response.json();
    const user41Body = await user41Response.json();

    assert.equal(user1Response.status, 200);
    assert.equal(user41Response.status, 200);

    assert.ok(Array.isArray(user1Body.companies));
    assert.ok(Array.isArray(user41Body.companies));

    for (const company of user1Body.companies) {
      assert.equal(company.user_id, "1");
    }

    for (const company of user41Body.companies) {
      assert.equal(company.user_id, "41");
    }

    assert.ok(
      user41Body.companies.some(
        (company) => company.name === "JWT Isolation Test Company"
      ),
      "User 41 should see their own test company"
    );

    assert.ok(
      !user41Body.companies.some(
        (company) => company.name === "Google" ||
          company.name === "Microsoft"
      ),
      "User 41 must not see User 1's existing companies"
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
