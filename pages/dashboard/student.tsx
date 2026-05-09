import { useEffect, useState } from 'react'
import { getCurrentUser, getMasterySummary } from '../../lib/api'

function metric(summary: any, keys: string[]) {
  for (const key of keys) {
    const value = summary?.[key]
    if (typeof value === 'number') {
      return value
    }
  }
  return null
}

export default function StudentDashboard() {
  const [me, setMe] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser()
        setMe(user)

        if (user?.id) {
          const mastery = await getMasterySummary(user.id)
          setSummary(mastery)
        }
      } catch {
        setError('Unable to load student dashboard data')
      }
    }

    load()
  }, [])

  const totalSkills = metric(summary, ['total_skills', 'skills_total'])
  const masteredSkills = metric(summary, ['mastered_skills', 'skills_mastered'])
  const avgMastery = metric(summary, ['avg_mastery', 'average_mastery', 'mastery_score'])
  const skillRows = Array.isArray(summary?.skills) ? summary.skills : []

  return (
    <div className="grid">
      <section className="card stack">
        <h2>Student Dashboard</h2>
        <p className="muted">Your learning profile and mastery progress.</p>

        {error && <p style={{ color: '#ffb4b4' }}>{error}</p>}

        <div className="kpi-grid">
          <article className="kpi-card">
            <p className="kpi-label">Total skills</p>
            <p className="kpi-value">{totalSkills ?? '-'}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">Mastered skills</p>
            <p className="kpi-value">{masteredSkills ?? '-'}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">Average mastery</p>
            <p className="kpi-value">{typeof avgMastery === 'number' ? `${Math.round(avgMastery * 100) / 100}` : '-'}</p>
          </article>
        </div>

        <h4>Profile</h4>
        {me ? (
          <div className="list-item">
            <p><strong>Name:</strong> {me.full_name || me.username || 'N/A'}</p>
            <p><strong>Email:</strong> {me.email || 'N/A'}</p>
            <p><strong>Role:</strong> {me.role || 'student'}</p>
          </div>
        ) : <p className="muted">No profile data available.</p>}

        <h4>Skill Breakdown</h4>
        {skillRows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Mastery</th>
                </tr>
              </thead>
              <tbody>
                {skillRows.slice(0, 8).map((row: any, idx: number) => (
                  <tr key={row.skill_id || row.id || idx}>
                    <td>{row.skill_name || row.name || `Skill ${idx + 1}`}</td>
                    <td>{row.mastery ?? row.score ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No mastery summary yet.</p>}
      </section>

      <aside className="card stack">
        <h4>Next Actions</h4>
        <div className="list">
          <div className="list-item">Continue practice questions</div>
          <div className="list-item">Review mastery map</div>
          <div className="list-item">Use tutor for weak concepts</div>
        </div>
      </aside>
    </div>
  )
}
