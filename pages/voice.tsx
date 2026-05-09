import { useEffect, useRef, useState } from 'react'
import { createVoiceSocket } from '../lib/api'

export default function VoicePage() {
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [transcript, setTranscript] = useState<string>('')
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)

  function append(l: string) {
    setLogs((s) => [l, ...s].slice(0, 200))
  }

  function connect() {
    const ws = createVoiceSocket('voice-session-' + Date.now()) as WebSocket | null
    if (!ws) {
      append('socket creation failed')
      return
    }
    wsRef.current = ws
    ws.onopen = () => {
      setConnected(true)
      append('ws: connected')
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const parsed = JSON.parse(ev.data)
          // backend may send partial/final transcript messages
          if (parsed.partial) {
            setTranscript(parsed.partial)
            append('partial: ' + parsed.partial)
            return
          }
          if (parsed.transcript) {
            setTranscript(parsed.transcript)
            setFinalTranscripts((s) => [parsed.transcript, ...s].slice(0, 50))
            append('transcript: ' + parsed.transcript)
            return
          }
          append('ws recv json: ' + JSON.stringify(parsed))
        } catch {
          append('ws recv: ' + ev.data)
        }
      } else {
        append('ws recv: [binary]')
      }
    }
    ws.onclose = () => {
      setConnected(false)
      append('ws: closed')
    }
    ws.onerror = (e) => append('ws: error')
  }

  function disconnect() {
    stopStreaming()
    wsRef.current?.close()
    wsRef.current = null
  }

  async function startStreaming() {
    if (!connected) {
      append('ws not connected')
      return
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      append('microphone not available')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRef.current = stream
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      procRef.current = processor

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0)
        const buffer = floatTo16BitPCM(input)
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(buffer)
          }
        } catch {
          // ignore send errors
        }
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)

      setStreaming(true)
      append('streaming started')
    } catch (err: any) {
      append('startStreaming failed: ' + (err?.message || err))
    }
  }

  function stopStreaming() {
    setStreaming(false)
    if (procRef.current) {
      try { procRef.current.disconnect() } catch {}
      procRef.current.onaudioprocess = null
      procRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch {}
      sourceRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach((t) => t.stop())
      mediaRef.current = null
    }
    append('streaming stopped')
  }

  function floatTo16BitPCM(float32Array: Float32Array) {
    const l = float32Array.length
    const buffer = new ArrayBuffer(l * 2)
    const view = new DataView(buffer)
    let offset = 0
    for (let i = 0; i < l; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buffer
  }

  useEffect(() => {
    return () => {
      stopStreaming()
      disconnect()
    }
  }, [])

  return (
    <div className="card stack">
      <h2>Voice</h2>
      <p className="meta">Connect to the voice websocket and stream microphone PCM16 frames.</p>
      <div className="row">
        <button className="btn" onClick={connect} disabled={connected}>Connect WS</button>
        <button className="btn" onClick={disconnect} disabled={!connected}>Disconnect WS</button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={startStreaming} disabled={!connected || streaming}>Start Microphone</button>
        <button className="btn" onClick={stopStreaming} disabled={!streaming}>Stop Microphone</button>
      </div>

      <section className="card stack" style={{ marginTop: 12 }}>
        <h3>Live Transcript</h3>
        <div style={{ minHeight: 48, padding: 8, background: '#0b1220', color: '#e6eef8', borderRadius: 6 }}>
          {transcript || <span className="meta">(waiting for speech)</span>}
        </div>
        <h4 style={{ marginTop: 8 }}>Previous</h4>
        <div style={{ maxHeight: 160, overflow: 'auto' }}>
          {finalTranscripts.map((t, i) => <div key={i} className="log-item">{t}</div>)}
        </div>
      </section>

      <section className="logs">
        {logs.map((l, i) => <div key={i} className="log-item">{l}</div>)}
      </section>
    </div>
  )
}
