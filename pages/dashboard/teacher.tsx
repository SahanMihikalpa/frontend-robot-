import { useEffect, useState } from 'react'
import { getSkillsAnalytics, listStudentsAnalytics } from '../../lib/api'

function readNumber(row: any, keys: string[]) {
  for (const key of keys) {
    if (typeof row?.[key] === 'number') {
      return row[key]
    }
  }
  return null
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [studentRows, skillRows] = await Promise.all([
          listStudentsAnalytics(),
          getSkillsAnalytics(),
        ])

        setStudents(Array.isArray(studentRows) ? studentRows : [])
        setSkills(Array.isArray(skillRows) ? skillRows : [])
      } catch {
        setError('Unable to load teacher dashboard data')
      }
    }

    load()
  }, [])

  const averageScore = students.length > 0
    ? (students.reduce((acc, s) => acc + (readNumber(s, ['overall_score', 'score', 'avg_score']) || 0), 0) / students.length)
    : null
  const atRiskCount = students.filter((s) => {
    const score = readNumber(s, ['overall_score', 'score', 'avg_score'])
    return typeof score === 'number' && score < 0.5
  }).length

  return (
    <div className="grid">
      <section className="card stack">
        <h2>Teacher Dashboard</h2>
        <p className="muted">Monitor class performance and skill trends.</p>
        {error && <p style={{ color: '#ffb4b4' }}>{error}</p>}

        <div className="kpi-grid">
          <article className="kpi-card">
            <p className="kpi-label">Students tracked</p>
            <p className="kpi-value">{students.length}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">Average score</p>
            <p className="kpi-value">{averageScore === null ? '-' : averageScore.toFixed(2)}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">At-risk students</p>
            <p className="kpi-value">{atRiskCount}</p>
          </article>
        </div>

        <h4>Students Overview</h4>
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
              {students.slice(0, 10).map((s, idx) => (
                <tr key={s.user_id || s.id || idx}>
                  <td>{s.name || s.username || `Student ${idx + 1}`}</td>
                  <td>{s.email || '-'}</td>
                  <td>{readNumber(s, ['overall_score', 'score', 'avg_score']) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="card stack">
        <h4>Skill Trends</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              {skills.slice(0, 10).map((k, idx) => (
                <tr key={k.skill_id || k.id || idx}>
                  <td>{k.skill_name || k.name || `Skill ${idx + 1}`}</td>
                  <td>{readNumber(k, ['avg_score', 'average', 'score']) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  )
}
