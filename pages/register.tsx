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
    <div
      style={{
        minHeight: 'calc(100vh - 90px)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        marginTop: 0,
        overflow: 'hidden',
        paddingTop: '10px',
      }}
    >
          {/* LEFT PANEL */}
      
          <div
            style={{
              padding: '10px 60px 40px',
              borderRight: '1px solid rgba(114,106,97,0.12)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            <div
              style={{
                paddingLeft: '60px'
              }}
            >
              <p
                style={{
                  letterSpacing: '.35em',
                  textTransform: 'uppercase',
                  fontSize: 12,
                  color: '#726A61'
                }}
              >
                Returning To Learn
              </p>
      
              <h1
                className="editorial-title"
                style={{
                  fontSize: '4.8rem',
                  lineHeight: '1',
                  marginTop: 30,
                  marginBottom: 30,
                  fontWeight: 500
                }}
              >
                "Your Next
                <br />
                Chapter Starts
                <br />
                <span
                  style={{
                    color: '#C85B43',
                    fontStyle: 'italic'
                  }}
                >
                  Here!
                </span>
                "
              </h1>
      
              <p
                style={{
                  maxWidth: 500,
                  color: '#726A61',
                  lineHeight: 1.8,
                  fontSize: 18
                }}
              >
                Your knowledge model, conversation history, and mastery map
                travel with you across every device.
              </p>
            </div>
      
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 30,
                marginLeft: '140px'
              }}
            >
            <div
              style={{
                position: 'relative',
                width: 220,
                height: 220
              }}
            >
              {/* Glow */}
      
              <div
                style={{
                  position: 'relative',
                  inset: 0,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(200,91,67,.12) 0%, rgba(200,91,67,.05) 45%, transparent 75%)',
                  transform: 'scale(1.15)'
                }}
              />
      
              <Image
                src="/robot.svg"
                alt="Atlas Robot"
                width={220}
                height={220}
                style={{
                  zIndex: 2
                }}
              />
            </div>
      
          </div>
          </div>

          {/* RIGHT PANEL */}

          <div
            style={{
              padding: '10px 60px 40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '620px'
              }}
            >
              <p
          style={{
            letterSpacing: '.35em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: '#726A61'
          }}
        >
          Create Account
        </p>
        <h2
          className="editorial-title"
          style={{
            fontSize: '4rem',
            fontWeight: 500,
            marginTop: 12,
            marginBottom: 30
          }}
        >
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 18,
                marginTop: 16
              }}
            >
              {[
                { value: 'student', label: 'Student' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'admin', label: 'Admin' }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => update('role', item.value as 'student' | 'teacher' | 'admin')}
                  style={{
                    padding: '18px 20px',
                    border:
                      form.role === item.value
                        ? '1px solid #C85B43'
                        : '1px solid rgba(114,106,97,0.18)',

                    background:
                      form.role === item.value
                        ? 'rgba(200,91,67,.04)'
                        : 'transparent',

                    borderRadius: 18,

                    cursor: 'pointer',

                    transition: '.2s',

                    textAlign: 'left',
                    minHeight: '92px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: '#726A61'
                    }}
                  >
                    I AM A
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#171411'
                    }}
                  >
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#ff7a7a' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
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
