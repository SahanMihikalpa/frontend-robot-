import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getConceptMap, getCurrentUser, getMasterySummary, getNextSkill, getUnlockedSkills } from '../lib/api'

// `dim`/`border` are real CSS colors (not a `var(--x)` string with a hex-alpha
// suffix bolted on — `var(--success)cc` isn't valid CSS and silently drops
// the whole declaration, which was why the pill tint and progress bar fill
// weren't rendering despite the percentage being correct).
const STATUS_CONFIG: Record<string, { label: string; color: string; dim: string; border: string }> = {
  mastered:   { label: 'Mastered', color: 'var(--success)', dim: 'var(--success-dim)', border: 'rgba(47,133,90,0.3)' },
  zpd:        { label: 'ZPD', color: 'var(--accent)', dim: 'var(--accent-dim)', border: 'rgba(232,90,51,0.3)' },
  in_zpd:     { label: 'ZPD', color: 'var(--accent)', dim: 'var(--accent-dim)', border: 'rgba(232,90,51,0.3)' },
  locked:     { label: 'Locked', color: 'var(--muted)', dim: 'rgba(92,87,79,0.1)', border: 'rgba(92,87,79,0.25)' },
  struggling: { label: 'Struggling', color: 'var(--danger)', dim: 'var(--danger-dim)', border: 'rgba(239,68,68,0.3)' },
}

function statusCfg(status: string) {
  return STATUS_CONFIG[status] || { label: status, color: 'var(--muted)', dim: 'rgba(92,87,79,0.1)', border: 'rgba(92,87,79,0.25)' }
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
  // Drop the decimal at exactly 100% so "100%" fits the fixed-width hero card
  // ("100.0%" overflows the 220px column at the 68px hero font size).
  const masteredLabel = masteredPct >= 100 ? '100' : masteredPct.toFixed(1)

  const statuses = useMemo(() => {
    const set = new Set<string>()
    conceptMap.forEach((s) => { if (s.status) set.add(s.status) })
    return ['all', ...Array.from(set)]
  }, [conceptMap])

  const filtered = filter === 'all'
    ? conceptMap
    : conceptMap.filter((s) => s.status === filter)

  return (
    <div className="teacher-dashboard student-dash mastery-page">
      <div className="teacher-layout">
        <section className="teacher-main">
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
              <strong>{masteredLabel}%</strong>
              <p>{summary?.total_skills ? `of ${summary.total_skills} skills` : 'across all skills'}</p>
            </div>
          </section>

          <div className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Mastered</p>
              <strong style={{ color: 'var(--success)' }}>{summary?.mastered_count ?? 0}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>ZPD (ready)</p>
              <strong style={{ color: 'var(--accent)' }}>{summary?.zpd_count ?? 0}</strong>
            </div>
            <div className="teacher-kpi-card">
              <p>Struggling</p>
              <strong style={{ color: 'var(--danger)' }}>{summary?.struggling_count ?? 0}</strong>
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
                            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                            color: cfg.color, background: cfg.dim, border: `1px solid ${cfg.border}`,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="teacher-skill-topline" style={{ marginTop: 6 }}>
                        <p>Mastery</p>
                        <span style={{ fontSize: 14, color: cfg.color, fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div className="teacher-progress">
                        <span style={{ width: `${pct}%` }} />
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
                  color: 'var(--muted)',
                  margin: 0
                }}
              >Next skill to practise</p>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 17 }}>
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
                  color: 'var(--muted)',
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
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{s.skill_name || `Skill ${s.skill_id}`}</span>
                    {s.unlocked_at && (
                      <span className="meta" style={{ fontSize: 12 }}>
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
