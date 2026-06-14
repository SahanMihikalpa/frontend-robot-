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
  <div
    style={{
      minHeight: 'calc(100vh - 90px)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      marginTop: 0,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}
  >
    {/* LEFT PANEL */}

    <div
      style={{
        padding: '20px 60px 40px',
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
          "Pick up exactly
          <br />
          where you
          <br />
          <span
            style={{
              color: '#C85B43',
              fontStyle: 'italic'
            }}
          >
            left off.
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
        alignItems: 'center'
      }}
    >
      <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        <p
          style={{
            letterSpacing: '.35em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: '#726A61'
          }}
        >
          Sign In
        
        </p>

        

        <h2
          className="editorial-title"
          style={{
            fontSize: '4rem',
            fontWeight: 500,
            marginTop: 12,
            marginBottom: 50
          }}
        >
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
              Email
            </label>
            <input
              className="editorial-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-row" style={{ marginTop: 24 }}>
            <label
              style={{
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              Password
            </label>
            <input
              className="editorial-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          

          {error && (
            <p style={{ color: '#C85B43', marginTop: 12 }}>
              {error}
            </p>
          )}

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
                color: '#C85B43',
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
