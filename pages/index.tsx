import Link from 'next/link'

export default function Home() {
  return (
    <div className="grid-two">
      <section className="card stack">
        <div className="hero">
          <h2>Personalized Robot Learning Platform</h2>
          <p className="muted">Adaptive learning with tutoring, mastery tracking, engagement sensing, and analytics in one workspace.</p>
        </div>

        <div style={{ marginTop: 18 }}>
          <p>Get started</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/login" className="btn">Sign in</Link>
            <Link href="/register" className="btn secondary">Create account</Link>
            <Link href="/dashboard" className="btn secondary">Go to my dashboard</Link>
          </div>
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          <div className="list-item">
            <strong>Students</strong>
            <p className="meta">Practice questions, get AI tutor help, and monitor mastery progress.</p>
          </div>
          <div className="list-item">
            <strong>Teachers</strong>
            <p className="meta">Track student performance, inspect skill analytics, and guide interventions.</p>
          </div>
          <div className="list-item">
            <strong>Admins</strong>
            <p className="meta">Manage hardware, voice pipeline, knowledge base, and system-level analytics.</p>
          </div>
        </div>
      </section>

      <aside className="card stack">
        <h4>How it works</h4>
        <p className="meta">1. Open sign in and authenticate.</p>
        <p className="meta">2. The app redirects you to the correct dashboard by role.</p>
        <p className="meta">3. Navigation and page access are filtered by your permissions.</p>

        <h4>Deployment note</h4>
        <p className="muted">Set <code>NEXT_PUBLIC_API_BASE_URL</code> to your backend URL before running in production.</p>
      </aside>
    </div>
  )
}
