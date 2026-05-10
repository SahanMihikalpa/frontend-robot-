import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getConceptMap, getCurrentUser, getMasterySummary, getNextSkill, getUnlockedSkills } from '../lib/api'

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  mastered: { label: 'Mastered', color: '#4ade80', badgeClass: 'success' },
  zpd:      { label: 'ZPD', color: '#7dd3fc', badgeClass: '' },
  in_zpd:   { label: 'ZPD', color: '#7dd3fc', badgeClass: '' },
  locked:   { label: 'Locked', color: '#64748b', badgeClass: 'neutral' },
  struggling: { label: 'Struggling', color: '#f87171', badgeClass: 'danger' },
}

function statusCfg(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: '#94a3b8', badgeClass: 'neutral' }
}

export default function MasteryPage() {
  const [user, setUser] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [conceptMap, setConceptMap] = useState<any[]>([])
  const [nextSkill, setNextSkill] = useState<any>(null)
  const [unlockedSkills, setUnlockedSkills] = useState<any[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser()
        setUser(u)
        if (!u?.id) return
        const [s, cm, ns, us] = await Promise.all([
          getMasterySummary(u.id),
          getConceptMap(u.id),
          getNextSkill(u.id),
          getUnlockedSkills(u.id),
        ])
        setSummary(s)
        setConceptMap(Array.isArray(cm) ? cm : [])
        setNextSkill(ns)
        setUnlockedSkills(Array.isArray(us) ? us : [])
      } catch { /* ignore */ }
    }
    load()
  }, [])

  const masteredPct = Math.min(Number(summary?.mastered_pct || 0), 100)

  const statuses = useMemo(() => {
    const set = new Set<string>()
    conceptMap.forEach((s) => { if (s.status) set.add(s.status) })
    return ['all', ...Array.from(set)]
  }, [conceptMap])

  const filtered = filter === 'all'
    ? conceptMap
    : conceptMap.filter((s) => s.status === filter)

  return (
    <div className="stack">
      {/* Summary row */}
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Mastery</h2>
            <p className="meta">BKT concept map and skill progress.</p>
          </div>
          <span className="badge">{user?.full_name || user?.username || 'Student'}</span>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">Mastered</p>
            <p className="kpi-value" style={{ color: '#4ade80' }}>{summary?.mastered_count ?? 0}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">ZPD (ready)</p>
            <p className="kpi-value" style={{ color: '#7dd3fc' }}>{summary?.zpd_count ?? 0}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Struggling</p>
            <p className="kpi-value" style={{ color: '#f87171' }}>{summary?.struggling_count ?? 0}</p>
          </div>
        </div>

        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <strong>Overall mastery</strong>
            <span className="meta">
              {masteredPct.toFixed(1)}%
              {summary?.total_skills ? ` of ${summary.total_skills} skills` : ''}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${masteredPct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid-two" style={{ alignItems: 'start' }}>
        <section className="card stack">
          <div className="section-title">
            <h3>Concept map</h3>
            <span className="badge neutral">{filtered.length} skills</span>
          </div>

          {/* Status filter chips */}
          <div className="chip-row">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${filter === s ? 'active' : ''}`}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'All' : statusCfg(s).label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state"><p className="meta">No skills match this filter.</p></div>
          ) : (
            <div className="list">
              {filtered.map((skill: any) => {
                const cfg = statusCfg(skill.status)
                const pct = Math.min(Math.round((skill.p_mastery || skill.mastery_probability || 0) * 100), 100)
                return (
                  <div key={skill.skill_id} className="list-item">
                    <div className="row">
                      <strong>{skill.skill_name || `Skill ${skill.skill_id}`}</strong>
                      <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
                    </div>
                    <div className="row" style={{ marginTop: 8, marginBottom: 4 }}>
                      <p className="meta">Mastery</p>
                      <span style={{ fontSize: 12, color: cfg.color }}>{pct}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <aside className="card stack">
          <h3 style={{ margin: 0 }}>Recommendations</h3>

          {nextSkill && (
            <div className="list-item">
              <p className="meta">Next skill to practise</p>
              <strong style={{ fontSize: 15 }}>{nextSkill.skill_name || `Skill ${nextSkill.skill_id}`}</strong>
              {nextSkill.reason && <p className="meta" style={{ marginTop: 4 }}>{nextSkill.reason}</p>}
              <Link href="/practice" className="btn small" style={{ marginTop: 10, display: 'inline-flex' }}>
                Practice now →
              </Link>
            </div>
          )}

          {unlockedSkills.length > 0 && (
            <div className="stack">
              <h4 style={{ margin: 0 }}>Unlocked skills ({unlockedSkills.length})</h4>
              <div className="list">
                {unlockedSkills.slice(0, 6).map((s: any, i: number) => (
                  <div key={s.skill_id || i} className="list-item" style={{ padding: '8px 12px' }}>
                    <div className="row">
                      <span style={{ fontSize: 13 }}>{s.skill_name || `Skill ${s.skill_id}`}</span>
                      {s.unlocked_at && (
                        <span className="meta" style={{ fontSize: 11 }}>
                          {new Date(s.unlocked_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!nextSkill && unlockedSkills.length === 0 && (
            <div className="empty-state">
              <p className="meta">Complete some practice sessions to unlock recommendations.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
