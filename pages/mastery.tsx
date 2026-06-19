import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getConceptMap, getCurrentUser, getMasterySummary, getNextSkill, getUnlockedSkills } from '../lib/api'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  mastered: { label: 'Mastered', color: '#1F4D3A' },
  zpd:      { label: 'ZPD', color: '#C85B43' },
  in_zpd:   { label: 'ZPD', color: '#C85B43' },
  locked:   { label: 'Locked', color: '#726A61' },
  struggling: { label: 'Struggling', color: '#A63D40' },
}

function statusCfg(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: '#726A61' }
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
    <div className="teacher-dashboard">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">BKT Concept Map</p>
          <h2 className="editorial-title">Mastery</h2>
          <p>
            Track skill progress and mastery probability across your learning path.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Overall mastery</span>
          <strong>{masteredPct.toFixed(1)}%</strong>
          <p>{summary?.total_skills ? `of ${summary.total_skills} skills` : 'across all skills'}</p>
        </div>
      </section>

      <div className="teacher-layout">
        <section className="teacher-main">
          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Mastered</p>
              <strong style={{ color: '#1F4D3A' }}>{summary?.mastered_count ?? 0}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>ZPD (ready)</p>
              <strong style={{ color: '#C85B43' }}>{summary?.zpd_count ?? 0}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>Struggling</p>
              <strong style={{ color: '#A63D40' }}>{summary?.struggling_count ?? 0}</strong>
            </div>
          </div>

          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Concept Map</p>
                <h3 className="editorial-title">Skill breakdown</h3>
              </div>
              <span className="teacher-text-link" style={{ cursor: 'default' }}>
                {filtered.length} skills
              </span>
            </div>

            {/* Status filter chips */}
            <div className="skills-chip-row" style={{ marginBottom: 20 }}>
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`skills-chip ${filter === s ? 'active' : ''}`}
                  onClick={() => setFilter(s)}
                  style={{ borderRadius: 8 }}
                >
                  {s === 'all' ? 'All' : statusCfg(s).label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state"><p style={{ color: 'var(--muted)', margin: 0 }}>No skills match this filter.</p></div>
            ) : (
              <div className="teacher-skill-list">
                {filtered.map((skill: any) => {
                  const cfg = statusCfg(skill.status)
                  const pct = Math.min(Math.round((skill.p_mastery || skill.mastery_probability || 0) * 100), 100)
                  return (
                    <div key={skill.skill_id} className="teacher-skill-row">
                      <div className="teacher-skill-topline">
                        <p style={{ fontWeight: 600, color: 'var(--text)' }}>{skill.skill_name || `Skill ${skill.skill_id}`}</p>
                        <span
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                            color: cfg.color, background: `${cfg.color}1A`, border: `1px solid ${cfg.color}4D`,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="teacher-skill-topline" style={{ marginTop: 6 }}>
                        <p>Mastery</p>
                        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div className="teacher-progress">
                        <span style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}cc)` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </section>

        <aside className="teacher-actions">
          <p className="teacher-eyebrow">Recommendations</p>
          <h3 className="editorial-title">What's next</h3>

          {nextSkill && (
            <div style={{ marginTop: 16, paddingBottom: 20, borderBottom: unlockedSkills.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <p
                style={{
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  color: '#726A61',
                  margin: 0
                }}
              >Next skill to practise</p>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 16 }}>
                {nextSkill.skill_name || `Skill ${nextSkill.skill_id}`}
              </strong>
              {nextSkill.reason && (
                <p className="meta" style={{ marginTop: 6 }}>{nextSkill.reason}</p>
              )}
              <Link
                href="/practice"
                className="teacher-action primary"
                style={{ marginTop: 14, display: 'inline-flex', minHeight: 'unset', padding: '10px 20px' }}
              >
                Practice now →
              </Link>
            </div>
          )}

          {unlockedSkills.length > 0 && (
            <div style={{ marginTop: nextSkill ? 20 : 16 }}>
              <p
                style={{
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  color: '#726A61',
                  margin: '0 0 12px'
                }}
              >
                Unlocked skills ({unlockedSkills.length})
              </p>
              <div className="teacher-action-list" style={{ gap: 0 }}>
                {unlockedSkills.slice(0, 6).map((s: any, i: number) => (
                  <div
                    key={s.skill_id || i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: i < Math.min(unlockedSkills.length, 6) - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{s.skill_name || `Skill ${s.skill_id}`}</span>
                    {s.unlocked_at && (
                      <span className="meta" style={{ fontSize: 11 }}>
                        {new Date(s.unlocked_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!nextSkill && unlockedSkills.length === 0 && (
            <div className="empty-state" style={{ marginTop: 16 }}>
              <p style={{ color: 'var(--muted)', margin: 0 }}>Complete some practice sessions to unlock recommendations.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
