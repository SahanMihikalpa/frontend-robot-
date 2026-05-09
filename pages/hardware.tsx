import { useEffect, useState } from 'react'
import { getHardwareStatus, startCamera, stopCamera, getCameraSnapshot } from '../lib/api'

export default function HardwarePage() {
  const [status, setStatus] = useState<any>(null)
  const [snapshot, setSnapshot] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const s = await getHardwareStatus()
      setStatus(s)
    } catch (e) {
      setError('Failed to get status')
    }
  }

  async function handleStartCamera() {
    setError('')
    try {
      await startCamera()
      await refresh()
    } catch {
      setError('Start camera failed')
    }
  }

  async function handleStopCamera() {
    setError('')
    try {
      await stopCamera()
      await refresh()
    } catch {
      setError('Stop camera failed')
    }
  }

  async function grabSnapshot() {
    setError('')
    try {
      const data = await getCameraSnapshot()
      setSnapshot(data?.image_base64 || '')
    } catch {
      setError('Snapshot failed')
    }
  }

  return (
    <div className="grid-two">
      <section className="card stack">
        <h2>Hardware Status</h2>
        <div className="meta">
          <pre>{JSON.stringify(status || {}, null, 2)}</pre>
        </div>
        <div className="row">
          <button className="btn" onClick={handleStartCamera}>Start Camera</button>
          <button className="btn" onClick={handleStopCamera}>Stop Camera</button>
          <button className="btn" onClick={grabSnapshot}>Get Snapshot</button>
        </div>
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
      </section>

      <aside className="card stack">
        <h3>Snapshot</h3>
        {snapshot ? <img src={`data:image/jpeg;base64,${snapshot}`} alt="snapshot" style={{ maxWidth: '100%' }} /> : <p className="meta">No snapshot</p>}
      </aside>
    </div>
  )
}
