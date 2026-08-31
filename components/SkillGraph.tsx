import { useMemo } from "react";
import {
  computeLayeredLayout,
  GraphEdge,
  GraphNodeLike,
  NODE_H,
  NODE_W,
} from "../lib/graphLayout";
import { avgScoreToStatus, statusColor, statusLabel } from "../lib/teacher-api";

const LEGEND_STATUSES = [
  "mastered",
  "near_mastery",
  "learning",
  "struggling",
  "not_started",
] as const;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function SkillGraph({
  nodes,
  edges,
  masteryBySkill,
  statusBySkill,
  selectedId = null,
  onSelectNode,
}: {
  nodes: GraphNodeLike[];
  edges: GraphEdge[];
  /** Raw class-average score per skill (0-1) — status is derived via avgScoreToStatus. */
  masteryBySkill: Record<number, number | null | undefined>;
  /**
   * Optional pre-computed status per skill (e.g. one specific student's real
   * mastery-tab status). When given for a node, it wins over masteryBySkill —
   * this keeps individual-student coloring in exact sync with their own
   * Mastery tab instead of re-deriving it from a raw score.
   */
  statusBySkill?: Record<number, string | undefined>;
  selectedId?: number | null;
  onSelectNode?: (id: number) => void;
}) {
  const layout = useMemo(
    () => computeLayeredLayout(nodes, edges),
    [nodes, edges],
  );

  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <p>No skills yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="skill-graph-wrap">
        <svg
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Skill dependency graph"
        >
          <defs>
            <marker
              id="skillgraph-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--border-strong)" />
            </marker>
            <marker
              id="skillgraph-arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
            </marker>
          </defs>

          {edges.map((e, i) => {
            const from = layout.positions[e.source];
            const to = layout.positions[e.target];
            if (!from || !to) return null;
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y;
            const mid = (y1 + y2) / 2;
            const active =
              selectedId != null &&
              (e.source === selectedId || e.target === selectedId);
            return (
              <path
                key={`${e.source}-${e.target}-${i}`}
                d={`M ${x1},${y1} C ${x1},${mid} ${x2},${mid} ${x2},${y2}`}
                fill="none"
                stroke={active ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={active ? 2.5 : 1.5}
                markerEnd={
                  active
                    ? "url(#skillgraph-arrow-active)"
                    : "url(#skillgraph-arrow)"
                }
              />
            );
          })}

          {nodes.map((node) => {
            const pos = layout.positions[node.id];
            if (!pos) return null;
            // statusBySkill present (even without an entry for this node) means
            // individual-student mode is active — a missing entry there means
            // "not started", not "fall back to the class average".
            const status = statusBySkill
              ? (statusBySkill[node.id] ?? "not_started")
              : avgScoreToStatus(masteryBySkill[node.id]);
            const sColor = statusColor(status);
            const isSelected = node.id === selectedId;
            const isCyclic = layout.cyclic.includes(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                onClick={onSelectNode ? () => onSelectNode(node.id) : undefined}
                style={onSelectNode ? { cursor: "pointer" } : undefined}
              >
                <title>
                  {node.name}
                  {node.category ? ` — ${node.category}` : ""}
                </title>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={`color-mix(in srgb, ${sColor} 16%, var(--surface))`}
                  stroke={
                    isSelected ? "var(--accent)" : isCyclic ? "#f59e0b" : sColor
                  }
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={isCyclic ? "4 3" : undefined}
                />
                <text
                  x={12}
                  y={26}
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--text)"
                >
                  {truncate(node.name, 20)}
                </text>
                {node.category && (
                  <text x={12} y={44} fontSize={10} fill="var(--muted)">
                    {truncate(node.category, 24)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="skill-graph-legend">
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className="skill-graph-legend-item">
            <span
              className="skill-graph-legend-swatch"
              style={{ background: statusColor(s) }}
            />
            {statusLabel(s)}
          </span>
        ))}
      </div>
    </div>
  );
}
