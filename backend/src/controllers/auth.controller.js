const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// POST /api/v1/auth/register
async function register(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "A valid JSON object is required",
    });
  }

  const { name, email, password } = body;

  // Validate name.
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "Name is required",
    });
  }

  if (name.trim().length > 100) {
    return res.status(400).json({
      error: "Name must not exceed 100 characters",
    });
  }

  // Validate email.
  if (
    typeof email !== "string" ||
    email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: "A valid email is required",
    });
  }

  // Validate password.
  if (typeof password !== "string" || password.length < 12) {
    return res.status(400).json({
      error: "Password must be at least 12 characters long",
    });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      error: "Password must not exceed 72 bytes",
    });
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at, updated_at`,
      [normalizedName, normalizedEmail, passwordHash]
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505" && error.constraint === "users_email_key") {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    return next(error);
  }
}

// POST /api/v1/auth/login
async function login(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "A valid JSON object is required",
    });
  }

  const { email, password } = body;

  if (
    typeof email !== "string" ||
    !email.trim() ||
    email.trim().length > 255
  ) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  if (typeof password !== "string" || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    // Use the same response for an unknown email and a wrong password.
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        algorithm: "HS256",
      }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
};
