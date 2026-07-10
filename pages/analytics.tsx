import Link from 'next/link'
import { useEffect, useState } from 'react'
import { listStudentsAnalytics, getStudentAnalytics, getSkillsAnalytics } from '../lib/api'

function scoreColor(score: number | null) {
  if (score == null) return 'var(--muted)'
  if (score >= 0.7) return 'var(--success)'
  if (score >= 0.4) return 'var(--warning)'
  return 'var(--danger)'
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'at-risk' | 'strong'>('all')
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
  const strong = students.filter((s) => { const sc = readScore(s); return sc != null && sc >= 0.7 }).length

  const filtered =
    activeFilter === 'at-risk'
      ? students.filter((s) => { const sc = readScore(s); return sc != null && sc < 0.4 })
      : activeFilter === 'strong'
      ? students.filter((s) => { const sc = readScore(s); return sc != null && sc >= 0.7 })
      : students

  const selectedStudent = students.find((s) => (s.user_id || s.id) === selected)

  return (
    <div className="analytics-page teacher-roster-page student-dash">

      {/* ── Hero ── */}
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Performance Analytics</p>
          <h2 className="editorial-title">Classroom Insights</h2>
          <p>Monitor classroom performance, identify learning gaps, and explore mastery trends across every student.</p>
        </div>
        <div className="teacher-hero-note">
          <span>Class</span>
          <strong>{students.length}</strong>
          <p>students tracked</p>
        </div>
      </section>

      

      <section className="teacher-kpi-grid teacher-roster-kpis">
        <div className="teacher-kpi-card">
          <p>Total students</p>
          <strong>{students.length}</strong>
          <small>in your classroom</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Average score</p>
          <strong>{avgScore != null ? `${Math.round(avgScore * 100)}%` : '—'}</strong>
          <small>across all students</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Need attention</p>
          <strong style={{ color: atRisk > 0 ? 'var(--danger)' : undefined }}>{atRisk}</strong>
          <small>scoring below 40%</small>
        </div>
        <div className="teacher-kpi-card">
          <p>Strong</p>
          <strong style={{ color: 'var(--success)' }}>{strong}</strong>
          <small>scoring 70% or above</small>
        </div>
      </section>

      {error && <p className="feedback error">{error}</p>}

      <div className="analytics-panel-row">
        {/* ── Filters panel ── */}
        <section className="teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <p className="teacher-eyebrow">Filters</p>
              <h3 className="editorial-title">Student scope</h3>
            </div>
          </div>

          {students.length > 0 && (
            <div className="history-accuracy-block">
              <div>
                <p>Class average score</p>
                <strong>{avgScore != null ? `${(avgScore * 100).toFixed(1)}%` : '—'}</strong>
              </div>
              {avgScore != null && (
                <div className="teacher-progress">
                  <span style={{ width: `${avgScore * 100}%` }} />
                </div>
              )}
            </div>
          )}

          <div className="history-chip-row">
            {(['all', 'at-risk', 'strong'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`skills-chip ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f === 'all' ? 'All students' : f === 'at-risk' ? 'At risk (<40%)' : 'Strong (≥70%)'}
              </button>
            ))}
          </div>
        </section>

        {/* ── Students panel ── */}
        <section className="teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <p className="teacher-eyebrow">Student Performance</p>
              <h3 className="editorial-title">Classroom Overview</h3>
            </div>
            <span className="skills-count-pill subtle">{filtered.length} students</span>
          </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No students match this filter.</p>
            <p className="meta">Try switching to "All students" to see the full roster.</p>
          </div>
        ) : (
          <div className="analytics-student-list">
            {filtered.map((s: any, idx: number) => {
              const score = readScore(s)
              const pct = score != null ? Math.round(score * 100) : null
              const id = s.user_id || s.id
              return (
                <article key={id || idx} className="analytics-student-card">
                  <div className="analytics-student-main">
                    <div>
                      <h4>{s.name || s.username || `Student ${id}`}</h4>
                      {s.email && <p className="meta">{s.email}</p>}
                    </div>
                    <div className="analytics-student-right">
                      <span
                        className={`history-result-pill ${
                          score == null ? '' : score >= 0.7 ? 'success' : score >= 0.4 ? 'warning' : 'danger'
                        }`}
                      >
                        {pct != null ? `${pct}%` : '—'}
                      </span>
                      <button
                        type="button"
                        className={`skills-chip ${selected === id ? 'active' : ''}`}
                        onClick={() =>
                          selected === id
                            ? (setSelected(null), setDetail(null))
                            : loadStudent(id)
                        }
                      >
                        {selected === id ? 'Close' : 'View →'}
                      </button>
                    </div>
                  </div>

                  {pct != null && (
                    <div className="teacher-progress" style={{ marginTop: 12 }}>
                      <span style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${scoreColor(score)}, ${scoreColor(score)}aa)` }} />
                    </div>
                  )}

                  {/* Inline detail expansion */}
                  {selected === id && (
                    <div className="analytics-detail-block">
                      {loadingDetail ? (
                        <p className="meta">Loading…</p>
                      ) : detail ? (
                        <>
                          {(detail.skill_scores || detail.skills || []).length > 0 && (
                            <>
                              <p className="teacher-eyebrow" style={{ marginBottom: 12 }}>Skill Breakdown</p>
                              {(detail.skill_scores || detail.skills || []).map((sk: any, i: number) => {
                                const sc = readScore(sk) ?? sk.mastery_probability ?? sk.p_mastery
                                const skPct = sc != null ? Math.round(sc * 100) : null
                                return (
                                  <div key={i} className="analytics-skill-row">
                                    <div className="row" style={{ marginBottom: 4 }}>
                                      <p className="meta">{sk.skill_name || sk.name || `Skill ${i + 1}`}</p>
                                      <span style={{ fontSize: 15, fontWeight: 700, color: scoreColor(sc) }}>
                                        {skPct != null ? `${skPct}%` : '—'}
                                      </span>
                                    </div>
                                    {skPct != null && (
                                      <div className="teacher-progress">
                                        <span style={{ width: `${skPct}%` }} />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </>
                          )}
                          {detail.total_interactions != null && (
                            <p className="meta" style={{ marginTop: 8 }}>
                              Total interactions: <strong>{detail.total_interactions}</strong>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="meta">No detail data available for this student.</p>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
        </section>
      </div>

      {/* ── Skill Trends panel ── */}
      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Analytics</p>
            <h3 className="editorial-title">Skill Trends</h3>
          </div>
          <span className="skills-count-pill subtle">{skills.length} skills</span>
        </div>

        <p style={{ marginTop: 0, marginBottom: 20, color: 'var(--muted)', lineHeight: 1.7 }}>
          Track mastery across every skill and identify areas that require additional teaching attention.
        </p>

        {skills.length === 0 ? (
          <div className="empty-state">
            <p>No skill data available.</p>
            <p className="meta">Skill analytics will appear once students start practising.</p>
          </div>
        ) : (
          <div className="analytics-skill-list">
            {skills.map((k: any, i: number) => {
              const score =
                typeof k.avg_score === 'number' ? k.avg_score
                : typeof k.average === 'number' ? k.average
                : null
              const pct = score != null ? Math.round(score * 100) : null
              return (
                <div key={k.skill_id || i} className="analytics-skill-row">
                  <div className="row" style={{ marginBottom: 6 }}>
                    <p className="meta">{k.skill_name || k.name || `Skill ${i + 1}`}</p>
                    <span style={{ fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>
                      {pct != null ? `${pct}%` : '—'}
                    </span>
                  </div>
                  {pct != null && (
                    <div className="teacher-progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
