/**
 * /teacher/students - Class roster with detailed BKT stats
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getStudentsDetailed, StudentDetailed, scoreColor, statusColor, statusLabel } from '../../lib/teacher-api'

const STATUS_DESCRIPTIONS: Record<string, { short: string; action: string; color: string }> = {
  mastered:     { short: 'P(mastery) >= 95% across all skills',    action: 'Ready to advance to harder topics.',                    color: '#4ade80' },
  near_mastery: { short: 'Highest skill is 85-95%',                action: 'A few more correct answers will reach mastery.',        color: '#60a5fa' },
  learning:     { short: 'Most skills are in the 30-85% range',    action: 'Normal progress. Continue current practice.',           color: '#fbbf24' },
  struggling:   { short: 'At least one skill is below 30%',        action: 'Needs attention. Review struggling skills directly.',   color: '#f87171' },
  not_started:  { short: 'No questions answered yet',              action: 'Encourage the student to start practicing.',            color: '#94a3b8' },
}

function InfoBox({ title, children, accent = '#60a5fa', defaultOpen = false }: {
  title: string; children: React.ReactNode; accent?: string; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="teacher-info-box" style={{ borderColor: `${accent}33` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="teacher-info-toggle"
        style={{ background: accent + '12' }}>
        <span style={{ color: accent }}>{title}</span>
        <span style={{ color: accent }}>{open ? 'Close' : 'Expand'}</span>
      </button>
      <div
        className={`teacher-info-body ${open ? 'open' : ''}`}
        aria-hidden={!open}
        style={{ borderTopColor: `${accent}22` }}
      >
        <div className="teacher-info-content">
          <div className="teacher-info-content-inner">
            {children}
          </div>
        </div>
      </div>
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
    <div className="teacher-roster-page">
      <section className="teacher-hero teacher-roster-hero">
        <div>
          <p className="teacher-eyebrow">Class Roster</p>
          <h2 className="editorial-title">Student Roster</h2>
          <p>
            Review mastery, recent activity, and individual learning status before
            opening a full student profile.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Roster</span>
          <strong>{students.length}</strong>
          <p>students in view</p>
        </div>
      </section>

      <div className="teacher-roster-nav">
        <Link href="/teacher/heatmap" className="teacher-action primary">
          <span>01</span>
          Skill Heatmap
        </Link>
        <Link href="/dashboard/teacher" className="teacher-action">
          <span>02</span>
          Dashboard
        </Link>
      </div>

      <section className="teacher-kpi-grid teacher-roster-kpis">
        <div className="teacher-kpi-card">
          <p>Total students</p>
          <strong>{students.length}</strong>
          <small>All students in the system</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Needs attention</p>
          <strong style={{ color: atRisk > 0 ? '#A63D40' : undefined }}>{atRisk}</strong>
          <small>Students with a skill below 30%</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Fully mastered</p>
          <strong style={{ color: '#1F4D3A' }}>{mastered}</strong>
          <small>All skills above 95%</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Class avg mastery</p>
          <strong style={{ color: avgScore != null ? scoreColor(avgScore) : undefined }}>
            {avgScore != null ? `${Math.round(avgScore * 100)}%` : '-'}
          </strong>
          <small>Average BKT P(mastery)</small>
        </div>
      </section>

      <section className="teacher-guide-grid">
        <InfoBox title="What do the status labels mean?" accent="#C85B43">
          <p>
            Each student is assigned a <strong>ZPD Status</strong> based on their
            Bayesian mastery estimates across all skills.
          </p>
          <div className="teacher-status-guide">
            {Object.entries(STATUS_DESCRIPTIONS).map(([key, val], idx) => (
              <div
                key={key}
                className="teacher-status-card"
                style={{ borderColor: `${val.color}30`, animationDelay: `${idx * 45}ms` }}
              >
                <span style={{ background: val.color + '22', color: val.color }}>
                  {statusLabel(key)}
                </span>
                <p>{val.short}</p>
                <small>{val.action}</small>
              </div>
            ))}
          </div>
        </InfoBox>

        <InfoBox title="What do the columns mean?" accent="#726A61">
          <div className="teacher-column-guide">
            <div><strong>Mastery %</strong> Average BKT P(mastery) across all skills.</div>
            <div><strong>Interactions</strong> Total number of answered questions.</div>
            <div><strong>Mastered skills</strong> Skills where P(mastery) >= 95%.</div>
            <div><strong>Struggling</strong> Skills where P(mastery) is below 30%.</div>
            <div><strong>Last active</strong> Most recent answered question date.</div>
          </div>
        </InfoBox>
      </section>

      {error && <p className="feedback error">{error}</p>}

      <section className="teacher-panel teacher-roster-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Detailed View</p>
            <h3 className="editorial-title">Learning roster</h3>
          </div>
          <div className="teacher-sort-control">
            <span>Sort by</span>
            {(['score', 'name', 'active'] as const).map(k => (
              <button key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>
                {k === 'score' ? 'Mastery' : k === 'name' ? 'Name' : 'Last Active'}
              </button>
            ))}
          </div>
        </div>

        <div className="teacher-table-wrap">
          <table className="teacher-table teacher-roster-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>ZPD Status</th>
                <th style={{ textAlign: 'right' }}>Mastery</th>
                <th style={{ textAlign: 'right' }}>Interactions</th>
                <th style={{ textAlign: 'right' }}>Mastered</th>
                <th style={{ textAlign: 'right' }}>Struggling</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody key={sort}>
              {loading ? (
                <tr><td colSpan={8} className="teacher-empty-cell">Loading...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={8} className="teacher-empty-cell">No students found</td></tr>
              ) : sorted.map((s, idx) => (
                <tr key={s.user_id} style={{ animationDelay: `${idx * 35}ms` }}>
                  <td>
                    <div className="teacher-student-name">{s.full_name}</div>
                    <div className="teacher-student-meta">{s.username}</div>
                  </td>
                  <td>
                    <span
                      className="teacher-status-pill"
                      style={{
                        background: statusColor(s.zpd_status) + '22',
                        color: statusColor(s.zpd_status),
                      }}
                    >
                      {statusLabel(s.zpd_status)}
                    </span>
                    <div className="teacher-student-meta">
                      {STATUS_DESCRIPTIONS[s.zpd_status]?.action}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', color: scoreColor(s.overall_score), fontWeight: 700 }}>
                    {s.overall_score != null ? `${Math.round(s.overall_score * 100)}%` : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{s.total_interactions}</td>
                  <td style={{ textAlign: 'right', color: '#1F4D3A', fontWeight: s.mastered_skills > 0 ? 700 : 400 }}>
                    {s.mastered_skills || '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: s.struggling_skills > 0 ? '#A63D40' : undefined, fontWeight: s.struggling_skills > 0 ? 700 : 400 }}>
                    {s.struggling_skills > 0
                      ? <span title="Click View to see which skills need attention">Alert {s.struggling_skills}</span>
                      : '-'}
                  </td>
                  <td>
                    {s.last_active
                      ? (() => {
                          const days = Math.floor((Date.now() - new Date(s.last_active).getTime()) / 86400000)
                          return (
                            <span style={{ color: days > 7 ? '#A63D40' : days > 3 ? '#B8893C' : undefined }}>
                              {new Date(s.last_active).toLocaleDateString()}
                              {days > 7 && <span title="Inactive for over a week"> Alert</span>}
                            </span>
                          )
                        })()
                      : <span style={{ color: '#94a3b8' }}>Never</span>}
                  </td>
                  <td>
                    <Link href={`/teacher/students/${s.user_id}`} className="teacher-detail-link">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="teacher-roster-note">
        Alerts indicate students who have been inactive for over 7 days or have
        skills below 30%. Open details to see mastery timeline, response patterns,
        and engagement data.
      </p>
    </div>
  )
}
