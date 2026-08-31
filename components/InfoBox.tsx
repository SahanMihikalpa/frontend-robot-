import { useState } from 'react'

/**
 * Collapsible plain-language explainer box. Used by pages/skills/graph.tsx
 * and pages/teacher/explainability.tsx.
 *
 * Note: pages/teacher/heatmap.tsx and pages/teacher/students/[id].tsx each
 * already have their own local, slightly-drifted copy of this same idea —
 * left untouched deliberately rather than refactored as a side effect of
 * this feature (see the plan's "InfoBox" alternatives note).
 */
export default function InfoBox({
  title,
  children,
  accent = 'var(--accent)',
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  accent?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="info-box">
      <button type="button" className="info-box-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="info-box-title">
          <span
            className="info-box-icon"
            style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)`, color: accent }}
            aria-hidden="true"
          >
            i
          </span>
          {title}
        </span>
        <span className="info-box-caret">{open ? '▲ close' : '▼ expand'}</span>
      </button>
      {open && <div className="info-box-body">{children}</div>}
    </div>
  )
}
