import { useEffect, useState } from 'react'
import Auth from './Auth'
import {
  getApplications,
  getCompanies,
  createCompany,
  createJob,
  createApplication,
  updateApplication,
  getApplicationHistory,
} from './services/api'
import './App.css'

const navigation = [
  { label: 'Dashboard', icon: '▦' },
  { label: 'Applications', icon: '▤' },
  { label: 'Jobs', icon: '⌕' },
  { label: 'Companies', icon: '▥' },
]

function App() {
  const [session, setSession] = useState(() => {
  try {
    const savedSession = sessionStorage.getItem('job-tracker-session')

    if (!savedSession) {
      return null
    }

    const parsedSession = JSON.parse(savedSession)

    if (
      typeof parsedSession?.token !== 'string' ||
      !parsedSession.token ||
      !parsedSession.user ||
      typeof parsedSession.user !== 'object'
    ) {
      sessionStorage.removeItem('job-tracker-session')
      return null
    }

    return parsedSession
  } catch {
    sessionStorage.removeItem('job-tracker-session')
    return null
  }
})
  function handleLogin(authData) {
  sessionStorage.setItem(
    'job-tracker-session',
    JSON.stringify(authData)
  )

  setSession(authData)
}

  function handleLogout() {
  sessionStorage.removeItem('job-tracker-session')
  setSession(null)
}

  const [activePage, setActivePage] = useState('Dashboard')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [applications, setApplications] = useState([])
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [applicationsError, setApplicationsError] = useState('')
  const [savingApplication, setSavingApplication] = useState(false)
  const [formError, setFormError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [historyApplication, setHistoryApplication] = useState(null)
const [applicationHistory, setApplicationHistory] = useState([])
const [loadingHistory, setLoadingHistory] = useState(false)
const [historyError, setHistoryError] = useState('')
const [newApplication, setNewApplication] = useState({
    company: '',
    role: '',
    location: '',
    status: 'Applied',
  })

  useEffect(() => {
    if (!session?.token) return

    let cancelled = false

    async function loadApplications() {
      setLoadingApplications(true)
      setApplicationsError('')

      try {
        const result = await getApplications(session.token)

        if (cancelled) return

        const rows = Array.isArray(result.applications)
          ? result.applications
          : []

        const mappedApplications = rows.map((item) => ({
          id: item.id,
          company: item.company_name || 'Unknown company',
          role: item.job_title || 'Untitled role',
          location: item.job_location || 'Not specified',
          date: item.applied_at
            ? new Date(item.applied_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })
            : 'Not specified',
          status: ({
            applied: 'Applied',
            assessment: 'Assessment',
            interview: 'Interview',
            offer: 'Offer',
            rejected: 'Rejected',
            withdrawn: 'Withdrawn',
          })[String(item.status).toLowerCase()] || item.status,
        }))

        setApplications(mappedApplications)
      } catch (error) {
        if (!cancelled) {
          setApplicationsError(error.message || 'Unable to load applications.')
        }
      } finally {
        if (!cancelled) {
          setLoadingApplications(false)
        }
      }
    }

    loadApplications()

    return () => {
      cancelled = true
    }
  }, [session?.token])

  if (!session?.token || !session?.user) {
    return <Auth onLogin={handleLogin} />
  }

  const filteredApplications = applications.filter((application) => {
    const matchesSearch = `${application.company} ${application.role} ${application.location}`
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'All statuses' || application.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = [
    { label: 'Total applications', value: applications.length, icon: '▤', note: 'All tracked applications', color: 'blue' },
    { label: 'Interviews', value: applications.filter((a) => a.status === 'Interview').length, icon: '◷', note: 'Keep preparing', color: 'purple' },
    { label: 'Offers received', value: applications.filter((a) => a.status === 'Offer').length, icon: '✦', note: 'Great progress', color: 'green' },
    { label: 'In review', value: applications.filter((a) => a.status === 'In Review').length, icon: '◉', note: 'Waiting for updates', color: 'orange' },
  ]
  async function openApplicationHistory(application) {
  setHistoryApplication(application)
  setApplicationHistory([])
  setHistoryError('')
  setLoadingHistory(true)

  try {
    const result = await getApplicationHistory(
      session.token,
      application.id
    )

    setApplicationHistory(
      Array.isArray(result.history) ? result.history : []
    )
  } catch (error) {
    setHistoryError(
      error.message || 'Unable to load application history.'
    )
  } finally {
    setLoadingHistory(false)
  }
}
async function updateStatus(applicationId, newStatus) {
    const statusMap = {
      Applied: 'applied',
      'In Review': 'assessment',
      Assessment: 'assessment',
      Interview: 'interview',
      Offer: 'offer',
      Rejected: 'rejected',
      Withdrawn: 'withdrawn',
    }

    const application = applications.find(
      (item) => item.id === applicationId
    )

    if (!application) return

    const previousStatus = application.status

    // Update the UI immediately.
    setApplications((current) =>
      current.map((item) =>
        item.id === applicationId
          ? { ...item, status: newStatus }
          : item
      )
    )

    try {
      await updateApplication(session.token, applicationId, {
        status: statusMap[newStatus],
      })
    } catch (error) {
      // Restore the previous status if the API request fails.
      setApplications((current) =>
        current.map((item) =>
          item.id === applicationId
            ? { ...item, status: previousStatus }
            : item
        )
      )

      setApplicationsError(
        error.message || 'Unable to update application status.'
      )
    }
  }
  async function addApplication(event) {
    event.preventDefault()

    const companyName = newApplication.company.trim()
    const jobTitle = newApplication.role.trim()

    if (!companyName || !jobTitle) {
      setFormError('Company name and job title are required.')
      return
    }

    setSavingApplication(true)
    setFormError('')

    try {
      const companiesResult = await getCompanies(session.token)
      const companies = Array.isArray(companiesResult.companies)
        ? companiesResult.companies
        : []

      let company = companies.find(
        (item) => item.name.trim().toLowerCase() === companyName.toLowerCase()
      )

      if (!company) {
        const companyResult = await createCompany(session.token, {
          name: companyName,
          location: newApplication.location.trim() || undefined,
        })
        company = companyResult.company
      }

      const jobResult = await createJob(session.token, {
        company_id: company.id,
        title: jobTitle,
        location: newApplication.location.trim() || undefined,
      })

      const statusMap = {
        Applied: 'applied',
        'In Review': 'assessment',
        Interview: 'interview',
        Offer: 'offer',
        Rejected: 'rejected',
      }

      await createApplication(session.token, {
        job_id: jobResult.job.id,
        status: statusMap[newApplication.status] || 'applied',
      })

      const applicationsResult = await getApplications(session.token)
      const rows = Array.isArray(applicationsResult.applications)
        ? applicationsResult.applications
        : []

      setApplications(rows.map((item) => ({
        id: item.id,
        company: item.company_name || 'Unknown company',
        role: item.job_title || 'Untitled role',
        location: item.job_location || 'Not specified',
        date: item.applied_at
          ? new Date(item.applied_at).toLocaleDateString('en-IN', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : 'Not specified',
        status: ({
          applied: 'Applied',
          assessment: 'In Review',
          interview: 'Interview',
          offer: 'Offer',
          rejected: 'Rejected',
          withdrawn: 'Withdrawn',
        })[String(item.status).toLowerCase()] || item.status,
      })))

      setNewApplication({
        company: '',
        role: '',
        location: '',
        status: 'Applied',
      })
      setShowForm(false)
    } catch (error) {
      setFormError(error.message || 'Unable to save the application.')
    } finally {
      setSavingApplication(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={() => setActivePage('Dashboard')}>
          <span className="brand-mark">J</span>
          <span>Job<span className="brand-light">Track</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activePage === item.label ? 'active' : ''}`}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Applications' && (
                <span className="nav-count">{applications.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Stay organized</strong>
            <p>Small steps today bring you closer to your next opportunity.</p>
          </div>
          <div className="profile">
            <div className="avatar">
              {(session.user.name || session.user.email || 'U')
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{session.user.name || 'Job Seeker'}</strong>
              <span>{session.user.email}</span>
            </div>
            <button
              type="button"
              className="profile-menu"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {activePage}</div>
          <div className="topbar-right">
            <span className="today-label">Your career workspace</span>
            <div className="top-avatar" title={session.user.email}>
              {(session.user.name || session.user.email || 'U')
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">YOUR CAREER, ORGANIZED</div>
              <h1>{activePage === 'Dashboard' ? 'Good morning!' : activePage}</h1>
              <p className="page-subtitle">
                {activePage === 'Dashboard'
                  ? 'Here is what is happening with your job search.'
                  : `Manage and track your ${activePage.toLowerCase()} in one place.`}
              </p>
            </div>
            <button className="primary-button" onClick={() => setShowForm(true)}>
              <span>＋</span> Add application
            </button>
          </div>

          {activePage === 'Dashboard' && (
            <div className="highlight-banner">
              <div className="banner-symbol">✦</div>
              <div className="banner-copy">
                <strong>Your next opportunity starts here</strong>
                <span>Keep your applications updated and your preparation consistent.</span>
              </div>
              <button onClick={() => setActivePage('Applications')}>View applications <span>→</span></button>
              <div className="banner-decoration">✳</div>
            </div>
          )}

          <div className="section-heading">
            <div>
              <h2>Application overview</h2>
              <p>Your job search at a glance</p>
            </div>
            <span className="live-label"><span /> Updated locally</span>
          </div>

          <div className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className="stat-top">
                  <span>{stat.label}</span>
                  <span className={`stat-icon ${stat.color}`}>{stat.icon}</span>
                </div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-note">{stat.note}</div>
              </article>
            ))}
          </div>

          <section className="applications-panel">
            <div className="panel-heading">
              <div>
                <h2>{activePage === 'Dashboard' ? 'Recent applications' : activePage}</h2>
                <p>Keep track of every opportunity</p>
              </div>
              <button className="text-button" onClick={() => setActivePage('Applications')}>
                View all <span>→</span>
              </button>
            </div>

            <div className="table-tools">
              <label className="search-box">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search company, role or location..."
                  aria-label="Search applications"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option>All statuses</option>
                <option>Applied</option>
                <option>In Review</option>
                <option>Interview</option>
                <option>Offer</option>
                <option>Rejected</option>
              </select>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COMPANY & ROLE</th>
<th>LOCATION</th>
<th>DATE ADDED</th>
<th>STATUS</th>
<th>HISTORY</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingApplications ? (
                    <tr>
                      <td colSpan="5" className="empty-state">
                        Loading your applications...
                      </td>
                    </tr>
                  ) : applicationsError ? (
                    <tr>
                      <td colSpan="5" className="empty-state" role="alert">
                        Unable to load applications: {applicationsError}
                      </td>
                    </tr>
                  ) : (
                    <>
                  {filteredApplications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <div className="company-cell">
                          <div className={`company-logo logo-${application.company.toLowerCase().replace(/[^a-z]/g, '')[0]}`}>
                            {application.company[0]}
                          </div>
                          <div>
                            <strong>{application.company}</strong>
                            <span>{application.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="location-cell"><span>⌖</span> {application.location}</td>
                      <td className="date-cell">{application.date}</td>

                      <td>
                        <select
                          className={`status-badge status-${application.status.toLowerCase().replace(' ', '-')}`}
                          value={application.status}
                          onChange={(event) =>
                            updateStatus(application.id, event.target.value)
                          }
                          aria-label={`Update status for ${application.company} - ${application.role}`}
                        >
                          <option value="Applied">Applied</option>
                          <option value="In Review">In Review</option>
                          <option value="Assessment">Assessment</option>
                          <option value="Interview">Interview</option>
                          <option value="Offer">Offer</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Withdrawn">Withdrawn</option>
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => openApplicationHistory(application)}
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredApplications.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-state">
                        {applications.length === 0
                          ? 'You have no applications yet.'
                          : 'No applications match your search or status filter.'}
                      </td>
                    </tr>
                  )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>Showing <strong>{filteredApplications.length}</strong> of <strong>{applications.length}</strong> applications</span>
              <span>Synced from your account</span>
            </div>
          </section>

          <footer className="page-footer">
            <span>JobTrack <span className="footer-dot">·</span> Stay focused on your next move.</span>
            <span>Built for your career journey</span>
          </footer>
        </section>
      </main>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section
            className="application-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEW OPPORTUNITY</span>
                <h2 id="modal-title">Add application</h2>
              </div>
              <button className="close-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={addApplication}>
              {formError && (
                <p className="form-error" role="alert">{formError}</p>
              )}
              <label>Company name *
                <input required value={newApplication.company} onChange={(e) => setNewApplication({ ...newApplication, company: e.target.value })} placeholder="e.g. Google" />
              </label>
              <label>Job title *
                <input required value={newApplication.role} onChange={(e) => setNewApplication({ ...newApplication, role: e.target.value })} placeholder="e.g. Software Engineer" />
              </label>
              <label>Location
                <input value={newApplication.location} onChange={(e) => setNewApplication({ ...newApplication, location: e.target.value })} placeholder="e.g. Noida / Remote" />
              </label>
              <label>Status
                <select value={newApplication.status} onChange={(e) => setNewApplication({ ...newApplication, status: e.target.value })}>
                  <option>Applied</option>
                  <option>In Review</option>
                  <option>Interview</option>
                  <option>Offer</option>
                  <option>Rejected</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={savingApplication}>{savingApplication ? "Saving..." : "Add application"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {historyApplication && (
        <div
          className="modal-backdrop"
          onClick={() => setHistoryApplication(null)}
        >
          <section
            className="application-modal history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">APPLICATION ACTIVITY</span>
                <h2 id="history-modal-title">Status history</h2>
                <p>
                  {historyApplication.company} · {historyApplication.role}
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setHistoryApplication(null)}
                aria-label="Close history"
              >
                ×
              </button>
            </div>

            {loadingHistory ? (
              <p>Loading status history...</p>
            ) : historyError ? (
              <p className="form-error" role="alert">{historyError}</p>
            ) : applicationHistory.length === 0 ? (
              <p className="empty-state">
                No status changes recorded yet. Your future status changes will appear here.
              </p>
            ) : (
              <div className="history-list">
                {applicationHistory.map((entry) => (
                  <article className="history-entry" key={entry.id}>
                    <p>
                      <strong>
                        {String(entry.old_status || 'Unknown')
                          .replace(/^./, (letter) => letter.toUpperCase())}
                      </strong>
                      {' → '}
                      <strong>
                        {String(entry.new_status || 'Unknown')
                          .replace(/^./, (letter) => letter.toUpperCase())}
                      </strong>
                    </p>
                    <time>
                      {entry.changed_at
                        ? new Date(entry.changed_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Date unavailable'}
                    </time>
                    {entry.notes && <p>{entry.notes}</p>}
                  </article>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHistoryApplication(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
