/**
 * /teacher/heatmap — Student × Skill mastery colour grid
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getClassHeatmap, HeatmapData, statusColor, statusLabel } from '../../lib/teacher-api'

// Darker background colours for cells (coloured fill, bright text)
function cellBg(status: string): string {
  switch (status) {
    case 'mastered':     return '#166534'
    case 'near_mastery': return '#1e40af'
    case 'learning':     return '#92400e'
    case 'struggling':   return '#991b1b'
    default:             return '#1e293b'
  }
}

function cellText(status: string): string {
  switch (status) {
    case 'mastered':     return '#4ade80'
    case 'near_mastery': return '#93c5fd'
    case 'learning':     return '#fcd34d'
    case 'struggling':   return '#fca5a5'
    default:             return '#64748b'
  }
}

// What a teacher should do for each cell colour
const ACTION_GUIDE: Record<string, { label: string; description: string; teacher_action: string }> = {
  mastered: {
    label: 'Mastered',
    description: 'P(mastery) ≥ 95%. Student has demonstrated reliable knowledge.',
    teacher_action: 'No action needed. Consider introducing the next skill.',
  },
  near_mastery: {
    label: 'Near Mastery',
    description: 'P(mastery) 85–95%. Almost there, minor gaps remain.',
    teacher_action: 'Assign 2–3 more practice questions on this skill.',
  },
  learning: {
    label: 'Learning',
    description: 'P(mastery) 30–85%. Student is actively progressing.',
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

// ── Collapsible info panel ─────────────────────────────────────────────────
function InfoBox({ title, children, accent = '#60a5fa', defaultOpen = false }: {
  title: string; children: React.ReactNode; accent?: string; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${accent}33`, overflow: 'hidden', fontSize: 13 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          background: accent + '12', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'inherit',
        }}>
        <span style={{ fontWeight: 600, color: accent }}>ℹ {title}</span>
        <span style={{ color: accent, fontSize: 11, opacity: 0.8 }}>{open ? '▲ close' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 16px', background: accent + '0a', borderTop: `1px solid ${accent}22`, lineHeight: 1.75 }}>
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

  // Build lookup: user_id → skill_id → cell
  const lookup: Record<number, Record<number, HeatmapData['matrix'][0]>> = {}
  if (data) {
    for (const cell of data.matrix) {
      if (!lookup[cell.user_id]) lookup[cell.user_id] = {}
      lookup[cell.user_id][cell.skill_id] = cell
    }
  }

  // Filtered students (only show rows containing the selected status)
  const displayStudents = data?.students.filter(st => {
    if (!filterStatus) return true
    return data.skills.some(sk => {
      const cell = lookup[st.user_id]?.[sk.skill_id]
      const status = cell?.status ?? 'not_started'
      return status === filterStatus
    })
  }) ?? []

  // Summary counts across entire matrix
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
    <div className="stack" style={{ maxWidth: '100%', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Skill Coverage Heatmap</h2>
          <p className="meta">At-a-glance view of every student's mastery for every skill.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/teacher/students" className="btn secondary">Student Roster</Link>
          <Link href="/dashboard/teacher" className="btn secondary">← Dashboard</Link>
        </div>
      </div>

      {/* How to read it */}
      <InfoBox title="How to read this heatmap" accent="#60a5fa" defaultOpen>
        <p style={{ margin: '0 0 8px' }}>
          Each <strong>row</strong> is a student. Each <strong>column</strong> is a skill. Each <strong>cell</strong> shows
          the student's current BKT mastery probability (P(mastery)) for that skill as a percentage.
          The cell colour indicates which learning stage the student is at:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 8 }}>
          {Object.entries(ACTION_GUIDE).map(([key, val]) => (
            <div key={key} style={{
              padding: '8px 12px', borderRadius: 8,
              background: cellBg(key), border: `1px solid ${cellText(key)}30`,
            }}>
              <span style={{ color: cellText(key), fontWeight: 700, fontSize: 13 }}>{val.label}</span>
              <p style={{ margin: '3px 0 2px', fontSize: 12, color: cellText(key), opacity: 0.85 }}>{val.description}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#fbbf24' }}>💡 {val.teacher_action}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>
          Hover over any cell to see the exact mastery % and recommended action.
          Click a student name to open their full detail page.
        </p>
      </InfoBox>

      {/* Class-level summary */}
      {data && data.students.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: 'var(--card)', border: '1px solid var(--border)',
        }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13 }}>Class-wide summary</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(counts).map(([status, count]) => {
              const total = Object.values(counts).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round(count / total * 100) : 0
              const guide = ACTION_GUIDE[status]
              return (
                <div key={status} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', borderRadius: 8,
                  background: cellBg(status), cursor: 'pointer',
                  outline: filterStatus === status ? `2px solid ${cellText(status)}` : 'none',
                }}
                  onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                  title={`Click to filter to only students with at least one ${guide.label} skill`}
                >
                  <div>
                    <div style={{ color: cellText(status), fontWeight: 700, fontSize: 12 }}>{guide.label}</div>
                    <div style={{ color: cellText(status), fontSize: 16, fontWeight: 800 }}>
                      {count} <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>({pct}%)</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {filterStatus && (
              <button
                className="btn small secondary"
                onClick={() => setFilterStatus(null)}
                style={{ alignSelf: 'center' }}>
                ✕ Clear filter
              </button>
            )}
          </div>
          <p className="meta" style={{ fontSize: 11, marginTop: 8 }}>
            Counts are per student–skill cell.
            {filterStatus && <strong style={{ color: '#60a5fa' }}> Showing only students with at least one "{ACTION_GUIDE[filterStatus]?.label}" skill.</strong>}
            {!filterStatus && ' Click a colour block to filter students.'}
          </p>
        </div>
      )}

      {error && <p className="feedback error">{error}</p>}

      {/* Grid */}
      {loading ? (
        <p className="meta">Loading heatmap…</p>
      ) : !data || data.students.length === 0 ? (
        <p className="meta">No data available yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3, minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 12, color: 'var(--muted)', minWidth: 130 }}>
                  Student
                </th>
                {data.skills.map(sk => (
                  <th key={sk.skill_id} style={{
                    padding: '4px 6px', fontSize: 11, color: 'var(--muted)',
                    maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textAlign: 'center', fontWeight: 500,
                  }} title={sk.skill_name}>
                    {sk.skill_name.length > 10 ? sk.skill_name.slice(0, 10) + '…' : sk.skill_name}
                  </th>
                ))}
                <th style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                  Struggling
                </th>
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
                    <td style={{ padding: '2px 8px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <Link href={`/teacher/students/${st.user_id}`}
                        style={{ color: 'var(--fg)', textDecoration: 'none', fontWeight: 500 }}>
                        {st.full_name}
                      </Link>
                    </td>
                    {data.skills.map(sk => {
                      const cell   = lookup[st.user_id]?.[sk.skill_id]
                      const status = cell?.status ?? 'not_started'
                      const p      = cell?.p_mastery
                      const guide  = ACTION_GUIDE[status]
                      return (
                        <td key={sk.skill_id}
                          style={{
                            width: 40, height: 36, textAlign: 'center',
                            background: cellBg(status), borderRadius: 6,
                            color: cellText(status), fontSize: 11, fontWeight: 600,
                            cursor: 'default', verticalAlign: 'middle',
                            transition: 'filter .15s',
                          }}
                          onMouseEnter={e => {
                            const rect = (e.target as HTMLElement).getBoundingClientRect()
                            setTooltip({
                              text: `${st.full_name} · ${sk.skill_name}: ${p != null ? Math.round(p * 100) + '%' : '—'} (${guide?.label})`,
                              action: guide?.teacher_action ?? '',
                              x: rect.left + window.scrollX,
                              y: rect.top + window.scrollY - 70,
                            })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {p != null ? Math.round(p * 100) : '—'}
                        </td>
                      )
                    })}
                    {/* Per-row struggling count */}
                    <td style={{ padding: '2px 8px', textAlign: 'right', fontSize: 12 }}>
                      {rowStruggling > 0
                        ? <span style={{ color: '#f87171', fontWeight: 700 }}>⚠ {rowStruggling}</span>
                        : <span style={{ color: '#4ade80' }}>✓</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x, top: tooltip.y,
          background: 'var(--card)', border: '1px solid var(--border)',
          padding: '8px 14px', borderRadius: 10, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,.4)', zIndex: 9999,
          pointerEvents: 'none', maxWidth: 300,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.text}</div>
          <div style={{ color: '#fbbf24', fontSize: 12 }}>💡 {tooltip.action}</div>
        </div>
      )}

    </div>
  )
}
