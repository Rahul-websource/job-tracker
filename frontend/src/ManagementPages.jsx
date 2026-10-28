import { useCallback, useEffect, useState } from 'react'
import {
  getJobs,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  createJob,
  updateJob,
  deleteJob,
} from './services/api'

const emptyJob = {
  company_id: '',
  title: '',
  location: '',
  employment_type: '',
  description: '',
  job_url: '',
}

const emptyCompany = {
  name: '',
  website: '',
  location: '',
  notes: '',
}

export default function ManagementPages({ page, token }) {
  const [jobs, setJobs] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [jobModal, setJobModal] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [jobForm, setJobForm] = useState(emptyJob)

  const [companyModal, setCompanyModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [companyForm, setCompanyForm] = useState(emptyCompany)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const companyResult = await getCompanies(token)
      setCompanies(
        Array.isArray(companyResult.companies)
          ? companyResult.companies
          : [],
      )

      if (page === 'Jobs') {
        const jobResult = await getJobs(token, {
          search: search.trim(),
          location: locationFilter.trim(),
          employment_type: typeFilter,
          limit: 100,
        })

        setJobs(Array.isArray(jobResult.jobs) ? jobResult.jobs : [])
      }
    } catch (err) {
      setError(err.message || `Unable to load ${page.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }, [page, token, search, locationFilter, typeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openNewJob() {
    setEditingJob(null)
    setJobForm({
      ...emptyJob,
      company_id: companies[0]?.id ? String(companies[0].id) : '',
    })
    setError('')
    setNotice('')
    setJobModal(true)
  }

  function openEditJob(job) {
    setEditingJob(job)
    setJobForm({
      company_id: String(job.company_id || ''),
      title: job.title || '',
      location: job.location || '',
      employment_type: job.employment_type || '',
      description: job.description || '',
      job_url: job.job_url || '',
    })
    setError('')
    setNotice('')
    setJobModal(true)
  }

  async function saveJob(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const payload = {
        title: jobForm.title.trim(),
        location: jobForm.location.trim() || undefined,
        employment_type: jobForm.employment_type || undefined,
        description: jobForm.description.trim() || undefined,
        job_url: jobForm.job_url.trim() || undefined,
      }

      if (editingJob) {
        await updateJob(token, editingJob.id, payload)
        setNotice('Job updated successfully.')
      } else {
        if (!jobForm.company_id) {
          throw new Error('Please select a company.')
        }

        await createJob(token, {
          ...payload,
          company_id: jobForm.company_id,
        })
        setNotice('Job created successfully.')
      }

      setJobModal(false)
      await loadData()
    } catch (err) {
      setError(err.message || 'Unable to save the job.')
    } finally {
      setSaving(false)
    }
  }

  async function removeJob(job) {
    const confirmed = window.confirm(
      `Delete "${job.title}" at "${job.company_name || 'this company'}"?`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await deleteJob(token, job.id)
      setNotice('Job deleted successfully.')
      await loadData()
    } catch (err) {
      setError(err.message || 'Unable to delete the job.')
    }
  }

  function openNewCompany() {
    setEditingCompany(null)
    setCompanyForm({ ...emptyCompany })
    setError('')
    setNotice('')
    setCompanyModal(true)
  }

  function openEditCompany(company) {
    setEditingCompany(company)
    setCompanyForm({
      name: company.name || '',
      website: company.website || '',
      location: company.location || '',
      notes: company.notes || '',
    })
    setError('')
    setNotice('')
    setCompanyModal(true)
  }

  async function removeCompany(company) {
    const confirmed = window.confirm(
      `Delete "${company.name}"? This action cannot be undone.`,
    )
    if (!confirmed) return

    setError('')
    setNotice('')
    setSaving(true)

    try {
      await deleteCompany(token, company.id)
      setNotice(`"${company.name}" deleted successfully.`)
      await loadData()
    } catch (err) {
      setError(
        err.message ||
        'Unable to delete the company. It may have linked jobs.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveCompany(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      name: companyForm.name.trim(),
      website: companyForm.website.trim() || undefined,
      location: companyForm.location.trim() || undefined,
      notes: companyForm.notes.trim() || undefined,
    }

    try {
      if (editingCompany) {
        await updateCompany(token, editingCompany.id, payload)
        setNotice(`"${payload.name}" updated successfully.`)
      } else {
        await createCompany(token, payload)
        setNotice('Company added successfully.')
      }

      setCompanyForm({ ...emptyCompany })
      setEditingCompany(null)
      setCompanyModal(false)
      await loadData()
    } catch (err) {
      setError(err.message || 'Unable to save the company.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-content management-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR CAREER, ORGANIZED</div>
          <h1>{page}</h1>
          <p className="page-subtitle">
            {page === 'Jobs'
              ? 'Discover and manage the opportunities you are tracking.'
              : 'Keep your target companies organized in one place.'}
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setError('')
            setNotice('')
            if (page === 'Jobs') {
              openNewJob()
            } else {
              openNewCompany()
            }
          }}
        >
          <span>＋</span> {page === 'Jobs' ? 'Add job' : 'Add company'}
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="management-notice" role="status">{notice}</p>}

      {page === 'Jobs' && (
        <>
          <div className="table-tools management-filters">
            <label className="search-box">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search job title or company..."
                aria-label="Search jobs"
              />
            </label>

            <input
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              placeholder="Filter by location"
              aria-label="Filter jobs by location"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by employment type"
            >
              <option value="">All employment types</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
              <option value="remote">Remote</option>
            </select>
          </div>

          <section className="applications-panel">
            <div className="panel-heading">
              <div>
                <h2>Tracked jobs</h2>
                <p>{jobs.length} job{jobs.length === 1 ? '' : 's'} found</p>
              </div>
            </div>

            {loading ? (
              <p className="empty-state">Loading jobs...</p>
            ) : jobs.length === 0 ? (
              <p className="empty-state">
                No jobs found. Try changing your filters or add a job.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>JOB TITLE</th>
                      <th>COMPANY</th>
                      <th>LOCATION</th>
                      <th>EMPLOYMENT TYPE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <strong>{job.title}</strong>
                          {job.job_url && (
                            <div>
                              <a href={job.job_url} target="_blank" rel="noreferrer">
                                View posting ↗
                              </a>
                            </div>
                          )}
                        </td>
                        <td>{job.company_name || 'Unknown company'}</td>
                        <td>{job.location || 'Not specified'}</td>
                        <td>{job.employment_type || 'Not specified'}</td>
                        <td>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => openEditJob(job)}
                          >
                            Edit
                          </button>
                          {' · '}
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => removeJob(job)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {page === 'Companies' && (
        <section className="applications-panel">
          <div className="panel-heading">
            <div>
              <h2>Your companies</h2>
              <p>{companies.length} compan{companies.length === 1 ? 'y' : 'ies'}</p>
            </div>
          </div>

          {loading ? (
            <p className="empty-state">Loading companies...</p>
          ) : companies.length === 0 ? (
            <p className="empty-state">
              No companies added yet. Add your first company to get started.
            </p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COMPANY</th>
                    <th>LOCATION</th>
                    <th>WEBSITE</th>
                    <th>NOTES</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td><strong>{company.name}</strong></td>
                      <td>{company.location || 'Not specified'}</td>
                      <td>
                        {company.website ? (
                          <a href={company.website} target="_blank" rel="noreferrer">
                            Visit website ↗
                          </a>
                        ) : '—'}
                      </td>
                      <td>{company.notes || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openEditCompany(company)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => removeCompany(company)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <footer className="page-footer">
        <span>JobTrack <span className="footer-dot">·</span> Stay focused on your next move.</span>
        <span>Built for your career journey</span>
      </footer>

      {jobModal && (
        <div className="modal-backdrop" onClick={() => setJobModal(false)}>
          <section
            className="application-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">JOB MANAGEMENT</span>
                <h2 id="job-modal-title">{editingJob ? 'Edit job' : 'Add job'}</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setJobModal(false)}
                aria-label="Close"
              >×</button>
            </div>

            <form onSubmit={saveJob}>
              {!editingJob && (
                <label>Company *
                  <select
                    required
                    value={jobForm.company_id}
                    onChange={(event) => setJobForm({ ...jobForm, company_id: event.target.value })}
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label>Job title *
                <input
                  required
                  value={jobForm.title}
                  onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
                  placeholder="e.g. Software Engineer Intern"
                />
              </label>

              <label>Location
                <input
                  value={jobForm.location}
                  onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })}
                  placeholder="e.g. Noida / Remote"
                />
              </label>

              <label>Employment type
                <select
                  value={jobForm.employment_type}
                  onChange={(event) => setJobForm({ ...jobForm, employment_type: event.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                  <option value="remote">Remote</option>
                </select>
              </label>

              <label>Job posting URL
                <input
                  type="url"
                  value={jobForm.job_url}
                  onChange={(event) => setJobForm({ ...jobForm, job_url: event.target.value })}
                  placeholder="https://..."
                />
              </label>

              <label>Description
                <textarea
                  rows="3"
                  value={jobForm.description}
                  onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })}
                  placeholder="Job details (optional)"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setJobModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving...' : editingJob ? 'Save changes' : 'Add job'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {companyModal && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setCompanyModal(false)
              setEditingCompany(null)
            }
          }}
        >
          <section
            className="application-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">COMPANY MANAGEMENT</span>
                <h2 id="company-modal-title">
                  {editingCompany ? 'Edit company' : 'Add company'}
                </h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setCompanyModal(false)
                  setEditingCompany(null)
                }}
                aria-label="Close"
              >×</button>
            </div>

            <form onSubmit={saveCompany}>
              <label>Company name *
                <input
                  required
                  value={companyForm.name}
                  onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })}
                  placeholder="e.g. Google"
                />
              </label>

              <label>Website
                <input
                  type="url"
                  value={companyForm.website}
                  onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })}
                  placeholder="https://..."
                />
              </label>

              <label>Location
                <input
                  value={companyForm.location}
                  onChange={(event) => setCompanyForm({ ...companyForm, location: event.target.value })}
                  placeholder="e.g. Noida"
                />
              </label>

              <label>Notes
                <textarea
                  rows="3"
                  value={companyForm.notes}
                  onChange={(event) => setCompanyForm({ ...companyForm, notes: event.target.value })}
                  placeholder="Optional notes"
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setCompanyModal(false)
                    setEditingCompany(null)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : editingCompany
                      ? 'Save changes'
                      : 'Add company'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
