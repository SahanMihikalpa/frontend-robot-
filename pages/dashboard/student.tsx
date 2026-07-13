import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCurrentUser, getMasterySummary } from '../../lib/api'

/** Time-of-day greeting pinned to Sri Lankan time (Asia/Colombo), regardless
 *  of the device's timezone. */
function sriLankaGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Colombo',
    }).format(new Date()),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

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
  const masteredLabel = masteredPct >= 100 ? '100' : masteredPct.toFixed(1)
  const skillRows: any[] = Array.isArray(summary?.skills) ? summary.skills
    : Array.isArray(summary?.skill_states) ? summary.skill_states : []

  const totalSkills = Number(summary?.total_skills ?? 0)
  const masteredCount = Number(summary?.mastered_count ?? 0)
  const zpdCount = Number(summary?.zpd_count ?? 0)
  const remainingCount = Math.max(totalSkills - masteredCount, 0)
  const completionPct = totalSkills > 0
    ? Math.min(Math.round((masteredCount / totalSkills) * 100), 100)
    : 0

  return (
    <div className="teacher-dashboard student-dash">
      {error && <p className="feedback error">{error}</p>}

      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-hero">
            <div>
              <p className="teacher-eyebrow">Today's Learning Journey</p>
              <h2 className="editorial-title">
                {sriLankaGreeting()},
                <span style={{ display: 'block', color: 'var(--accent)', fontStyle: 'italic' }}>
                  {me?.username || me?.full_name || 'Student'}
                  <span style={{ color: 'var(--text)', fontStyle: 'normal' }}>.</span>
                </span>
              </h2>
              <p>
                Continue building mastery through personalized practice and AI-guided learning.
              </p>
            </div>
            <div className="teacher-hero-note">
              <span>Overall mastery</span>
              <strong>{masteredLabel}%</strong>
              <p>
                {totalSkills > 0
                  ? `${masteredCount} of ${totalSkills} skills mastered`
                  : 'across all tracked skills'}
              </p>
            </div>
          </section>

          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Total skills</p>
              <strong>{summary?.total_skills ?? '—'}</strong>
              <small>tracked in your curriculum</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Mastered</p>
              <strong style={{ color: 'var(--success)' }}>{summary?.mastered_count ?? '—'}</strong>
              <small>{completionPct}% of all skills</small>
            </div>
            <div className="teacher-kpi-card">
              <p>In ZPD</p>
              <strong style={{ color: 'var(--accent)' }}>{summary?.zpd_count ?? '—'}</strong>
              <small>ready to learn next</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Remaining</p>
              <strong>{summary ? remainingCount : '—'}</strong>
              <small>still left to master</small>
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

            <div className="student-progress-stats">
              <div className="student-progress-stat">
                <p>Mastered</p>
                <strong style={{ color: 'var(--success)' }}>{summary?.mastered_count ?? '—'}</strong>
              </div>
              <div className="student-progress-stat">
                <p>In progress</p>
                <strong style={{ color: 'var(--accent)' }}>{summary ? zpdCount : '—'}</strong>
              </div>
              <div className="student-progress-stat">
                <p>Remaining</p>
                <strong>{summary ? remainingCount : '—'}</strong>
              </div>
              <div className="student-progress-stat">
                <p>Completion</p>
                <strong>{summary ? `${completionPct}%` : '—'}</strong>
              </div>
            </div>

            {skillRows.length > 0 && (
              <div className="student-skill-breakdown">
                <p className="teacher-eyebrow" style={{ marginBottom: 12 }}>Skill by Skill</p>
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
              </div>
            )}
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Workspace</p>
          <h3 className="editorial-title">Quick actions</h3>

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
            <div className="student-account">
              <p
                style={{
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  color: 'var(--muted)',
                  margin: 0
                }}
              >Account</p>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 15 }}>{me.full_name || me.username}</strong>
              <p className="meta" style={{ marginTop: 4 }}>{me.email}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
