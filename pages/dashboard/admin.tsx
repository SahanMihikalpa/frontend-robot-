import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHardwareStatus, getKnowledgeStats, listStudentsAnalytics } from '../../lib/api'

function StatusBadge({ active }: { active: boolean | undefined }) {
  if (active == null) return <span className="admin-status-badge neutral">Unknown</span>
  return active ? <span className="admin-status-badge success">Online</span> : <span className="admin-status-badge danger">Offline</span>
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
      } catch { /* ignore - KB may not have documents yet */ }
    }
    load()
  }, [])

  const camActive = hardware?.camera_active ?? hardware?.camera?.active
  const micActive = hardware?.microphone_active ?? hardware?.microphone?.active
  const spkActive = hardware?.speaker_active ?? hardware?.speaker?.active
  const devicesOnline = [camActive, micActive, spkActive].filter(Boolean).length

  return (
    <div className="admin-dashboard student-dash">
      <section className="teacher-hero admin-hero">
        <div>
          <p className="teacher-eyebrow">Operations</p>
          <h2 className="editorial-title">Admin Dashboard</h2>
          <p>Monitor system health, hardware availability, classroom activity, and knowledge-base coverage from one operations view.</p>
        </div>
        <div className="teacher-hero-note">
          <span>Platform</span>
          <strong>{students.length}</strong>
          <p>tracked students</p>
        </div>
      </section>

      {error && <p className="feedback error">{error}</p>}

      <div className="teacher-layout">
        <section className="teacher-main">
          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Tracked students</p>
              <strong>{students.length}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>KB documents</p>
              <strong>{kbStats?.total_documents ?? '-'}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>KB chunks</p>
              <strong>{kbStats?.total_chunks ?? '-'}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>Hardware online</p>
              <strong style={{ color: devicesOnline < 3 ? 'var(--warning)' : 'var(--success)' }}>{devicesOnline}/3</strong>
            </div>
          </div>

          <section className="teacher-panel admin-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Hardware</p>
                <h3 className="editorial-title">Device status</h3>
              </div>
              <Link href="/hardware" className="teacher-text-link">Open control</Link>
            </div>

            <div className="admin-device-grid">
              {[
                { label: 'Camera', active: camActive },
                { label: 'Microphone', active: micActive },
                { label: 'Speaker', active: spkActive },
              ].map(({ label, active }) => (
                <div key={label} className="admin-device-card">
                  <div>
                    <span className={`admin-device-dot ${active ? 'online' : 'offline'}`} />
                    <strong>{label}</strong>
                  </div>
                  <StatusBadge active={active} />
                </div>
              ))}
            </div>
          </section>

          <section className="teacher-panel admin-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Classroom</p>
                <h3 className="editorial-title">Recent students</h3>
              </div>
              <Link href="/analytics" className="teacher-text-link">Full analytics</Link>
            </div>

            <div className="teacher-table-wrap">
              <table className="teacher-table admin-students-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={2} className="teacher-empty-cell">No students</td></tr>
                  ) : students.slice(0, 8).map((s: any, idx: number) => (
                    <tr key={s.user_id || s.id || idx}>
                      <td>{s.name || s.username || s.full_name || `Student ${idx + 1}`}</td>
                      <td>{s.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="teacher-actions admin-actions">
          <p className="teacher-eyebrow">Workspace</p>
          <h3 className="editorial-title">Quick actions</h3>

          <div className="teacher-action-list">
            <Link href="/dashboard/users" className="teacher-action primary">
              <span>01</span>
              User management
            </Link>
            <Link href="/hardware" className="teacher-action">
              <span>02</span>
              Hardware control
            </Link>
            <Link href="/voice" className="teacher-action">
              <span>03</span>
              Voice pipeline
            </Link>
            <Link href="/knowledge" className="teacher-action">
              <span>04</span>
              Knowledge base
            </Link>
            <Link href="/analytics" className="teacher-action">
              <span>05</span>
              Full analytics
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
