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
  // Drop the decimal at exactly 100% so "100%" (4 chars) fits the fixed-width hero
  // card — "100.0%" (6 chars) overflows the 220px column at the 68px hero font size.
  const masteredLabel = masteredPct >= 100 ? '100' : masteredPct.toFixed(1)
  const skillRows: any[] = Array.isArray(summary?.skills) ? summary.skills
    : Array.isArray(summary?.skill_states) ? summary.skill_states : []

  return (
    <div className="teacher-dashboard">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Today's Learning Journey</p>
          <h2 className="editorial-title">
            Good afternoon,
            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
              {' '}
              {me?.full_name || me?.username || 'Student'}
            </span>
            .
          </h2>
          <p>
            Continue building mastery through personalized practice and AI-guided learning.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Overall mastery</span>
          <strong>{masteredLabel}%</strong>
          <p>across all tracked skills</p>
        </div>
      </section>

      {error && <p className="feedback error">{error}</p>}

      <div className="teacher-layout">
        <section className="teacher-main">
          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Total skills</p>
              <strong>{summary?.total_skills ?? '—'}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>Mastered</p>
              <strong style={{ color: 'var(--success)' }}>{summary?.mastered_count ?? '—'}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>In ZPD</p>
              <strong style={{ color: 'var(--accent)' }}>{summary?.zpd_count ?? '—'}</strong>
            </div>
          </div>

          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Mastery Progress</p>
                <h3 className="editorial-title">Overall mastery</h3>
              </div>
              <Link href="/mastery" className="teacher-text-link">
                View mastery map
              </Link>
            </div>

            <div className="teacher-skill-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className="teacher-skill-topline">
                <p>Across all tracked skills</p>
                <span style={{ color: 'var(--accent)' }}>{masteredLabel}%</span>
              </div>
              <div className="teacher-progress"><span style={{ width: `${masteredPct}%` }} /></div>
            </div>
          </section>

          {skillRows.length > 0 && (
            <section className="teacher-panel">
              <div className="teacher-panel-header">
                <div>
                  <p className="teacher-eyebrow">Skill by Skill</p>
                  <h3 className="editorial-title">Skill breakdown</h3>
                </div>
              </div>

              <div className="teacher-skill-list">
                {skillRows.slice(0, 6).map((row: any, i: number) => {
                  const pct = Math.min(Math.round((row.mastery_probability ?? row.p_mastery ?? row.mastery ?? 0) * 100), 100)
                  return (
                    <div className="teacher-skill-row" key={row.skill_id || i}>
                      <div className="teacher-skill-topline">
                        <p>{row.skill_name || row.name || `Skill ${i + 1}`}</p>
                        <span style={{ color: 'var(--accent)' }}>{pct}%</span>
                      </div>
                      <div className="teacher-progress"><span style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Workspace</p>
          <h3 className="editorial-title">Atlas</h3>

          <div className="teacher-action-list">
            <Link href="/learn" className="teacher-action primary">
              <span>01</span>
              Learn with AI
            </Link>
            <Link href="/selflearn" className="teacher-action">
              <span>02</span>
              Self Learn Anything
            </Link>
             <Link href="/mastery" className="teacher-action">
              <span>03</span>
              View mastery map
            </Link>
            <Link href="/history" className="teacher-action">
              <span>04</span>
              View history
            </Link>
          </div>

          {me && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <p
                style={{
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  color: 'var(--muted)',
                  margin: 0
                }}
              >Account</p>
              <strong style={{ display: 'block', marginTop: 8 }}>{me.full_name || me.username}</strong>
              <p className="meta" style={{ marginTop: 4 }}>{me.email}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
