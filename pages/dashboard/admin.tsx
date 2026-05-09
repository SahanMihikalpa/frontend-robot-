import { useEffect, useState } from 'react'
import { getHardwareStatus, listStudentsAnalytics } from '../../lib/api'

function boolText(value: unknown) {
  if (typeof value !== 'boolean') {
    return 'Unknown'
  }
  return value ? 'Online' : 'Offline'
}

export default function AdminDashboard() {
  const [hardware, setHardware] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [hardwareState, studentRows] = await Promise.all([
          getHardwareStatus(),
          listStudentsAnalytics(),
        ])
        setHardware(hardwareState)
        setStudents(Array.isArray(studentRows) ? studentRows : [])
      } catch {
        setError('Unable to load admin dashboard data')
      }
    }

    load()
  }, [])

  return (
    <div className="grid">
      <section className="card stack">
        <h2>Admin Dashboard</h2>
        <p className="muted">System health, hardware status, and platform overview.</p>
        {error && <p style={{ color: '#ffb4b4' }}>{error}</p>}

        <div className="kpi-grid">
          <article className="kpi-card">
            <p className="kpi-label">Tracked students</p>
            <p className="kpi-value">{students.length}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">Camera</p>
            <p className="kpi-value">{boolText(hardware?.camera_active ?? hardware?.camera?.active)}</p>
          </article>
          <article className="kpi-card">
            <p className="kpi-label">Microphone</p>
            <p className="kpi-value">{boolText(hardware?.microphone_active ?? hardware?.microphone?.active)}</p>
          </article>
        </div>

        <h4>Hardware Status</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Camera</td>
                <td>{boolText(hardware?.camera_active ?? hardware?.camera?.active)}</td>
              </tr>
              <tr>
                <td>Microphone</td>
                <td>{boolText(hardware?.microphone_active ?? hardware?.microphone?.active)}</td>
              </tr>
              <tr>
                <td>Speaker</td>
                <td>{boolText(hardware?.speaker_active ?? hardware?.speaker?.active)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside className="card stack">
        <h4>Platform Snapshot</h4>
        <p className="muted">Recent users in analytics dataset.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 10).map((s, idx) => (
                <tr key={s.user_id || s.id || idx}>
                  <td>{s.name || s.username || `Student ${idx + 1}`}</td>
                  <td>{s.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  )
}
