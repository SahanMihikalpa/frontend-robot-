/**
 * /teacher/heatmap - Student x Skill mastery colour grid
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getClassHeatmap, HeatmapData, statusColor, statusLabel } from '../../lib/teacher-api'

function cellBg(status: string): string {
  switch (status) {
    case 'mastered':     return 'var(--success)'
    case 'near_mastery': return 'var(--accent-secondary)'
    case 'learning':     return 'var(--warning)'
    case 'struggling':   return 'var(--danger)'
    default:             return 'var(--border-strong)'
  }
}

function cellText(status: string): string {
  switch (status) {
    case 'mastered':     return 'var(--surface)'
    case 'near_mastery': return 'var(--surface)'
    case 'learning':     return 'var(--text)'
    case 'struggling':   return 'var(--surface)'
    default:             return 'var(--muted)'
  }
}

const ACTION_GUIDE: Record<string, { label: string; description: string; teacher_action: string }> = {
  mastered: {
    label: 'Mastered',
    description: 'P(mastery) >= 95%. Student has demonstrated reliable knowledge.',
    teacher_action: 'No action needed. Consider introducing the next skill.',
  },
  near_mastery: {
    label: 'Near Mastery',
    description: 'P(mastery) 85-95%. Almost there, minor gaps remain.',
    teacher_action: 'Assign 2-3 more practice questions on this skill.',
  },
  learning: {
    label: 'Learning',
    description: 'P(mastery) 30-85%. Student is actively progressing.',
    teacher_action: 'Normal progress. Continue current exercises.',
  },
  struggling: {
    label: 'Struggling',
    description: 'P(mastery) < 30%. Student is repeatedly getting this skill wrong.',
    teacher_action: 'Prioritise. Review concept in class or provide worked examples.',
  },
  not_started: {
    label: 'Not Started',
    description: 'No questions answered for this skill.',
    teacher_action: 'No urgent action, unless related skills are already mastered.',
  },
}

function InfoBox({ title, children, accent = 'var(--accent)', defaultOpen = false }: {
  title: string; children: React.ReactNode; accent?: string; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  // color-mix() blends the (always var(--x)) accent with transparent to get
  // a tint/border — string-concatenating a hex-alpha suffix directly onto a
  // var() reference (the old `${accent}33` pattern) isn't valid CSS and
  // silently drops the whole declaration, so nothing rendered.
  return (
    <div className="teacher-heatmap-info" style={{ borderColor: `color-mix(in srgb, ${accent} 20%, transparent)` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="teacher-heatmap-info-toggle"
        style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)` }}>
        <span style={{ color: accent }}>{title}</span>
        <span style={{ color: accent }}>{open ? 'Close' : 'Expand'}</span>
      </button>
      {open && (
        <div className="teacher-heatmap-info-content" style={{ borderTopColor: `color-mix(in srgb, ${accent} 13%, transparent)` }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function TeacherHeatmap() {
  const [data, setData]       = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tooltip, setTooltip] = useState<{ text: string; action: string; x: number; y: number } | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  useEffect(() => {
    getClassHeatmap()
      .then(setData)
      .catch(() => setError('Failed to load heatmap data'))
      .finally(() => setLoading(false))
  }, [])

  const lookup: Record<number, Record<number, HeatmapData['matrix'][0]>> = {}
  if (data) {
    for (const cell of data.matrix) {
      if (!lookup[cell.user_id]) lookup[cell.user_id] = {}
      lookup[cell.user_id][cell.skill_id] = cell
    }
  }

  const displayStudents = data?.students.filter(st => {
    if (!filterStatus) return true
    return data.skills.some(sk => {
      const cell = lookup[st.user_id]?.[sk.skill_id]
      const status = cell?.status ?? 'not_started'
      return status === filterStatus
    })
  }) ?? []

  const counts = { mastered: 0, near_mastery: 0, learning: 0, struggling: 0, not_started: 0 }
  if (data) {
    for (const st of data.students) {
      for (const sk of data.skills) {
        const cell = lookup[st.user_id]?.[sk.skill_id]
        const status = (cell?.status ?? 'not_started') as keyof typeof counts
        counts[status]++
      }
    }
  }

  return (
    <div className="teacher-heatmap-page student-dash">
      <section className="teacher-hero teacher-heatmap-hero">
        <div>
          <p className="teacher-eyebrow">Skill Coverage</p>
          <h2 className="editorial-title">Skill Coverage Heatmap</h2>
          <p>
            Scan every student-skill pairing, filter by learning stage, and spot
            the classroom patterns that need attention.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Matrix</span>
          <strong>{data ? data.students.length : 0}</strong>
          <p>students mapped</p>
        </div>
      </section>

      

      <InfoBox title="How to read this heatmap" accent="var(--accent)" defaultOpen>
        <p>
          Each row is a student. Each column is a skill. Each cell shows the
          student's current BKT mastery probability for that skill.
        </p>
        <div className="teacher-heatmap-guide-grid">
          {Object.entries(ACTION_GUIDE).map(([key, val]) => (
            <div key={key} className="teacher-heatmap-guide-card" style={{ borderColor: `color-mix(in srgb, ${cellBg(key)} 33%, transparent)` }}>
              <span style={{ background: cellBg(key), color: cellText(key) }}>{val.label}</span>
              <p>{val.description}</p>
              <small>{val.teacher_action}</small>
            </div>
          ))}
        </div>
        <p className="teacher-heatmap-hint">
          Hover over any cell to see the exact mastery percentage and recommended action.
          Open a student name to view their full detail page.
        </p>
      </InfoBox>

      {data && data.students.length > 0 && (
        <section className="teacher-panel teacher-heatmap-summary">
          <div className="teacher-panel-header">
            <div>
              <p className="teacher-eyebrow">Class Summary</p>
              <h3 className="editorial-title">Mastery distribution</h3>
            </div>
            {filterStatus && (
              <button
                className="teacher-clear-filter"
                onClick={() => setFilterStatus(null)}
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="teacher-heatmap-filter-grid">
            {Object.entries(counts).map(([status, count]) => {
              const total = Object.values(counts).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round(count / total * 100) : 0
              const guide = ACTION_GUIDE[status]
              return (
                <button
                  key={status}
                  type="button"
                  className={`teacher-heatmap-filter ${filterStatus === status ? 'active' : ''}`}
                  onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                  title={`Click to filter to only students with at least one ${guide.label} skill`}
                  style={{
                    borderColor: filterStatus === status ? cellBg(status) : undefined,
                  }}
                >
                  <span style={{ background: cellBg(status), color: cellText(status) }}>
                    {guide.label}
                  </span>
                  <strong>{count}</strong>
                  <small>{pct}% of cells</small>
                </button>
              )
            })}
          </div>

          <p className="teacher-heatmap-filter-note">
            Counts are per student-skill cell.
            {filterStatus && <strong> Showing only students with at least one "{ACTION_GUIDE[filterStatus]?.label}" skill.</strong>}
            {!filterStatus && ' Click a block to filter students.'}
          </p>
        </section>
      )}

      {error && <p className="feedback error">{error}</p>}

      {loading ? (
        <p className="teacher-heatmap-state">Loading heatmap...</p>
      ) : !data || data.students.length === 0 ? (
        <p className="teacher-heatmap-state">No data available yet.</p>
      ) : (
        <section className="teacher-panel teacher-heatmap-panel">
          <div className="teacher-panel-header">
            <div>
              <p className="teacher-eyebrow">Matrix View</p>
              <h3 className="editorial-title">Student x skill grid</h3>
            </div>
            <p className="teacher-heatmap-filter-note">
              {displayStudents.length} of {data.students.length} students shown
            </p>
          </div>

          <div className="teacher-heatmap-scroll">
            <table className="teacher-heatmap-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {data.skills.map(sk => (
                    <th key={sk.skill_id} title={sk.skill_name}>
                      {sk.skill_name.length > 10 ? sk.skill_name.slice(0, 10) + '...' : sk.skill_name}
                    </th>
                  ))}
                  <th>Struggling</th>
                </tr>
              </thead>
              <tbody>
                {displayStudents.map(st => {
                  const rowStruggling = data.skills.filter(sk => {
                    const cell = lookup[st.user_id]?.[sk.skill_id]
                    return (cell?.status ?? 'not_started') === 'struggling'
                  }).length
                  return (
                    <tr key={st.user_id}>
                      <td>
                        <Link href={`/teacher/students/${st.user_id}`} className="teacher-heatmap-student-link">
                          {st.full_name}
                        </Link>
                      </td>
                      {data.skills.map(sk => {
                        const cell   = lookup[st.user_id]?.[sk.skill_id]
                        const status = cell?.status ?? 'not_started'
                        const p      = cell?.p_mastery
                        const guide  = ACTION_GUIDE[status]
                        return (
                          <td
                            key={sk.skill_id}
                            className="teacher-heatmap-cell"
                            style={{
                              background: cellBg(status),
                              color: cellText(status),
                            }}
                            onMouseEnter={e => {
                              const rect = (e.target as HTMLElement).getBoundingClientRect()
                              setTooltip({
                                text: `${st.full_name} - ${sk.skill_name}: ${p != null ? Math.round(p * 100) + '%' : '-'} (${guide?.label})`,
                                action: guide?.teacher_action ?? '',
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY - 70,
                              })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {p != null ? Math.round(p * 100) : '-'}
                          </td>
                        )
                      })}
                      <td className="teacher-heatmap-row-status">
                        {rowStruggling > 0
                          ? <span className="danger">Alert {rowStruggling}</span>
                          : <span className="success">Clear</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tooltip && (
        <div
          className="teacher-heatmap-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div>{tooltip.text}</div>
          <p>{tooltip.action}</p>
        </div>
      )}
    </div>
  )
}
