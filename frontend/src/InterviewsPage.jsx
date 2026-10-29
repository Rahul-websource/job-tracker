import { useCallback, useEffect, useState } from 'react'
import {
  getInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
} from './services/api'

const emptyForm = {
  application_id: '',
  interview_round: '',
  scheduled_at: '',
  interview_type: 'Technical',
  meeting_url: '',
  notes: '',
  outcome: 'scheduled',
}

const outcomes = [
  'scheduled',
  'completed',
  'passed',
  'failed',
  'cancelled',
]

function toDateTimeLocal(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )

  return localDate.toISOString().slice(0, 16)
}

function formatDate(value) {
  if (!value) return 'Not scheduled'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function applicationLabel(application) {
  return `${application.role || 'Untitled role'} — ${application.company || 'Unknown company'}`
}

export default function InterviewsPage({ token, applications = [] }) {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInterview, setEditingInterview] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('all')

  const loadInterviews = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getInterviews(token)
      setInterviews(
        Array.isArray(result.interviews) ? result.interviews : [],
      )
    } catch (err) {
      setError(err.message || 'Unable to load interviews.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadInterviews()
  }, [loadInterviews])

  function openCreateForm() {
    setEditingInterview(null)
    setForm({
      ...emptyForm,
      application_id: applications[0]?.id
        ? String(applications[0].id)
        : '',
    })
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  function openEditForm(interview) {
    setEditingInterview(interview)
    setForm({
      application_id: String(interview.application_id || ''),
      interview_round: interview.interview_round || '',
      scheduled_at: toDateTimeLocal(interview.scheduled_at),
      interview_type: interview.interview_type || '',
      meeting_url: interview.meeting_url || '',
      notes: interview.notes || '',
      outcome: interview.outcome || 'scheduled',
    })
    setError('')
    setNotice('')
    setModalOpen(true)
  }

  async function saveInterview(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (!form.application_id) {
        throw new Error('Please select an application.')
      }

      const payload = {
        application_id: Number(form.application_id),
        interview_round: form.interview_round.trim(),
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        interview_type: form.interview_type.trim() || null,
        meeting_url: form.meeting_url.trim() || null,
        notes: form.notes.trim() || null,
        outcome: form.outcome,
      }

      if (editingInterview) {
        await updateInterview(token, editingInterview.id, payload)
        setNotice('Interview updated successfully.')
      } else {
        await createInterview(token, payload)
        setNotice('Interview scheduled successfully.')
      }

      setModalOpen(false)
      await loadInterviews()
    } catch (err) {
      setError(err.message || 'Unable to save the interview.')
    } finally {
      setSaving(false)
    }
  }

  async function removeInterview(interview) {
    const confirmed = window.confirm(
      `Delete the "${interview.interview_round}" interview?`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await deleteInterview(token, interview.id)
      setNotice('Interview deleted successfully.')
      await loadInterviews()
    } catch (err) {
      setError(err.message || 'Unable to delete the interview.')
    }
  }

  const visibleInterviews = interviews.filter((interview) => {
    const query = search.trim().toLowerCase()
    const application = applications.find(
      (item) => String(item.id) === String(interview.application_id),
    )

    const searchableText = [
      interview.interview_round,
      interview.interview_type,
      interview.outcome,
      interview.notes,
      application?.company,
      application?.role,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return (
      (!query || searchableText.includes(query)) &&
      (outcomeFilter === 'all' || interview.outcome === outcomeFilter)
    )
  })

  const upcomingCount = interviews.filter(
    (interview) =>
      interview.outcome === 'scheduled' &&
      new Date(interview.scheduled_at).getTime() >= Date.now(),
  ).length

  return (
    <section className="page-content management-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR CAREER, ORGANIZED</div>
          <h1>Interviews</h1>
          <p className="page-subtitle">
            Schedule interviews, prepare for each round, and track outcomes.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreateForm}
          disabled={applications.length === 0}
        >
          <span>＋</span> Schedule interview
        </button>
      </div>

      <div className="interview-summary">
        <div className="interview-summary-card">
          <span>Total interviews</span>
          <strong>{interviews.length}</strong>
        </div>
        <div className="interview-summary-card">
          <span>Upcoming interviews</span>
          <strong>{upcomingCount}</strong>
        </div>
        <div className="interview-summary-card">
          <span>Completed</span>
          <strong>
            {interviews.filter((item) => item.outcome === 'completed').length}
          </strong>
        </div>
      </div>

      {error && <div className="form-message error-message" role="alert">{error}</div>}
      {notice && <div className="form-message success-message" role="status">{notice}</div>}

      {applications.length === 0 && !loading && (
        <div className="interview-empty">
          <h2>Add an application first</h2>
          <p>
            Interviews must be linked to an application. Create an application
            before scheduling your first interview.
          </p>
        </div>
      )}

      <div className="interview-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search company, role, or interview..."
          aria-label="Search interviews"
        />

        <select
          value={outcomeFilter}
          onChange={(event) => setOutcomeFilter(event.target.value)}
          aria-label="Filter by outcome"
        >
          <option value="all">All outcomes</option>
          {outcomes.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="interview-empty">Loading interviews...</div>
      ) : visibleInterviews.length === 0 ? (
        <div className="interview-empty">
          <h2>No interviews found</h2>
          <p>
            {interviews.length === 0
              ? 'Schedule your first interview to start tracking your progress.'
              : 'Try changing your search or outcome filter.'}
          </p>
        </div>
      ) : (
        <div className="interview-list">
          {visibleInterviews.map((interview) => {
            const application = applications.find(
              (item) => String(item.id) === String(interview.application_id),
            )

            return (
              <article className="interview-card" key={interview.id}>
                <div className="interview-card-main">
                  <div className="interview-card-heading">
                    <div>
                      <h2>{interview.interview_round}</h2>
                      <p>
                        {application
                          ? applicationLabel(application)
                          : `Application #${interview.application_id}`}
                      </p>
                    </div>
                    <span className={`interview-outcome outcome-${interview.outcome}`}>
                      {interview.outcome || 'scheduled'}
                    </span>
                  </div>

                  <div className="interview-meta">
                    <span>◷ {formatDate(interview.scheduled_at)}</span>
                    <span>• {interview.interview_type || 'Type not specified'}</span>
                  </div>

                  {interview.meeting_url && (
                    <p className="interview-link">
                      Meeting:{' '}
                      <a
                        href={interview.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open meeting link ↗
                      </a>
                    </p>
                  )}

                  {interview.notes && (
                    <p className="interview-notes">{interview.notes}</p>
                  )}
                </div>

                <div className="interview-card-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openEditForm(interview)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeInterview(interview)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="interview-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModalOpen(false)
            }
          }}
        >
          <section
            className="interview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="interview-modal-title"
          >
            <div className="interview-modal-heading">
              <div>
                <div className="eyebrow">INTERVIEW MANAGEMENT</div>
                <h2 id="interview-modal-title">
                  {editingInterview ? 'Edit interview' : 'Schedule interview'}
                </h2>
              </div>
              <button
                type="button"
                className="interview-modal-close"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveInterview}>
              <label>
                Application
                <select
                  value={form.application_id}
                  onChange={(event) =>
                    setForm({ ...form, application_id: event.target.value })
                  }
                  required
                >
                  <option value="">Select an application</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {applicationLabel(application)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Interview round
                <input
                  value={form.interview_round}
                  onChange={(event) =>
                    setForm({ ...form, interview_round: event.target.value })
                  }
                  maxLength={100}
                  placeholder="e.g. Technical Round 1"
                  required
                />
              </label>

              <label>
                Date and time
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(event) =>
                    setForm({ ...form, scheduled_at: event.target.value })
                  }
                  required
                />
              </label>

              <label>
                Interview type
                <select
                  value={form.interview_type}
                  onChange={(event) =>
                    setForm({ ...form, interview_type: event.target.value })
                  }
                >
                  <option value="Technical">Technical</option>
                  <option value="HR">HR</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Coding">Coding</option>
                  <option value="System Design">System Design</option>
                  <option value="Managerial">Managerial</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                Meeting URL
                <input
                  type="url"
                  value={form.meeting_url}
                  onChange={(event) =>
                    setForm({ ...form, meeting_url: event.target.value })
                  }
                  placeholder="https://..."
                />
              </label>

              <label>
                Outcome
                <select
                  value={form.outcome}
                  onChange={(event) =>
                    setForm({ ...form, outcome: event.target.value })
                  }
                  required
                >
                  {outcomes.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Preparation notes
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  rows={4}
                  placeholder="Topics to revise, interviewer details, feedback..."
                />
              </label>

              {error && <div className="form-message error-message" role="alert">{error}</div>}

              <div className="interview-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving || applications.length === 0}
                >
                  {saving
                    ? 'Saving...'
                    : editingInterview
                      ? 'Save changes'
                      : 'Schedule interview'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
