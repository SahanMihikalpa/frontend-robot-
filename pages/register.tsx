import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUser, loginUser, registerUser } from '../lib/api'
import { getRoleHome, setStoredUser } from '../lib/session'
import Image from 'next/image'
import PasswordInput from '../components/PasswordInput'
import HelpTip from '../components/HelpTip'
import { useToast } from '../components/ToastProvider'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

type FieldErrors = Partial<Record<'full_name' | 'username' | 'email' | 'password' | 'confirm_password', string>>

function validateRegister(form: { full_name: string; username: string; email: string; password: string; confirm_password: string }): FieldErrors {
  const errs: FieldErrors = {}
  if (form.full_name.trim().length < 2) {
    errs.full_name = 'Please enter your full name (at least 2 characters).'
  }
  if (!form.username.trim()) {
    errs.username = 'Username is required.'
  } else if (!USERNAME_RE.test(form.username.trim())) {
    errs.username = '3–30 characters; letters, numbers, and underscores only.'
  }
  if (!form.email.trim()) {
    errs.email = 'Email is required.'
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errs.email = 'Enter a valid email address, e.g. name@example.com.'
  }
  if (!form.password) {
    errs.password = 'Password is required.'
  } else if (form.password.length < 8) {
    errs.password = 'Password must be at least 8 characters.'
  } else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
    errs.password = 'Password must contain at least one letter and one number.'
  }
  if (!form.confirm_password) {
    errs.confirm_password = 'Please re-enter your password.'
  } else if (form.confirm_password !== form.password) {
    errs.confirm_password = 'Passwords do not match.'
  }
  return errs
}

export default function Register() {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
  })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Live re-validation once the user has attempted a submit
      if (submitted) setFieldErrors(validateRegister(next))
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)

    const errs = validateRegister(form)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await registerUser({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })

      toast.success({ title: 'Account created', message: `Welcome to Atlas, ${form.full_name.trim() || form.username.trim()}!` })
      await loginUser(form.username.trim(), form.password)
      const me = await getCurrentUser()
      setStoredUser(me)
      router.push(getRoleHome(me?.role))
    } catch (err: any) {
      toast.error({ title: 'Registration failed', message: err?.response?.data?.detail || 'Please check your details and try again.' })
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
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-label-row">
              <label className="form-label" htmlFor="register-full-name">Full name</label>
              <HelpTip label="Full name" text="Your real name — this is shown on your dashboard and in the classroom." />
            </div>
            <input
              id="register-full-name"
              className="editorial-input"
              type="text"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              aria-invalid={!!fieldErrors.full_name}
              required
            />
            {fieldErrors.full_name && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.full_name}</p>}
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="register-username">Username</label>
              <HelpTip label="Username" text="3–30 characters. Letters, numbers, and underscores only — you'll use this to sign in." />
            </div>
            <input
              id="register-username"
              className="editorial-input"
              type="text"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              aria-invalid={!!fieldErrors.username}
              autoComplete="username"
              required
            />
            {fieldErrors.username && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.username}</p>}
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="register-email">Email</label>
              <HelpTip label="Email" text="A valid address like name@example.com. We'll send your welcome email here." />
            </div>
            <input
              id="register-email"
              className="editorial-input"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              aria-invalid={!!fieldErrors.email}
              autoComplete="email"
              required
            />
            {fieldErrors.email && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.email}</p>}
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="register-password">Password</label>
              <HelpTip label="Password" text="At least 8 characters, including at least one letter and one number." />
            </div>
            <PasswordInput
              id="register-password"
              value={form.password}
              onChange={(v) => update('password', v)}
              ariaInvalid={!!fieldErrors.password}
              autoComplete="new-password"
            />
            {fieldErrors.password && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.password}</p>}
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <div className="form-label-row">
              <label className="form-label" htmlFor="register-confirm-password">Confirm password</label>
              <HelpTip label="Confirm password" text="Re-enter the same password to make sure it matches." />
            </div>
            <PasswordInput
              id="register-confirm-password"
              value={form.confirm_password}
              onChange={(v) => update('confirm_password', v)}
              ariaInvalid={!!fieldErrors.confirm_password}
              autoComplete="new-password"
            />
            {fieldErrors.confirm_password && <p className="form-error" style={{ marginTop: 6 }}>{fieldErrors.confirm_password}</p>}
          </div>

          {/* Role selection temporarily disabled.
              Keeping the implementation for future re-enablement. */}
          {/*
          <div
            style={{
              marginTop: 24
            }}
          >
            <label className="form-label">
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
                  className={`auth-role-option${form.role === item.value ? ' selected' : ''}`}
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
          */}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
            <Link className="btn auth-secondary-btn" href="/login">Back to sign in</Link>
          </div>
        </form>
            </div>
          </div>
    </div>
  )
}
