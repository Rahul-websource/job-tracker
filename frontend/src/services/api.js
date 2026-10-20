const API_BASE_URL = '/api/v1';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Something went wrong');
  }

  return data;
}

export async function loginUser(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(name, email, password) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getCompanies(token) {
  return apiRequest('/companies', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getJobs(token) {
  return apiRequest('/jobs', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getApplications(token) {
  return apiRequest('/applications', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createCompany(token, companyData) {
  return apiRequest('/companies', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(companyData),
  });
}

export async function createJob(token, jobData) {
  return apiRequest('/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(jobData),
  });
}

export async function createApplication(token, applicationData) {
  return apiRequest('/applications', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(applicationData),
  });
}
