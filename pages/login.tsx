import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUser, loginUser } from '../lib/api'
import { getRoleHome, setStoredUser } from '../lib/session'
import Image from 'next/image'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: any) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginUser(username, password)
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

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label
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
              id="login-email"
              className="editorial-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="editorial-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
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
