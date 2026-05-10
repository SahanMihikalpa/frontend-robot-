import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHardwareStatus, getKnowledgeStats, listStudentsAnalytics } from '../../lib/api'

function StatusBadge({ active }: { active: boolean | undefined }) {
  if (active == null) return <span className="badge neutral">Unknown</span>
  return active ? <span className="badge success">Online</span> : <span className="badge danger">Offline</span>
}

export default function AdminDashboard() {
  const [hardware, setHardware] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [kbStats, setKbStats] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [hw, st] = await Promise.all([getHardwareStatus(), listStudentsAnalytics()])
        setHardware(hw)
        setStudents(Array.isArray(st) ? st : [])
      } catch {
        setError('Unable to load admin dashboard data')
      }
      try {
        const kb = await getKnowledgeStats()
        setKbStats(kb)
      } catch { /* ignore — KB may not have documents yet */ }
    }
    load()
  }, [])

  const camActive = hardware?.camera_active ?? hardware?.camera?.active
  const micActive = hardware?.microphone_active ?? hardware?.microphone?.active
  const spkActive = hardware?.speaker_active ?? hardware?.speaker?.active

  return (
    <div className="grid">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Admin Dashboard</h2>
            <p className="meta">System health, hardware status, and platform overview.</p>
          </div>
        </div>

        {error && <p className="feedback error">{error}</p>}

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Tracked students</p>
            <p className="kpi-value">{students.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">KB documents</p>
            <p className="kpi-value">{kbStats?.total_documents ?? '—'}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">KB chunks</p>
            <p className="kpi-value">{kbStats?.total_chunks ?? '—'}</p>
          </div>
        </div>

        <h4 style={{ margin: 0 }}>Hardware status</h4>
        <div className="list">
          {[
            { label: 'Camera', active: camActive },
            { label: 'Microphone', active: micActive },
            { label: 'Speaker', active: spkActive },
          ].map(({ label, active }) => (
            <div key={label} className="list-item">
              <div className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`status-dot ${active ? 'online' : 'offline'}`} />
                  <strong>{label}</strong>
                </div>
                <StatusBadge active={active} />
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ margin: 0 }}>Recent students</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--muted)' }}>No students</td></tr>
              ) : students.slice(0, 8).map((s: any, idx: number) => (
                <tr key={s.user_id || s.id || idx}>
                  <td>{s.name || s.username || s.full_name || `Student ${idx + 1}`}</td>
                  <td>{s.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Quick actions</h3>
        <div className="list">
          <div className="list-item">
            <Link href="/hardware" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
              Hardware control
            </Link>
          </div>
          <div className="list-item">
            <Link href="/voice" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Voice pipeline
            </Link>
          </div>
          <div className="list-item">
            <Link href="/knowledge" className="btn secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Knowledge base
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
