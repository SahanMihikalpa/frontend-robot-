import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  getHardwareStatus, startCamera, stopCamera, getCameraSnapshot,
  startMicrophone, stopMicrophone,
} from '../lib/api'

function StatusPill({ active }: { active: boolean | undefined }) {
  if (active == null) {
    return (
      <span style={{
        fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
        color: 'var(--muted)', background: 'rgba(107,107,104,0.1)', border: '1px solid rgba(107,107,104,0.3)',
      }}>Unknown</span>
    )
  }
  return active
    ? <span style={{
        fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
        color: 'var(--success)', background: 'var(--success-dim)', border: '1px solid rgba(22,163,74,0.3)',
      }}>Online</span>
    : <span style={{
        fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 999,
        color: 'var(--danger)', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.3)',
      }}>Offline</span>
}

function ComponentCard({
  title, active, children,
}: { title: string; active: boolean | undefined; children?: React.ReactNode }) {
  const dotColor = active == null ? 'var(--muted)' : active ? 'var(--success)' : 'var(--danger)'
  return (
    <div className="teacher-skill-row">
      <div className="teacher-skill-topline">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block',
          }} />
          <strong style={{ color: 'var(--text)' }}>{title}</strong>
        </div>
        <StatusPill active={active} />
      </div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

export default function HardwarePage() {
  const [status, setStatus] = useState<any>(null)
  const [snapshot, setSnapshot] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const s = await getHardwareStatus()
      setStatus(s)
    } catch {
      setError('Failed to fetch hardware status')
    }
  }

  useEffect(() => { refresh() }, [])

  async function act(fn: () => Promise<any>, label: string) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch {
      setError(`${label} failed`)
    } finally {
      setBusy(false)
    }
  }

  async function grabSnapshot() {
    setBusy(true)
    setError('')
    try {
      const data = await getCameraSnapshot()
      setSnapshot(data?.image_base64 || data?.frame || '')
      if (!data?.image_base64 && !data?.frame) setError('No image returned from camera')
    } catch {
      setError('Snapshot failed')
    } finally {
      setBusy(false)
    }
  }

  const camActive = status?.camera_active ?? status?.camera?.active
  const micActive = status?.microphone_active ?? status?.microphone?.active
  const spkActive = status?.speaker_active ?? status?.speaker?.active
  const devicesOnline = [camActive, micActive, spkActive].filter(Boolean).length

  return (
    <div className="teacher-dashboard student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Robot Control</p>
          <h2 className="editorial-title">Hardware</h2>
          <p>Monitor and control camera, microphone, and speaker components.</p>
        </div>
        <div className="teacher-hero-note">
          <span>Devices</span>
          <strong>{devicesOnline}/3</strong>
          <p>online now</p>
        </div>
      </section>

      <div className="teacher-roster-nav">
        <Link href="/dashboard/admin" className="teacher-action primary">
          <span>01</span>
          Admin Dashboard
        </Link>
        <Link href="/voice" className="teacher-action">
          <span>02</span>
          Voice Pipeline
        </Link>
      </div>

      <section className="teacher-kpi-grid">
        <div className="teacher-kpi-card">
          <p>Camera</p>
          <strong style={{ color: camActive == null ? 'var(--muted)' : camActive ? 'var(--success)' : 'var(--danger)' }}>
            {camActive == null ? 'Unknown' : camActive ? 'Online' : 'Offline'}
          </strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Microphone</p>
          <strong style={{ color: micActive == null ? 'var(--muted)' : micActive ? 'var(--success)' : 'var(--danger)' }}>
            {micActive == null ? 'Unknown' : micActive ? 'Online' : 'Offline'}
          </strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Speaker</p>
          <strong style={{ color: spkActive == null ? 'var(--muted)' : spkActive ? 'var(--success)' : 'var(--danger)' }}>
            {spkActive == null ? 'Unknown' : spkActive ? 'Online' : 'Offline'}
          </strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Devices online</p>
          <strong style={{ color: devicesOnline < 3 ? 'var(--warning)' : 'var(--success)' }}>{devicesOnline}/3</strong>
        </div>
      </section>

      <div className="teacher-layout">
        <section className="teacher-main">
          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Components</p>
                <h3 className="editorial-title">Hardware status</h3>
              </div>
              <button type="button" className="skills-action primary" onClick={refresh} disabled={busy}>
                Refresh
              </button>
            </div>

            {error && <p className="feedback error">{error}</p>}

            <div className="teacher-skill-list">
              <ComponentCard title="Camera" active={camActive}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="skills-mini-action"
                    disabled={busy || camActive === true}
                    onClick={() => act(startCamera, 'Start camera')}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className="skills-mini-action"
                    disabled={busy || camActive === false}
                    onClick={() => act(stopCamera, 'Stop camera')}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    className="skills-mini-action"
                    disabled={busy || !camActive}
                    onClick={grabSnapshot}
                  >
                    Snapshot
                  </button>
                </div>
              </ComponentCard>

              <ComponentCard title="Microphone" active={micActive}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="skills-mini-action"
                    disabled={busy || micActive === true}
                    onClick={() => act(() => startMicrophone(), 'Start microphone')}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className="skills-mini-action"
                    disabled={busy || micActive === false}
                    onClick={() => act(stopMicrophone, 'Stop microphone')}
                  >
                    Stop
                  </button>
                </div>
              </ComponentCard>

              <ComponentCard title="Speaker" active={spkActive} />
            </div>
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Live View</p>
          <h3 className="editorial-title">Camera snapshot</h3>

          {snapshot ? (
            <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img
                src={`data:image/jpeg;base64,${snapshot}`}
                alt="Camera snapshot"
                style={{ width: '100%', display: 'block' }}
              />
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 16 }}>
              <p style={{ color: 'var(--text)', margin: 0 }}>No snapshot.</p>
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
                Start the camera then click Snapshot.
              </p>
            </div>
          )}

          {status && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <p
                style={{
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 12,
                  color: 'var(--muted)',
                  margin: '0 0 10px'
                }}
              >Status details</p>
              <div style={{
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--bg)', border: '1px solid var(--border)',
                maxHeight: 280, overflow: 'auto',
              }}>
                <pre style={{ margin: 0, fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(status, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
