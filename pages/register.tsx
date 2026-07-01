import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUser, loginUser, registerUser } from '../lib/api'
import { getRoleHome, setStoredUser } from '../lib/session'
import Image from 'next/image'

export default function Register() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await registerUser({
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
      })

      await loginUser(form.username, form.password)
      const me = await getCurrentUser()
      setStoredUser(me)
      router.push(getRoleHome(me?.role))
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed')
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
                "Your Next
                <br />
                Chapter Starts
                <br />
                <span
                  style={{
                    color: 'var(--accent)',
                    fontStyle: 'italic'
                  }}
                >
                  Here!
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
            <div className="auth-right-inner auth-right-inner-wide">
              <p className="home-eyebrow">
          Create Account
        </p>
        <h2 className="editorial-title auth-heading" style={{ marginBottom: 30 }}>
          Begin your learning journey.
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Full name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid rgba(6, 6, 6, 0.18)',
                borderRadius: '14px',
                background: 'transparent',
                fontSize: '16px',
                outline: 'none' 
              }}
            />
          </div>

          <div className="form-row">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid rgba(6, 6, 6, 0.18)',
                borderRadius: '14px',
                background: 'transparent',
                fontSize: '16px',
                outline: 'none' 
              }}
            />
          </div>

          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid rgba(6, 6, 6, 0.18)',
                borderRadius: '14px',
                background: 'transparent',
                fontSize: '16px',
                outline: 'none' 
              }}
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid rgba(6, 6, 6, 0.18)',
                borderRadius: '14px',
                background: 'transparent',
                fontSize: '16px',
                outline: 'none' 
              }}
            />
          </div>

          <div
            style={{
              marginTop: 24
            }}
          >
            <label
              style={{
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Select Role
            </label>
            <div className="auth-role-grid">
              {[
                { value: 'student', label: 'Student' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'admin', label: 'Admin' }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => update('role', item.value as 'student' | 'teacher' | 'admin')}
                  className="auth-role-option"
                  style={{
                    border:
                      form.role === item.value
                        ? '1px solid var(--accent)'
                        : '1px solid rgba(114,106,97,0.18)',

                    background:
                      form.role === item.value
                        ? 'rgba(200,91,67,.04)'
                        : 'transparent',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)'
                    }}
                  >
                    I AM A
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--text)'
                    }}
                  >
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#ff7a7a' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
            <Link className="btn secondary" href="/login">Back to sign in</Link>
          </div>
        </form>
            </div>
          </div>
    </div>
  )
}
