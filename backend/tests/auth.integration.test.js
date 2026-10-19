require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const pool = require("../src/config/db");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
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

  await pool.end();
});

async function registerUser(user) {
  return fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });
}

test("Registration creates a user without exposing password data", async () => {
  const email = `auth-${randomUUID()}@example.com`;
  const password = "StrongPassword!123";

  try {
    const response = await registerUser({
      name: "Test User",
      email,
      password,
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "User registered successfully");
    assert.equal(body.user.name, "Test User");
    assert.equal(body.user.email, email);

    assert.ok(body.user.id);
    assert.ok(body.user.created_at);
    assert.ok(body.user.updated_at);

    assert.equal("password" in body.user, false);
    assert.equal("password_hash" in body.user, false);

    const result = await pool.query(
      `SELECT password_hash
       FROM users
       WHERE email = $1`,
      [email]
    );

    assert.equal(result.rowCount, 1);
    assert.notEqual(result.rows[0].password_hash, password);

    assert.equal(
      await bcrypt.compare(password, result.rows[0].password_hash),
      true
    );
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
  }
});

test("Registration normalizes email addresses", async () => {
  const email = `auth-${randomUUID()}@example.com`;

  try {
    const response = await registerUser({
      name: "Normalized User",
      email: `  ${email.toUpperCase()}  `,
      password: "StrongPassword!123",
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.user.email, email);
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
  }
});

test("Registration rejects an email that already exists", async () => {
  const email = `auth-${randomUUID()}@example.com`;
  const user = {
    name: "Duplicate Test",
    email,
    password: "StrongPassword!123",
  };

  try {
    const firstResponse = await registerUser(user);

    assert.equal(firstResponse.status, 201);

    const secondResponse = await registerUser(user);
    const body = await secondResponse.json();

    assert.equal(secondResponse.status, 409);
    assert.deepEqual(body, {
      error: "An account with this email already exists",
    });
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
  }
});

test("Registration rejects a missing name", async () => {
  const response = await registerUser({
    email: `auth-${randomUUID()}@example.com`,
    password: "StrongPassword!123",
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: "Name is required",
  });
});

test("Registration rejects an invalid email", async () => {
  const response = await registerUser({
    name: "Test User",
    email: "not-an-email",
    password: "StrongPassword!123",
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: "A valid email is required",
  });
});

test("Registration rejects a password shorter than 12 characters", async () => {
  const response = await registerUser({
    name: "Test User",
    email: `auth-${randomUUID()}@example.com`,
    password: "Short123!",
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: "Password must be at least 12 characters long",
  });
});

test("Registration rejects a password exceeding bcrypt's 72-byte limit", async () => {
  const response = await registerUser({
    name: "Test User",
    email: `auth-${randomUUID()}@example.com`,
    password: "a".repeat(73),
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: "Password must not exceed 72 bytes",
  });
});
test("Login returns a JWT for valid credentials", async () => {
  const email = `login-${randomUUID()}@example.com`;
  const password = "StrongPassword!123";

  try {
    const registration = await registerUser({
      name: "Login Test User",
      email,
      password,
    });

    assert.equal(registration.status, 201);

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.toUpperCase(),
        password,
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Login successful");
    assert.equal(body.tokenType, "Bearer");
    assert.ok(body.token);
    assert.equal(body.user.email, email);

    assert.equal("password" in body.user, false);
    assert.equal("password_hash" in body.user, false);

    const jwt = require("jsonwebtoken");

    const decoded = jwt.verify(body.token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    assert.equal(String(decoded.sub), String(body.user.id));
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
  }
});

test("Login rejects an incorrect password", async () => {
  const email = `login-${randomUUID()}@example.com`;

  try {
    const registration = await registerUser({
      name: "Login Test User",
      email,
      password: "StrongPassword!123",
    });

    assert.equal(registration.status, 201);

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: "WrongPassword!123",
      }),
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Invalid email or password",
    });
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
  }
});

test("Login rejects an email that does not exist", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `unknown-${randomUUID()}@example.com`,
      password: "StrongPassword!123",
    }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid email or password",
  });
});

test("Login rejects a missing password", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `login-${randomUUID()}@example.com`,
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Email and password are required",
  });
});
