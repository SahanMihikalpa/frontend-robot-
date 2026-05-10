import { useEffect, useState } from 'react'
import { listStudentsAnalytics, getStudentAnalytics, getSkillsAnalytics } from '../lib/api'

function scoreColor(score: number | null) {
  if (score == null) return '#94a3b8'
  if (score >= 0.7) return '#4ade80'
  if (score >= 0.4) return '#fbbf24'
  return '#f87171'
}

function readScore(row: any) {
  for (const k of ['overall_score', 'score', 'avg_score']) {
    if (typeof row?.[k] === 'number') return row[k]
  }
  return null
}

export default function AnalyticsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [s, k] = await Promise.all([listStudentsAnalytics(), getSkillsAnalytics()])
        setStudents(Array.isArray(s) ? s : [])
        setSkills(Array.isArray(k) ? k : [])
      } catch {
        setError('Failed to load analytics data')
      }
    }
    load()
  }, [])

  async function loadStudent(id: number) {
    setSelected(id)
    setLoadingDetail(true)
    setDetail(null)
    try {
      const d = await getStudentAnalytics(id)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const avgScore = students.length > 0
    ? students.reduce((acc, s) => acc + (readScore(s) || 0), 0) / students.length
    : null
  const atRisk = students.filter((s) => { const sc = readScore(s); return sc != null && sc < 0.4 }).length

  return (
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Analytics</h2>
            <p className="meta">Class performance and skill breakdown.</p>
          </div>
        </div>

        {error && <p className="feedback error">{error}</p>}

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Students</p>
            <p className="kpi-value">{students.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Avg score</p>
            <p className="kpi-value">{avgScore != null ? avgScore.toFixed(2) : '—'}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">At risk</p>
            <p className="kpi-value" style={{ color: atRisk > 0 ? '#f87171' : undefined }}>{atRisk}</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>No data</td></tr>
              ) : students.map((s: any, idx: number) => {
                const score = readScore(s)
                return (
                  <tr key={s.user_id || idx}>
                    <td>{s.name || s.username || s.full_name || `Student ${idx + 1}`}</td>
                    <td>{s.email || '—'}</td>
                    <td style={{ color: scoreColor(score) }}>
                      {score != null ? score.toFixed(2) : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => loadStudent(s.user_id || s.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="card stack">
        {selected && (
          <div className="section-title">
            <h3>Student detail</h3>
            <button type="button" className="btn ghost small" onClick={() => { setSelected(null); setDetail(null) }}>✕</button>
          </div>
        )}

        {!selected ? (
          <>
            <h3 style={{ margin: 0 }}>Skill trends</h3>
            {skills.length === 0 ? (
              <div className="empty-state"><p className="meta">No skill data.</p></div>
            ) : (
              <div className="stack">
                {skills.slice(0, 10).map((k: any, i: number) => {
                  const score = typeof k.avg_score === 'number' ? k.avg_score
                    : typeof k.average === 'number' ? k.average : null
                  const pct = score != null ? Math.round(score * 100) : null
                  return (
                    <div key={k.skill_id || i}>
                      <div className="row" style={{ marginBottom: 4 }}>
                        <p className="meta">{k.skill_name || k.name || `Skill ${i + 1}`}</p>
                        <span style={{ fontSize: 12, color: scoreColor(score) }}>
                          {pct != null ? `${pct}%` : '—'}
                        </span>
                      </div>
                      {pct != null && (
                        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : loadingDetail ? (
          <p className="meta">Loading…</p>
        ) : detail ? (
          <div className="stack">
            <div className="list-item">
              <p className="meta">Name</p>
              <strong>{detail.name || detail.username || detail.full_name || `User ${selected}`}</strong>
            </div>
            {detail.email && (
              <div className="list-item">
                <p className="meta">Email</p>
                <span>{detail.email}</span>
              </div>
            )}
            {(detail.skill_scores || detail.skills || []).map((s: any, i: number) => {
              const sc = readScore(s) ?? s.mastery_probability ?? s.p_mastery
              const pct = sc != null ? Math.round(sc * 100) : null
              return (
                <div key={i}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <p className="meta">{s.skill_name || s.name || `Skill ${i + 1}`}</p>
                    <span style={{ fontSize: 12, color: scoreColor(sc) }}>{pct != null ? `${pct}%` : '—'}</span>
                  </div>
                  {pct != null && (
                    <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                  )}
                </div>
              )
            })}
            {detail.total_interactions != null && (
              <div className="list-item">
                <p className="meta">Total interactions</p>
                <strong>{detail.total_interactions}</strong>
              </div>
            )}
          </div>
        ) : (
          <p className="meta">No detail data for this student.</p>
        )}

        {!selected && (
          <p className="meta" style={{ marginTop: 8 }}>Click "View" on a student to see their skill breakdown.</p>
        )}
      </aside>
    </div>
  )
}
