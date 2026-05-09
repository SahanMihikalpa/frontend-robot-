import { useEffect, useMemo, useState } from 'react'
import { listQuestions, listSkills } from '../lib/api'

export default function QuestionsPage() {
  const [skills, setSkills] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [selectedSkill, setSelectedSkill] = useState<number | 'all'>('all')

  useEffect(() => {
    async function loadQuestions() {
      const [skillsData, questionsData] = await Promise.all([
        listSkills(),
        listQuestions(),
      ])

      setSkills(Array.isArray(skillsData) ? skillsData : skillsData?.items || [])
      setQuestions(Array.isArray(questionsData) ? questionsData : questionsData?.items || [])
    }

    loadQuestions().catch(() => undefined)
  }, [])

  const filteredQuestions = useMemo(() => {
    if (selectedSkill === 'all') {
      return questions
    }
    return questions.filter((question) => Number(question.skill_id) === selectedSkill)
  }, [questions, selectedSkill])

  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-title">
          <div>
            <h2>Questions</h2>
            <p className="meta">Backend question bank preview.</p>
          </div>
          <span className="badge">{questions.length} total</span>
        </div>

        <div className="chip-row">
          <button type="button" className={`chip ${selectedSkill === 'all' ? 'active' : ''}`} onClick={() => setSelectedSkill('all')}>
            All skills
          </button>
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={`chip ${selectedSkill === skill.id ? 'active' : ''}`}
              onClick={() => setSelectedSkill(skill.id)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="section-title">
          <h3>Question list</h3>
          <span className="badge">{filteredQuestions.length} shown</span>
        </div>

        <div className="list">
          {filteredQuestions.map((question) => (
            <div key={question.id} className="list-item">
              <div className="row">
                <strong>{question.question_text || `Question ${question.id}`}</strong>
                <span className="badge">{question.question_type || 'unknown'}</span>
              </div>
              <p className="meta">Skill: {question.skill_name || question.skill_id}</p>
              {question.options && <pre>{JSON.stringify(question.options, null, 2)}</pre>}
            </div>
          ))}

          {filteredQuestions.length === 0 && <p className="meta">No questions available.</p>}
        </div>
      </section>
    </div>
  )
}