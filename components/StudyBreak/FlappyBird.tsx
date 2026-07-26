import { useEffect, useRef, useState } from 'react'

type Pipe = { x: number; gap: number; passed?: boolean }
type Phase = 'ready' | 'playing' | 'dead'

const W = 320, H = 460
const STEP_MS = 1000 / 60          // fixed physics step → same speed on 60/120/144 Hz screens
// Gentle, forgiving physics (this is a study break, not a boss fight).
const GRAV = 0.38, FLAP = -6.9, PIPE_W = 56, GAP = 150, SPEED = 2.1, BIRD_X = 66, BIRD_R = 11
const PIPE_SPACING = 190            // horizontal px between pipes (bigger = easier)
const GROUND = 14
const randGap = () => 50 + Math.random() * (H - 120 - GAP)   // top of the opening

/** Tiny self-contained Flappy Bird — canvas + a fixed-timestep loop so it plays the
 *  same regardless of the monitor's refresh rate. */
export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')

  const phaseRef = useRef<Phase>('ready'); phaseRef.current = phase
  const birdY = useRef(H / 2)
  const birdV = useRef(0)
  const pipes = useRef<Pipe[]>([])
  const scoreRef = useRef(0)

  function reset() {
    birdY.current = H / 2
    birdV.current = 0
    pipes.current = [{ x: W + 80, gap: randGap() }]
    scoreRef.current = 0
    setScore(0)
  }

  function flap() {
    if (phaseRef.current === 'ready' || phaseRef.current === 'dead') { reset(); setPhase('playing') }
    birdV.current = FLAP
  }

  function startOver() { reset(); setPhase('ready') }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    reset()
    let raf = 0
    let last = performance.now()
    let acc = 0

    const die = () => {
      setPhase('dead')
      setBest((b) => Math.max(b, scoreRef.current))
    }

    const update = () => {
      birdV.current += GRAV
      birdY.current += birdV.current
      for (const p of pipes.current) p.x -= SPEED

      const lastPipe = pipes.current[pipes.current.length - 1]
      if (lastPipe && lastPipe.x <= W - PIPE_SPACING) pipes.current.push({ x: W, gap: randGap() })
      pipes.current = pipes.current.filter((p) => p.x + PIPE_W > -4)

      for (const p of pipes.current) {
        if (!p.passed && p.x + PIPE_W < BIRD_X) { p.passed = true; scoreRef.current += 1; setScore(scoreRef.current) }
        const withinX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W
        if (withinX && (birdY.current - BIRD_R < p.gap || birdY.current + BIRD_R > p.gap + GAP)) die()
      }
      if (birdY.current > H - GROUND - BIRD_R || birdY.current < 0) die()
    }

    const draw = () => {
      ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#4caf50'
      for (const p of pipes.current) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gap)
        ctx.fillRect(p.x, p.gap + GAP, PIPE_W, H - (p.gap + GAP))
      }
      ctx.fillStyle = '#ded895'; ctx.fillRect(0, H - GROUND, W, GROUND)
      ctx.fillStyle = '#ffde00'
      ctx.beginPath(); ctx.arc(BIRD_X, birdY.current, BIRD_R, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#333'
      ctx.beginPath(); ctx.arc(BIRD_X + 4, birdY.current - 4, 2.4, 0, Math.PI * 2); ctx.fill()
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      acc += now - last
      last = now
      if (acc > 200) acc = 200          // don't spiral after a tab switch / stall
      while (acc >= STEP_MS) {
        if (phaseRef.current === 'playing') update()
        acc -= STEP_MS
      }
      draw()
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="break-game">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={flap}
        className="break-canvas"
        role="button"
        aria-label="Flappy Bird — click or press space to flap"
      />
      <div className="break-game-hud"><span>Score {score}</span><span>Best {best}</span></div>
      <div className="break-game-controls">
        <span className="meta break-game-hint">
          {phase === 'ready' ? 'Click or press Space to flap' : phase === 'playing' ? 'Keep flapping!' : `Game over — score ${score}`}
        </span>
        <button className="btn ghost small" onClick={startOver}>{phase === 'dead' ? '↺ Play again' : 'Start over'}</button>
      </div>
    </div>
  )
}
