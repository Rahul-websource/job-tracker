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

export async function getJobs(token, filters = {}) {
  const params = new URLSearchParams()

  if (filters.search) {
    params.set('search', filters.search)
  }

  if (filters.location) {
    params.set('location', filters.location)
  }

  if (filters.employment_type) {
    params.set('employment_type', filters.employment_type)
  }

  if (filters.page) {
    params.set('page', String(filters.page))
  }

  if (filters.limit) {
    params.set('limit', String(filters.limit))
  }

  const query = params.toString()

  return apiRequest(`/jobs${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
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
export async function updateApplication(token, applicationId, updates) {
  return apiRequest(`/applications/${applicationId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })
}

export async function getApplicationHistory(token, applicationId) {
  return apiRequest(`/applications/${applicationId}/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function updateJob(token, jobId, updates) {
  return apiRequest(`/jobs/${jobId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })
}
export async function deleteJob(token, jobId) {
  return apiRequest(`/jobs/${jobId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function updateCompany(token, companyId, updates) {
  return apiRequest(`/companies/${companyId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })
}

export async function deleteCompany(token, companyId) {
  return apiRequest(`/companies/${companyId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Interview management
export async function getInterviews(token) {
  return apiRequest('/interviews', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function createInterview(token, interviewData) {
  return apiRequest('/interviews', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(interviewData),
  })
}

export async function updateInterview(token, interviewId, updates) {
  return apiRequest(`/interviews/${interviewId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })
}

export async function deleteInterview(token, interviewId) {
  return apiRequest(`/interviews/${interviewId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
