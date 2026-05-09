import { useEffect, useState } from 'react'
import { listStudentsAnalytics, getStudentAnalytics, getSkillsAnalytics } from '../lib/api'

export default function AnalyticsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [studentDetail, setStudentDetail] = useState<any>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const s = await listStudentsAnalytics()
      setStudents(s || [])
      const k = await getSkillsAnalytics()
      setSkills(k || [])
    } catch {
      // ignore
    }
  }

  async function loadStudent(id: number) {
    setSelected(id)
    try {
      const d = await getStudentAnalytics(id)
      setStudentDetail(d)
    } catch {
      setStudentDetail(null)
    }
  }

  return (
    <div className="grid-two">
      <section className="card stack">
        <h2>Student Analytics</h2>
        {students.length === 0 ? (
          <p className="meta">No student analytics available</p>
        ) : (
          <table className="striped">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s.user_id}>
                  <td>{s.user_id}</td>
                  <td>{s.name || s.username || 'student'}</td>
                  <td>{s.overall_score ?? 'n/a'}</td>
                  <td>
                    <button className="btn small" onClick={() => loadStudent(s.user_id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <aside className="card stack">
        <h3>Details / Skills</h3>
        {selected && studentDetail ? (
          <div className="stack">
            <pre>{JSON.stringify(studentDetail, null, 2)}</pre>
          </div>
        ) : (
          <div>
            <p className="meta">Select a student to view details.</p>
            <h4>Skills Summary</h4>
            {skills.length === 0 ? <p className="meta">No skills analytics</p> : (
              <ul>
                {skills.map((k: any) => (
                  <li key={k.skill_id}>{k.skill_name || k.name}: {k.avg_score ?? 'n/a'}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
