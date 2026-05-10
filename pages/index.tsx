import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getAuthTokenFromStorage, getStoredUser, getRoleHome } from '../lib/session'

export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [dashboardHref, setDashboardHref] = useState('/login')

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()
    if (token && me?.role) {
      setAuthed(true)
      setDashboardHref(getRoleHome(me.role))
    }
  }, [])

  return (
    <div className="stack" style={{ gap: 32 }}>
      {/* Hero */}
      <section className="card" style={{ padding: '40px 32px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, lineHeight: 1.2 }}>
          <span style={{ color: '#7dd3fc' }}>Personalized</span> Robot Learning Platform
        </h1>
        <p className="meta" style={{ maxWidth: 520, margin: '0 auto 28px', fontSize: 16 }}>
          Adaptive learning driven by BKT & DKT, with AI tutoring, visual engagement sensing, and real-time analytics.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {authed ? (
            <Link href={dashboardHref} className="btn">Go to my dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn">Sign in</Link>
              <Link href="/register" className="btn secondary">Create account</Link>
            </>
          )}
        </div>
      </section>

      {/* Role cards */}
      <div className="grid-three">
        <div className="card stack">
          <div style={{ fontSize: 28 }}>🎓</div>
          <h3 style={{ margin: 0 }}>Students</h3>
          <p className="meta">Practice adaptive questions, track mastery across skills, and get AI tutor help any time.</p>
          <ul className="meta" style={{ paddingLeft: 16, margin: 0 }}>
            <li>BKT/DKT question selection</li>
            <li>Mastery progress map</li>
            <li>Chat tutor with RAG</li>
            <li>Visual engagement tracking</li>
          </ul>
        </div>
        <div className="card stack">
          <div style={{ fontSize: 28 }}>📊</div>
          <h3 style={{ margin: 0 }}>Teachers</h3>
          <p className="meta">Monitor class performance, identify at-risk students, and manage the question bank.</p>
          <ul className="meta" style={{ paddingLeft: 16, margin: 0 }}>
            <li>Class analytics dashboard</li>
            <li>Student performance details</li>
            <li>Question CRUD</li>
            <li>Knowledge base upload</li>
          </ul>
        </div>
        <div className="card stack">
          <div style={{ fontSize: 28 }}>⚙️</div>
          <h3 style={{ margin: 0 }}>Admins</h3>
          <p className="meta">Manage hardware, voice pipeline, knowledge documents, and platform-wide data.</p>
          <ul className="meta" style={{ paddingLeft: 16, margin: 0 }}>
            <li>Hardware status & camera</li>
            <li>Voice pipeline control</li>
            <li>Full analytics access</li>
            <li>Knowledge base management</li>
          </ul>
        </div>
      </div>

      {/* How it works */}
      <section className="card stack">
        <h3 style={{ margin: 0 }}>How it works</h3>
        <div className="grid-three">
          <div className="list-item">
            <strong>1. Sign in</strong>
            <p className="meta" style={{ marginTop: 6 }}>Authenticate with your credentials. The system identifies your role automatically.</p>
          </div>
          <div className="list-item">
            <strong>2. Role-based access</strong>
            <p className="meta" style={{ marginTop: 6 }}>You are redirected to the correct dashboard. Navigation is filtered by your permissions.</p>
          </div>
          <div className="list-item">
            <strong>3. Learn & analyse</strong>
            <p className="meta" style={{ marginTop: 6 }}>Students practise; teachers monitor; admins configure. Everything updates in real time.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
