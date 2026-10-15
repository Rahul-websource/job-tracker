require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

async function seedDevelopmentUser() {
  const name = process.env.SEED_USER_NAME;
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Missing SEED_USER_NAME, SEED_USER_EMAIL, or SEED_USER_PASSWORD in .env"
    );
  }

  const existingUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existingUser.rows.length > 0) {
    console.log(
      "Development user already exists. ID:",
      existingUser.rows[0].id
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,
    [name, email, passwordHash]
  );

  console.log("Development user created:", result.rows[0]);
}

seedDevelopmentUser()
  .catch((error) => {
    console.error("Failed to create development user:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
