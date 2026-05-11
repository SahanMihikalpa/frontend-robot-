import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSkillsAnalytics, listStudentsAnalytics } from '../../lib/api'

function readScore(row: any) {
  for (const k of ['overall_score', 'score', 'avg_score']) {
    if (typeof row?.[k] === 'number') return row[k]
  }
  return null
}

function scoreColor(score: number | null) {
  if (score == null) return '#94a3b8'
  if (score >= 0.7) return '#4ade80'
  if (score >= 0.4) return '#fbbf24'
  return '#f87171'
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [s, k] = await Promise.all([listStudentsAnalytics(), getSkillsAnalytics()])
        setStudents(Array.isArray(s) ? s : [])
        setSkills(Array.isArray(k) ? k : [])
      } catch {
        setError('Unable to load teacher dashboard data')
      }
    }
    load()
  }, [])

  const avgScore = students.length > 0
    ? students.reduce((acc, s) => acc + (readScore(s) || 0), 0) / students.length
    : null
  const atRisk = students.filter((s) => { const sc = readScore(s); return sc != null && sc < 0.4 }).length

  return (
    <div className="grid">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Teacher Dashboard</h2>
            <p className="meta">Monitor class performance and skill trends.</p>
          </div>
        </div>

        {error && <p className="feedback error">{error}</p>}

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Students tracked</p>
            <p className="kpi-value">{students.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Average score</p>
            <p className="kpi-value">{avgScore != null ? avgScore.toFixed(2) : '—'}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">At-risk</p>
            <p className="kpi-value" style={{ color: atRisk > 0 ? '#f87171' : undefined }}>{atRisk}</p>
          </div>
        </div>

        <h4 style={{ margin: 0 }}>Students overview</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>No students yet</td></tr>
              ) : students.slice(0, 10).map((s: any, idx: number) => {
                const score = readScore(s)
                return (
                  <tr key={s.user_id || s.id || idx}>
                    <td>{s.name || s.username || s.full_name || `Student ${idx + 1}`}</td>
                    <td>{s.email || '—'}</td>
                    <td style={{ color: scoreColor(score) }}>{score != null ? score.toFixed(2) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h4 style={{ margin: 0 }}>Skill trends</h4>
        {skills.slice(0, 6).map((k: any, i: number) => {
          const score = typeof k.avg_score === 'number' ? k.avg_score : typeof k.average === 'number' ? k.average : null
          const pct = score != null ? Math.round(score * 100) : null
          return (
            <div key={k.skill_id || i}>
              <div className="row" style={{ marginBottom: 4 }}>
                <p className="meta">{k.skill_name || k.name || `Skill ${i + 1}`}</p>
                <span style={{ fontSize: 12, color: scoreColor(score) }}>{pct != null ? `${pct}%` : '—'}</span>
              </div>
              {pct != null && <div className="progress"><span style={{ width: `${pct}%` }} /></div>}
            </div>
          )
        })}
      </section>

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Quick actions</h3>
        <div className="list">
          <div className="list-item">
            <Link href="/skills" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
              Manage skills
            </Link>
          </div>
          <div className="list-item">
            <Link href="/questions" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Manage questions
            </Link>
          </div>
          <div className="list-item">
            <Link href="/knowledge" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Knowledge base
            </Link>
          </div>
          <div className="list-item">
            <Link href="/history" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              View history
            </Link>
          </div>
          <div className="list-item">
            <Link href="/analytics" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Full analytics
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
