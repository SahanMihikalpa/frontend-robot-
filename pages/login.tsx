import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUser, loginUser } from '../lib/api'
import { getRoleHome, setStoredUser } from '../lib/session'

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
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card">
        <h2>Sign in</h2>
        <p className="muted">Sign in with your account to access the dashboard.</p>
        <p className="muted">No account yet? <Link href="/register">Create one</Link>.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <div className="form-row">
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <p style={{ color: '#ff7a7a' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
            <button className="btn secondary" type="button" onClick={() => { setUsername(''); setPassword('') }}>Reset</button>
          </div>
        </form>
      </div>
    </div>
  )
}
