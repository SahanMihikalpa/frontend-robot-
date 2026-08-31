/**
 * /teacher/explainability — Class-wide XAI: why the AI made the decisions it made.
 */
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { getClassPatterns, ClassPatterns } from '../../lib/teacher-api'
import InfoBox from '../../components/InfoBox'

export default function TeacherExplainability() {
  const [data, setData] = useState<ClassPatterns | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getClassPatterns()
      .then(setData)
      .catch(() => setError('Failed to load AI decision patterns'))
      .finally(() => setLoading(false))
  }, [])

  // GET /explanations/class/patterns returns a different shape once any
  // decisions exist ({total, action_distribution, remediation_triggers,
  // override_rate}) vs. the empty case ({total: 0, patterns: []}) — guard
  // on data.total before touching the chart-only fields.
  const actionData = data?.action_distribution
    ? Object.entries(data.action_distribution).map(([name, count]) => ({ name, count }))
    : []
  const remediationData = data?.remediation_triggers
    ? Object.entries(data.remediation_triggers).map(([name, count]) => ({ name, count }))
    : []
  const topRemediation = remediationData.length > 0
    ? [...remediationData].sort((a, b) => b.count - a.count)[0].name
    : '—'

  return (
    <div className="teacher-explainability-page student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">AI Transparency</p>
          <h2 className="editorial-title">AI Decisions</h2>
          <p>
            See why the tutoring AI made the choices it made across your whole class — which teaching
            actions it uses most, and what triggers remediation.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Logged</span>
          <strong>{data?.total ?? 0}</strong>
          <p>decisions recorded</p>
        </div>
      </section>

      <InfoBox title="What is this page?" accent="var(--accent)" defaultOpen>
        <p>
          Every time the AI tutor decides to hint, explain, remediate, or encourage a student, it logs the
          decision along with its reasons. This page aggregates those decisions across your whole class —
          open a student&apos;s own page (Explainability tab) to see their individual decision timeline.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Action</strong> is what the tutor did. <strong>Remediation trigger</strong> is the
          strategy used when a student needed extra help. <strong>Override rate</strong> is how often a
          safety override (like a frustration check) changed the AI&apos;s first choice.
        </p>
      </InfoBox>

      {error && <p className="feedback error">{error}</p>}

      {loading ? (
        <div className="empty-state"><p className="meta">Loading…</p></div>
      ) : !data || data.total === 0 ? (
        <div className="empty-state">
          <p>No AI decisions have been recorded yet.</p>
          <p className="meta">Decisions appear here once students start using the tutor.</p>
        </div>
      ) : (
        <>
          <section className="teacher-kpi-grid">
            <div className="teacher-kpi-card">
              <p>Total decisions</p>
              <strong>{data.total}</strong>
              <small>logged across all students</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Override rate</p>
              <strong>{Math.round((data.override_rate ?? 0) * 100)}%</strong>
              <small>decisions changed by a safety override</small>
            </div>
            <div className="teacher-kpi-card">
              <p>Top remediation trigger</p>
              <strong style={{ fontSize: 26 }}>{topRemediation}</strong>
              <small>most common reason for remediation</small>
            </div>
          </section>

          {actionData.length > 0 && (
            <section className="teacher-panel">
              <div className="teacher-panel-header">
                <div>
                  <p className="teacher-eyebrow">Teaching Actions</p>
                  <h3 className="editorial-title">Action distribution</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={actionData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {remediationData.length > 0 && (
            <section className="teacher-panel">
              <div className="teacher-panel-header">
                <div>
                  <p className="teacher-eyebrow">Interventions</p>
                  <h3 className="editorial-title">Remediation triggers</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={remediationData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f472b6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}
    </div>
  )
}
