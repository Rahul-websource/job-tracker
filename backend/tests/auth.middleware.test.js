require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../src/middleware/auth.middleware");

let server;
let baseUrl;

const app = express();

app.get("/protected", authenticateToken, (req, res) => {
  res.status(200).json({
    message: "Access granted",
    user: req.user,
  });
});

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
});

test("Rejects requests without an authorization token", async () => {
  const response = await fetch(`${baseUrl}/protected`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required",
  });
});

test("Rejects an invalid token", async () => {
  const response = await fetch(`${baseUrl}/protected`, {
    headers: {
      Authorization: "Bearer invalid-token",
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid or expired token",
  });
});

test("Rejects an expired token", async () => {
  const token = jwt.sign(
    { sub: "123" },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: -1,
    }
  );

  const response = await fetch(`${baseUrl}/protected`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid or expired token",
  });
});

test("Allows a valid token and identifies the authenticated user", async () => {
  const token = jwt.sign(
    { sub: "123" },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );

  const response = await fetch(`${baseUrl}/protected`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message, "Access granted");
  assert.deepEqual(body.user, {
    id: "123",
  });
});

