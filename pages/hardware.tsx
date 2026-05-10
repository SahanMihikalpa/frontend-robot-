import { useEffect, useState } from 'react'
import {
  getHardwareStatus, startCamera, stopCamera, getCameraSnapshot,
  startMicrophone, stopMicrophone,
} from '../lib/api'

function StatusBadge({ active }: { active: boolean | undefined }) {
  if (active == null) return <span className="badge neutral">Unknown</span>
  return active
    ? <span className="badge success">Online</span>
    : <span className="badge danger">Offline</span>
}

function ComponentCard({
  title, active, children,
}: { title: string; active: boolean | undefined; children?: React.ReactNode }) {
  return (
    <div className="list-item">
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${active ? 'online' : 'offline'}`} />
          <strong>{title}</strong>
        </div>
        <StatusBadge active={active} />
      </div>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
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

  return (
    <div className="grid-two" style={{ alignItems: 'start' }}>
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Hardware</h2>
            <p className="meta">Control robot hardware components.</p>
          </div>
          <button type="button" className="btn secondary small" onClick={refresh} disabled={busy}>
            Refresh
          </button>
        </div>

        {error && <p className="feedback error">{error}</p>}

        <div className="list">
          <ComponentCard title="Camera" active={camActive}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn small"
                disabled={busy || camActive === true}
                onClick={() => act(startCamera, 'Start camera')}
              >
                Start
              </button>
              <button
                type="button"
                className="btn small secondary"
                disabled={busy || camActive === false}
                onClick={() => act(stopCamera, 'Stop camera')}
              >
                Stop
              </button>
              <button
                type="button"
                className="btn small secondary"
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
                className="btn small"
                disabled={busy || micActive === true}
                onClick={() => act(() => startMicrophone(), 'Start microphone')}
              >
                Start
              </button>
              <button
                type="button"
                className="btn small secondary"
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

      <aside className="card stack">
        <h3 style={{ margin: 0 }}>Camera snapshot</h3>
        {snapshot ? (
          <div className="video-wrap">
            <img
              src={`data:image/jpeg;base64,${snapshot}`}
              alt="Camera snapshot"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        ) : (
          <div className="empty-state">
            <p>No snapshot.</p>
            <p className="meta">Start the camera then click Snapshot.</p>
          </div>
        )}

        {status && (
          <div className="stack" style={{ marginTop: 8 }}>
            <h4 style={{ margin: 0 }}>Status details</h4>
            <div className="list-item" style={{ padding: '10px 12px' }}>
              <pre style={{ margin: 0, fontSize: 11 }}>{JSON.stringify(status, null, 2)}</pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
