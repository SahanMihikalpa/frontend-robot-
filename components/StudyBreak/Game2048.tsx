import { useCallback, useEffect, useRef, useState } from 'react'

type Grid = number[][]
type Dir = 'l' | 'r' | 'u' | 'd'
const SIZE = 4

const emptyGrid = (): Grid => Array.from({ length: SIZE }, () => Array(SIZE).fill(0))

function spawn(g: Grid): Grid {
  const free: [number, number][] = []
  g.forEach((row, i) => row.forEach((v, j) => { if (!v) free.push([i, j]) }))
  if (!free.length) return g
  const [i, j] = free[Math.floor(Math.random() * free.length)]
  const ng = g.map((r) => r.slice())
  ng[i][j] = Math.random() < 0.9 ? 2 : 4
  return ng
}

function slideRow(row: number[]): [number[], number] {
  const a = row.filter((v) => v)
  let gained = 0
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] === a[i + 1]) { a[i] *= 2; gained += a[i]; a.splice(i + 1, 1) }
  }
  while (a.length < SIZE) a.push(0)
  return [a, gained]
}

const transpose = (g: Grid): Grid => g[0].map((_, j) => g.map((r) => r[j]))
const reverseRows = (g: Grid): Grid => g.map((r) => r.slice().reverse())

function move(g: Grid, dir: Dir): [Grid, number, boolean] {
  let work = g
  if (dir === 'u' || dir === 'd') work = transpose(work)
  if (dir === 'r' || dir === 'd') work = reverseRows(work)
  let gained = 0
  work = work.map((r) => { const [nr, gg] = slideRow(r); gained += gg; return nr })
  if (dir === 'r' || dir === 'd') work = reverseRows(work)
  if (dir === 'u' || dir === 'd') work = transpose(work)
  const moved = JSON.stringify(work) !== JSON.stringify(g)
  return [work, gained, moved]
}

const TILE_COLORS: Record<number, string> = {
  2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
  128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e',
}

/** Minimal 2048 — arrow keys on desktop, swipe on touch. */
export default function Game2048() {
  const [grid, setGrid] = useState<Grid>(() => spawn(spawn(emptyGrid())))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const gridRef = useRef(grid); gridRef.current = grid
  const overRef = useRef(over); overRef.current = over

  const doMove = useCallback((dir: Dir) => {
    if (overRef.current) return
    const [ng, gained, moved] = move(gridRef.current, dir)
    if (!moved) return
    const withNew = spawn(ng)
    setGrid(withNew)
    if (gained) setScore((s) => s + gained)
    const stuck = !(['l', 'r', 'u', 'd'] as Dir[]).some((d) => move(withNew, d)[2])
    if (stuck) setOver(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir | undefined> = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }
      const d = map[e.key]
      if (d) { e.preventDefault(); doMove(d) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'))
    touchStart.current = null
  }

  function restart() { setGrid(spawn(spawn(emptyGrid()))); setScore(0); setOver(false) }

  return (
    <div className="break-game break-2048">
      <div className="break-hud">
        <span>Score {score}</span>
        <button className="btn ghost small" onClick={restart}>{over ? '↺ Play again' : 'Start over'}</button>
      </div>
      <div className="break-2048-grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {grid.map((row, i) => row.map((v, j) => (
          <div
            key={`${i}-${j}`}
            className="break-2048-cell"
            style={{
              background: v ? (TILE_COLORS[v] || '#3c3a32') : 'rgba(238,228,218,0.35)',
              color: v && v <= 4 ? '#776e65' : '#f9f6f2',
              fontSize: v >= 1024 ? 20 : 26,
            }}
          >{v || ''}</div>
        )))}
      </div>
      <p className="meta break-game-hint">{over ? 'No moves left — Play again to reset' : 'Arrow keys or swipe to combine tiles'}</p>
    </div>
  )
}
