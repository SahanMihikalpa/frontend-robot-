import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUser, loginUser } from '../lib/api'
import { getRoleHome, setStoredUser } from '../lib/session'
import Image from 'next/image'
import PasswordInput from '../components/PasswordInput'

type LoginErrors = Partial<Record<'username' | 'password', string>>

function validateLogin(username: string, password: string): LoginErrors {
  const errs: LoginErrors = {}
  if (!username.trim()) errs.username = 'Please enter your username.'
  if (!password) errs.password = 'Please enter your password.'
  return errs
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  function onUsername(v: string) {
    setUsername(v)
    if (submitted) setFieldErrors(validateLogin(v, password))
  }

  function onPassword(v: string) {
    setPassword(v)
    if (submitted) setFieldErrors(validateLogin(username, v))
  }

  async function handleSubmit(e: any) {
    e.preventDefault()
    setSubmitted(true)
    setError('')

    const errs = validateLogin(username, password)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await loginUser(username.trim(), password)
      const me = await getCurrentUser()
      setStoredUser(me)
      router.push(getRoleHome(me?.role))
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
  <div className="auth-split">
    {/* LEFT PANEL */}

    <div className="auth-left">
      <div className="auth-left-content">
        <p className="home-eyebrow">
          Returning To Learn
        </p>

        <h1 className="editorial-title auth-title">
          "Pick up exactly
          <br />
          where you
          <br />
          <span
            style={{
              color: 'var(--accent)',
              fontStyle: 'italic'
            }}
          >
            left off.
          </span>
          "
        </h1>

        <p className="auth-desc">
          Your knowledge model, conversation history, and mastery map
          travel with you across every device.
        </p>
      </div>

      <div className="auth-mascot-col">
      <div className="auth-mascot-wrap">
        {/* Glow */}

        <div className="auth-glow" />

        <Image
          src="/robot.svg"
          alt="Atlas Robot"
          width={220}
          height={220}
          className="auth-mascot-image"
        />
      </div>

    </div>
    </div>

    {/* RIGHT PANEL */}

    <div className="auth-right">
      <div className="auth-right-inner">
        <p className="home-eyebrow">
          Sign In
        </p>

        <h2 className="editorial-title auth-heading">
          Continue your session.
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <label
              htmlFor="login-username"
              style={{
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Username
            </label>
            <input
              id="login-username"
              className="editorial-input"
              type="text"
              value={username}
              onChange={e => onUsername(e.target.value)}
              aria-invalid={!!fieldErrors.username}
              autoComplete="username"
              required
            />
            {fieldErrors.username && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.username}</p>}
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={onPassword}
              ariaInvalid={!!fieldErrors.password}
              autoComplete="current-password"
            />
            {fieldErrors.password && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.password}</p>}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 30
            }}
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>

          <div
            style={{
              marginTop: 30,
              textAlign: 'center'
            }}
          >
            <span className="muted">
              New here?{' '}
            </span>

            <Link
              href="/register"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none'
              }}
            >
              Create an account →
            </Link>
          </div>
        </form>
      </div>
    </div>
  </div>
)
}
