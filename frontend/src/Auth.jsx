import { useState } from 'react'
import { loginUser, registerUser } from './services/api'
import './Auth.css'

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
    setSuccess('')
    setPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (isRegister && !name.trim()) {
      setError('Please enter your name.')
      return
    }

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      if (isRegister) {
        await registerUser(name.trim(), email.trim(), password)
        setSuccess('Account created successfully! You can now sign in.')
        setMode('login')
        setName('')
        setPassword('')
      } else {
        const result = await loginUser(email.trim(), password)

        if (!result.token || !result.user) {
          throw new Error('The server returned an invalid login response.')
        }

        onLogin({
          token: result.token,
          user: result.user,
        })
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to complete your request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <a className="auth-brand" href="#home">
          <span className="auth-brand-mark">J</span>
          <span>JobTrack</span>
        </a>

        <div className="auth-brand-copy">
          <span className="auth-eyebrow">YOUR CAREER, ORGANIZED</span>
          <h1>Your next opportunity starts with a plan.</h1>
          <p>
            Bring your job applications together, track your progress,
            and stay focused on the opportunities that matter.
          </p>
        </div>

        <div className="auth-brand-footer">
          One workspace. Every opportunity.
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <span className="auth-eyebrow">
            {isRegister ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}
          </span>

          <h2>{isRegister ? 'Get started' : 'Sign in to JobTrack'}</h2>

          <p className="auth-description">
            {isRegister
              ? 'Create your account to organize your job search.'
              : 'Enter your credentials to access your career workspace.'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <label>
                Full name
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'Create a password' : 'Enter your password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={isRegister ? 8 : undefined}
                required
              />
            </label>

            {error && (
              <p className="auth-message error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="auth-message success" role="status">
                {success}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? 'Please wait...'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </p>

          <p className="auth-security-note">
            Your account is protected by server-side authentication.
            Never share your password or access token.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Auth
