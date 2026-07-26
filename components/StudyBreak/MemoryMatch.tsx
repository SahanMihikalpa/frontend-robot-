import { useEffect, useState } from 'react'

type Card = { id: number; emoji: string }
const EMOJIS = ['🍎', '🌟', '🎈', '🚀', '🐱', '🌈', '🍕', '⚽']

function shuffledDeck(): Card[] {
  const deck = [...EMOJIS, ...EMOJIS].map((emoji, id) => ({ id, emoji }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** Classic memory / concentration — flip two cards, find all pairs. */
export default function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>(shuffledDeck)
  const [flipped, setFlipped] = useState<number[]>([])   // indices currently face-up (max 2)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [moves, setMoves] = useState(0)
  const done = matched.size === cards.length

  useEffect(() => {
    if (flipped.length !== 2) return
    setMoves((m) => m + 1)
    const [a, b] = flipped
    if (cards[a].emoji === cards[b].emoji) {
      setMatched((s) => new Set([...Array.from(s), a, b]))
      setFlipped([])
    } else {
      const t = setTimeout(() => setFlipped([]), 750)
      return () => clearTimeout(t)
    }
  }, [flipped, cards])

  function flip(i: number) {
    if (flipped.length === 2 || flipped.includes(i) || matched.has(i)) return
    setFlipped((f) => [...f, i])
  }
  function restart() { setCards(shuffledDeck()); setFlipped([]); setMatched(new Set()); setMoves(0) }

  return (
    <div className="break-game break-memory">
      <div className="break-hud">
        <span>Moves {moves}</span>
        {done ? <strong className="break-win">Solved! 🎉</strong> : <span className="meta">Find all pairs</span>}
        <button className="btn ghost small" onClick={restart}>{done ? '↺ Play again' : 'Start over'}</button>
      </div>
      <div className="break-memory-grid">
        {cards.map((c, i) => {
          const show = flipped.includes(i) || matched.has(i)
          return (
            <button
              key={c.id}
              className={`break-memory-card ${show ? 'flip' : ''} ${matched.has(i) ? 'done' : ''}`}
              onClick={() => flip(i)}
              aria-label={show ? c.emoji : 'hidden card'}
            >
              {show ? c.emoji : '❓'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
