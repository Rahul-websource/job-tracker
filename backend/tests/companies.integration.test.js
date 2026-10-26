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

async function withServer(callback) {
  const server = app.listen(0);

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function createCompany(baseUrl, name, userId = "1") {
  const response = await fetch(`${baseUrl}/api/v1/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(userId),
    },
    body: JSON.stringify({
      name,
      website: "https://example.com",
      location: "Test Location",
      notes: "Created by an integration test",
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 201, JSON.stringify(body));

  return body.company;
}

async function createJob(baseUrl, companyId, title, userId = "1") {
  const response = await fetch(`${baseUrl}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(userId),
    },
    body: JSON.stringify({
      company_id: companyId,
      title,
      location: "Test Location",
      employment_type: "Full-time",
      job_url: "https://example.com/jobs/test",
    }),
  });

  const body = await response.json();

  assert.equal(response.status, 201, JSON.stringify(body));

  return body.job;
}

async function deleteCompanyDirectly(companyId, userId = "1") {
  await pool.query(
    "DELETE FROM companies WHERE id = $1 AND user_id = $2",
    [companyId, userId]
  );
}

test("GET /api/v1/companies returns companies from PostgreSQL", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/companies`, {
      headers: authHeaders(),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.companies));
    assert.equal(body.count, body.companies.length);

    for (const company of body.companies) {
      assert.equal(String(company.user_id), "1");
      assert.equal(typeof company.name, "string");
    }
  });
});

test("POST /api/v1/companies creates a company in PostgreSQL", async () => {
  const companyName = `Integration Test ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);

      companyId = company.id;

      assert.equal(company.name, companyName);
      assert.equal(company.website, "https://example.com");
      assert.equal(company.location, "Test Location");
      assert.equal(String(company.user_id), "1");
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("POST /api/v1/companies rejects a duplicate company", async () => {
  const companyName = `Duplicate Test ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);
      companyId = company.id;

      const response = await fetch(`${baseUrl}/api/v1/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ name: companyName }),
      });

      const body = await response.json();

      assert.equal(response.status, 409);
      assert.deepEqual(body, {
        error: "This company already exists for this user",
      });
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("GET /api/v1/companies only returns companies owned by the authenticated user", async () => {
  await withServer(async (baseUrl) => {
    const user1Response = await fetch(`${baseUrl}/api/v1/companies`, {
      headers: authHeaders("1"),
    });

    const user41Response = await fetch(`${baseUrl}/api/v1/companies`, {
      headers: authHeaders("41"),
    });

    const user1Body = await user1Response.json();
    const user41Body = await user41Response.json();

    assert.equal(user1Response.status, 200);
    assert.equal(user41Response.status, 200);

    assert.ok(Array.isArray(user1Body.companies));
    assert.ok(Array.isArray(user41Body.companies));

    for (const company of user1Body.companies) {
      assert.equal(String(company.user_id), "1");
    }

    for (const company of user41Body.companies) {
      assert.equal(String(company.user_id), "41");
    }

    assert.ok(
      user41Body.companies.some(
        (company) => company.name === "JWT Isolation Test Company"
      ),
      "User 41 should see their own test company"
    );

    assert.ok(
      !user41Body.companies.some(
        (company) =>
          company.name === "Google" || company.name === "Microsoft"
      ),
      "User 41 must not see User 1's existing companies"
    );
  });
});

test("GET /api/v1/companies/:id returns company details and associated jobs", async () => {
  const companyName = `Company Details ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);
      companyId = company.id;

      const job = await createJob(
        baseUrl,
        company.id,
        `Test Job ${randomUUID()}`
      );

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        { headers: authHeaders() }
      );

      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(String(body.company.id), String(company.id));
      assert.equal(body.company.name, companyName);
      assert.ok(Array.isArray(body.jobs));
      assert.equal(Number(body.jobCount), 1);
      assert.ok(
        body.jobs.some((item) => String(item.id) === String(job.id))
      );
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("GET /api/v1/companies/:id returns 404 for a missing company", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/companies/2147483647`,
      { headers: authHeaders() }
    );

    assert.equal(response.status, 404);
  });
});

test("GET /api/v1/companies/:id does not expose another user's company", async () => {
  const companyName = `Private Company ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName, "1");
      companyId = company.id;

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        { headers: authHeaders("41") }
      );

      assert.equal(response.status, 404);
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId, "1");
    }
  }
});

test("PATCH /api/v1/companies/:id updates company details", async () => {
  const companyName = `Company Update ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);
      companyId = company.id;

      const updatedName = `${companyName} Updated`;

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            name: updatedName,
            location: "Updated Location",
          }),
        }
      );

      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.company.name, updatedName);
      assert.equal(body.company.location, "Updated Location");
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("PATCH /api/v1/companies/:id rejects an empty request body", async () => {
  const companyName = `Empty Update ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);
      companyId = company.id;

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({}),
        }
      );

      assert.equal(response.status, 400);
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("PATCH /api/v1/companies/:id returns 404 for another user's company", async () => {
  const companyName = `Protected Update ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName, "1");
      companyId = company.id;

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders("41"),
          },
          body: JSON.stringify({ name: `${companyName} Changed` }),
        }
      );

      assert.equal(response.status, 404);
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId, "1");
    }
  }
});

test("DELETE /api/v1/companies/:id deletes a company without linked jobs", async () => {
  const companyName = `Company Delete ${randomUUID()}`;
  let companyId;

  await withServer(async (baseUrl) => {
    const company = await createCompany(baseUrl, companyName);
    companyId = company.id;

    const response = await fetch(
      `${baseUrl}/api/v1/companies/${company.id}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );

    assert.equal(response.status, 200);

    const lookup = await pool.query(
      "SELECT id FROM companies WHERE id = $1 AND user_id = $2",
      [company.id, 1]
    );

    assert.equal(lookup.rowCount, 0);
    companyId = null;
  });

  if (companyId) {
    await deleteCompanyDirectly(companyId);
  }
});

test("DELETE /api/v1/companies/:id blocks deletion when jobs are linked", async () => {
  const companyName = `Company With Jobs ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName);
      companyId = company.id;

      await createJob(
        baseUrl,
        company.id,
        `Linked Job ${randomUUID()}`
      );

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(Number(body.linkedJobs), 1);

      const lookup = await pool.query(
        "SELECT id FROM companies WHERE id = $1 AND user_id = $2",
        [company.id, 1]
      );

      assert.equal(lookup.rowCount, 1);
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId);
    }
  }
});

test("DELETE /api/v1/companies/:id returns 404 for another user's company", async () => {
  const companyName = `Protected Delete ${randomUUID()}`;
  let companyId;

  try {
    await withServer(async (baseUrl) => {
      const company = await createCompany(baseUrl, companyName, "1");
      companyId = company.id;

      const response = await fetch(
        `${baseUrl}/api/v1/companies/${company.id}`,
        {
          method: "DELETE",
          headers: authHeaders("41"),
        }
      );

      assert.equal(response.status, 404);
    });
  } finally {
    if (companyId) {
      await deleteCompanyDirectly(companyId, "1");
    }
  }
});
