import { useEffect, useMemo, useState } from 'react'
import { getConceptMap, getCurrentUser, getMasterySummary, getNextSkill, getUnlockedSkills } from '../lib/api'

export default function MasteryPage() {
  const [user, setUser] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [conceptMap, setConceptMap] = useState<any[]>([])
  const [nextSkill, setNextSkill] = useState<any>(null)
  const [unlockedSkills, setUnlockedSkills] = useState<any[]>([])

  useEffect(() => {
    async function loadMastery() {
      const profile = await getCurrentUser()
      setUser(profile)
      if (!profile?.id) return

      const [summaryData, conceptMapData, nextSkillData, unlockedData] = await Promise.all([
        getMasterySummary(profile.id),
        getConceptMap(profile.id),
        getNextSkill(profile.id),
        getUnlockedSkills(profile.id),
      ])

      setSummary(summaryData)
      setConceptMap(Array.isArray(conceptMapData) ? conceptMapData : [])
      setNextSkill(nextSkillData)
      setUnlockedSkills(Array.isArray(unlockedData) ? unlockedData : [])
    }

    loadMastery().catch(() => undefined)
  }, [])

  const masteredPct = Number(summary?.mastered_pct || 0)
  const totalSkills = summary?.total_skills || 0

  const masteryCards = useMemo(() => [
    { label: 'Mastered', value: summary?.mastered_count ?? 0 },
    { label: 'ZPD', value: summary?.zpd_count ?? 0 },
    { label: 'Locked', value: summary?.locked_count ?? 0 },
    { label: 'Struggling', value: summary?.struggling_count ?? 0 },
  ], [summary])

  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Mastery</h2>
            <p className="meta">BKT concept map and mastery progress.</p>
          </div>
          <span className="badge">{user?.username || 'Student'}</span>
        </div>

        <div className="grid-three">
          {masteryCards.map((card) => (
            <div key={card.label} className="list-item">
              <p className="meta">{card.label}</p>
              <h3 style={{ margin: '6px 0 0' }}>{card.value}</h3>
            </div>
          ))}
        </div>

        <div className="list-item">
          <div className="row" style={{ marginBottom: 10 }}>
            <strong>Overall mastery</strong>
            <span className="meta">{masteredPct.toFixed(1)}% of {totalSkills} skills</span>
          </div>
          <div className="progress">
            <span style={{ width: `${Math.min(masteredPct, 100)}%` }} />
          </div>
        </div>
      </section>

      <div className="grid-two">
        <section className="card stack">
          <div className="section-title">
            <h3>Concept map</h3>
            <span className="badge">{conceptMap.length} nodes</span>
          </div>
          <div className="list">
            {conceptMap.map((skill) => (
              <div key={skill.skill_id} className="list-item">
                <div className="row">
                  <strong>{skill.skill_name || `Skill ${skill.skill_id}`}</strong>
                  <span className="badge">{skill.status}</span>
                </div>
                <p className="meta">Mastery: {(Number(skill.p_mastery || 0) * 100).toFixed(1)}%</p>
                <div className="progress"><span style={{ width: `${Math.min(Number(skill.p_mastery || 0) * 100, 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card stack">
          <div className="section-title">
            <h3>Recommendations</h3>
            <span className="badge">Actionable</span>
          </div>

          <div className="list-item">
            <p className="meta">Next skill</p>
            <strong>{nextSkill?.skill_name || 'Not available yet'}</strong>
            <p className="meta">{nextSkill?.reason || 'Backend recommendation will appear here.'}</p>
          </div>

          <div className="list-item">
            <p className="meta">Unlocked skills</p>
            <p>{unlockedSkills.length} available</p>
          </div>
        </aside>
      </div>
    </div>
  )
}