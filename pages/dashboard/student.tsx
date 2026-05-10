import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCurrentUser, getMasterySummary } from '../../lib/api'

export default function StudentDashboard() {
  const [me, setMe] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser()
        setMe(u)
        if (u?.id) {
          const s = await getMasterySummary(u.id)
          setSummary(s)
        }
      } catch {
        setError('Unable to load dashboard data')
      }
    }
    load()
  }, [])

  const masteredPct = Math.min(Number(summary?.mastered_pct || 0), 100)
  const skillRows: any[] = Array.isArray(summary?.skills) ? summary.skills
    : Array.isArray(summary?.skill_states) ? summary.skill_states : []

  return (
    <div className="grid">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Student Dashboard</h2>
            <p className="meta">Your learning profile and mastery progress.</p>
          </div>
          {me && <span className="badge">{me.full_name || me.username}</span>}
        </div>

        {error && <p className="feedback error">{error}</p>}

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Total skills</p>
            <p className="kpi-value">{summary?.total_skills ?? '—'}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Mastered</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>{summary?.mastered_count ?? '—'}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">In ZPD</p>
            <p className="kpi-value" style={{ color: '#7dd3fc' }}>{summary?.zpd_count ?? '—'}</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <strong>Overall mastery</strong>
            <span className="meta">{masteredPct.toFixed(1)}%</span>
          </div>
          <div className="progress"><span style={{ width: `${masteredPct}%` }} /></div>
        </div>

        {/* Skill breakdown */}
        {skillRows.length > 0 && (
          <div className="stack">
            <h4 style={{ margin: 0 }}>Skill breakdown</h4>
            {skillRows.slice(0, 6).map((row: any, i: number) => {
              const pct = Math.min(Math.round((row.mastery_probability ?? row.p_mastery ?? row.mastery ?? 0) * 100), 100)
              return (
                <div key={row.skill_id || i}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <p className="meta">{row.skill_name || row.name || `Skill ${i + 1}`}</p>
                    <span style={{ fontSize: 12 }}>{pct}%</span>
                  </div>
                  <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Quick actions</h3>
        <div className="list">
          <div className="list-item">
            <Link href="/practice" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
              Practice questions
            </Link>
          </div>
          <div className="list-item">
            <Link href="/mastery" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              View mastery map
            </Link>
          </div>
          <div className="list-item">
            <Link href="/tutor" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Ask the tutor
            </Link>
          </div>
          <div className="list-item">
            <Link href="/history" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              View history
            </Link>
          </div>
        </div>

        {me && (
          <div className="list-item">
            <p className="meta">Account</p>
            <strong>{me.full_name || me.username}</strong>
            <p className="meta">{me.email}</p>
          </div>
        )}
      </aside>
    </div>
  )
}
