/**
 * /teacher/students — Class roster with detailed BKT stats
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getStudentsDetailed, StudentDetailed, scoreColor, statusColor, statusLabel } from '../../lib/teacher-api'

// ── Status guide ───────────────────────────────────────────────────────────

const STATUS_DESCRIPTIONS: Record<string, { short: string; action: string; color: string }> = {
  mastered:     { short: 'P(mastery) ≥ 95% across all skills',    action: 'Ready to advance to harder topics.',                    color: '#4ade80' },
  near_mastery: { short: 'Highest skill is 85–95%',               action: 'A few more correct answers will reach mastery.',        color: '#60a5fa' },
  learning:     { short: 'Most skills are in the 30–85% range',   action: 'Normal progress. Continue current practice.',           color: '#fbbf24' },
  struggling:   { short: 'At least one skill is below 30%',       action: 'Needs attention. Review struggling skills directly.',   color: '#f87171' },
  not_started:  { short: 'No questions answered yet',             action: 'Encourage the student to start practicing.',            color: '#94a3b8' },
}

// ── Collapsible info panel ─────────────────────────────────────────────────
function InfoBox({ title, children, accent = '#60a5fa', defaultOpen = false }: {
  title: string; children: React.ReactNode; accent?: string; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${accent}33`, overflow: 'hidden', fontSize: 13 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          background: accent + '12', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'inherit',
        }}>
        <span style={{ fontWeight: 600, color: accent }}>ℹ {title}</span>
        <span style={{ color: accent, fontSize: 11, opacity: 0.8 }}>{open ? '▲ close' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 16px', background: accent + '0a', borderTop: `1px solid ${accent}22`, lineHeight: 1.75 }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function TeacherStudents() {
  const [students, setStudents] = useState<StudentDetailed[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [sort, setSort]         = useState<'score' | 'name' | 'active'>('score')

  useEffect(() => {
    getStudentsDetailed()
      .then(setStudents)
      .catch(() => setError('Failed to load student data'))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...students].sort((a, b) => {
    if (sort === 'score') return (b.overall_score ?? -1) - (a.overall_score ?? -1)
    if (sort === 'name')  return a.full_name.localeCompare(b.full_name)
    if (sort === 'active') {
      if (!a.last_active) return 1
      if (!b.last_active) return -1
      return new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
    }
    return 0
  })

  const atRisk   = students.filter(s => s.zpd_status === 'struggling').length
  const mastered = students.filter(s => s.zpd_status === 'mastered').length
  const avgScore = students.length > 0
    ? students.reduce((a, s) => a + (s.overall_score ?? 0), 0) / students.length
    : null

  return (
    <div className="stack" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Student Roster</h2>
          <p className="meta">Click a student row to view their full learning detail.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/teacher/heatmap" className="btn secondary">Skill Heatmap</Link>
          <Link href="/dashboard/teacher" className="btn secondary">← Dashboard</Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">Total students</p>
          <p className="kpi-value">{students.length}</p>
          <p className="meta" style={{ fontSize: 11, marginTop: 2 }}>All students in the system</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Needs attention</p>
          <p className="kpi-value" style={{ color: atRisk > 0 ? '#f87171' : undefined }}>{atRisk}</p>
          <p className="meta" style={{ fontSize: 11, marginTop: 2 }}>Students with a skill below 30%</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Fully mastered</p>
          <p className="kpi-value" style={{ color: '#4ade80' }}>{mastered}</p>
          <p className="meta" style={{ fontSize: 11, marginTop: 2 }}>All skills above 95%</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Class avg mastery</p>
          <p className="kpi-value" style={{ color: avgScore != null ? scoreColor(avgScore) : undefined }}>
            {avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}
          </p>
          <p className="meta" style={{ fontSize: 11, marginTop: 2 }}>Average BKT P(mastery)</p>
        </div>
      </div>

      {/* Status guide */}
      <InfoBox title="What do the status labels mean?" accent="#a78bfa">
        <p style={{ margin: '0 0 10px' }}>
          Each student is assigned a <strong>ZPD Status</strong> (Zone of Proximal Development) based on
          their Bayesian mastery estimates across all skills. This tells you at a glance where the student
          is in their learning journey.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {Object.entries(STATUS_DESCRIPTIONS).map(([key, val]) => (
            <div key={key} style={{
              padding: '8px 12px', borderRadius: 8,
              background: val.color + '12', border: `1px solid ${val.color}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  background: val.color + '22', color: val.color,
                  padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                }}>{statusLabel(key)}</span>
              </div>
              <p style={{ margin: '2px 0', fontSize: 12 }}>{val.short}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#fbbf24' }}>→ {val.action}</p>
            </div>
          ))}
        </div>
      </InfoBox>

      {/* Column guide */}
      <InfoBox title="What do the columns mean?" accent="#60a5fa">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px 24px' }}>
          <div><strong>Mastery %</strong> — Average BKT P(mastery) across all skills. Higher = better overall knowledge.</div>
          <div><strong>Interactions</strong> — Total number of questions the student has answered.</div>
          <div><strong>Mastered skills</strong> — Number of skills where P(mastery) ≥ 95%.</div>
          <div><strong>Struggling</strong> — Number of skills where P(mastery) &lt; 30%. These need your attention.</div>
          <div><strong>Last active</strong> — The date the student last answered a question.</div>
        </div>
      </InfoBox>

      {error && <p className="feedback error">{error}</p>}

      {/* Sort controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="meta">Sort by:</span>
        {(['score', 'name', 'active'] as const).map(k => (
          <button key={k} className={`btn small ${sort === k ? '' : 'secondary'}`} onClick={() => setSort(k)}>
            {k === 'score' ? 'Mastery' : k === 'name' ? 'Name' : 'Last Active'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>
                ZPD Status
                <span className="meta" style={{ fontSize: 10, marginLeft: 4, fontWeight: 400 }}>
                  (overall learning stage)
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                Mastery
                <span className="meta" style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>
                  avg P(mastery)
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                Interactions
                <span className="meta" style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>
                  questions answered
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                Mastered
                <span className="meta" style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>
                  skills ≥95%
                </span>
              </th>
              <th style={{ textAlign: 'right' }}>
                Struggling
                <span className="meta" style={{ fontSize: 10, display: 'block', fontWeight: 400 }}>
                  skills &lt;30%
                </span>
              </th>
              <th>Last active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>No students found</td></tr>
            ) : sorted.map(s => (
              <tr key={s.user_id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.full_name}</div>
                  <div className="meta">{s.username}</div>
                </td>
                <td>
                  <span style={{
                    background: statusColor(s.zpd_status) + '22',
                    color: statusColor(s.zpd_status),
                    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  }}>
                    {statusLabel(s.zpd_status)}
                  </span>
                  <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                    {STATUS_DESCRIPTIONS[s.zpd_status]?.action}
                  </div>
                </td>
                <td style={{ textAlign: 'right', color: scoreColor(s.overall_score), fontWeight: 600 }}>
                  {s.overall_score != null ? `${Math.round(s.overall_score * 100)}%` : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>{s.total_interactions}</td>
                <td style={{ textAlign: 'right', color: '#4ade80', fontWeight: s.mastered_skills > 0 ? 600 : 400 }}>
                  {s.mastered_skills || '—'}
                </td>
                <td style={{ textAlign: 'right', color: s.struggling_skills > 0 ? '#f87171' : undefined, fontWeight: s.struggling_skills > 0 ? 700 : 400 }}>
                  {s.struggling_skills > 0
                    ? <span title="Click View to see which skills need attention">⚠ {s.struggling_skills}</span>
                    : '—'}
                </td>
                <td className="meta">
                  {s.last_active
                    ? (() => {
                        const days = Math.floor((Date.now() - new Date(s.last_active).getTime()) / 86400000)
                        return (
                          <span style={{ color: days > 7 ? '#f87171' : days > 3 ? '#fbbf24' : undefined }}>
                            {new Date(s.last_active).toLocaleDateString()}
                            {days > 7 && <span title="Inactive for over a week"> ⚠</span>}
                          </span>
                        )
                      })()
                    : <span style={{ color: '#94a3b8' }}>Never</span>}
                </td>
                <td>
                  <Link href={`/teacher/students/${s.user_id}`} className="btn small secondary">
                    Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom hint */}
      <p className="meta" style={{ fontSize: 12 }}>
        ⚠ icons indicate students who have been inactive for over 7 days or have skills below 30%.
        Click <strong>Details →</strong> to see the full breakdown including mastery timeline, response patterns, and engagement data.
      </p>

    </div>
  )
}
