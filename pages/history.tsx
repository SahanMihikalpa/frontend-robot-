import { useEffect, useMemo, useState } from 'react'
import { getCurrentUser, getMyInteractions } from '../lib/api'

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [activeSkill, setActiveSkill] = useState<string>('all')

  useEffect(() => {
    async function loadHistory() {
      const profile = await getCurrentUser()
      setUser(profile)
      const interactions = await getMyInteractions()
      setHistory(Array.isArray(interactions) ? interactions : interactions?.items || [])
    }

    loadHistory().catch(() => undefined)
  }, [])

  const skills = useMemo(() => {
    const values = new Set<string>()
    history.forEach((item) => {
      if (item.skill_name) values.add(String(item.skill_name))
      if (item.skill_id) values.add(String(item.skill_id))
    })
    return ['all', ...Array.from(values)]
  }, [history])

  const filteredHistory = activeSkill === 'all'
    ? history
    : history.filter((item) => String(item.skill_name || item.skill_id) === activeSkill)

  const correctCount = filteredHistory.filter((item) => item.is_correct).length
  const accuracy = filteredHistory.length ? (correctCount / filteredHistory.length) * 100 : 0

  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>History</h2>
            <p className="meta">Practice sessions and answer history.</p>
          </div>
          <span className="badge">{user?.username || 'Student'}</span>
        </div>

        <div className="grid-three">
          <div className="list-item"><p className="meta">Attempts</p><h3>{filteredHistory.length}</h3></div>
          <div className="list-item"><p className="meta">Correct</p><h3>{correctCount}</h3></div>
          <div className="list-item"><p className="meta">Accuracy</p><h3>{accuracy.toFixed(1)}%</h3></div>
        </div>

        <div className="chip-row">
          {skills.map((skill) => (
            <button
              key={skill}
              type="button"
              className={`chip ${activeSkill === skill ? 'active' : ''}`}
              onClick={() => setActiveSkill(skill)}
            >
              {skill === 'all' ? 'All skills' : skill}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="section-title">
          <h3>Interactions</h3>
          <span className="badge">{filteredHistory.length} records</span>
        </div>

        <div className="list">
          {filteredHistory.map((item) => (
            <div key={item.id || `${item.question_id}-${item.timestamp}`} className="list-item">
              <div className="row">
                <strong>{item.question_text || `Question ${item.question_id}`}</strong>
                <span className="badge" style={{ background: item.is_correct ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)', color: item.is_correct ? '#86efac' : '#fca5a5' }}>
                  {item.is_correct ? 'Correct' : 'Wrong'}
                </span>
              </div>
              <p className="meta">Skill: {item.skill_name || item.skill_id} · Time taken: {item.time_taken ?? 'n/a'}s</p>
              {item.timestamp && <p className="meta">{new Date(item.timestamp).toLocaleString()}</p>}
            </div>
          ))}

          {filteredHistory.length === 0 && <p className="meta">No interactions recorded yet.</p>}
        </div>
      </section>
    </div>
  )
}