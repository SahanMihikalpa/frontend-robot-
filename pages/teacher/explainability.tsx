/**
 * /teacher/explainability — Class-wide XAI: why the AI made the decisions it made.
 *
 * Every panel on this page reads the same `window`, so the charts and the
 * student lists always describe the same period. Bars are clickable: selecting
 * one lists the students behind it, each linking through to their own page.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  getClassPatterns,
  ClassPatterns,
  getFlaggedStudents,
  FlaggedStudent,
  getDecisionStudents,
  DecisionStudent,
  DecisionWindow,
  DECISION_WINDOWS,
  windowPhrase,
  avgScoreToStatus,
  statusColor,
  teachingActionLabel,
  remediationStrategyLabel,
} from "../../lib/teacher-api";
import InfoBox from "../../components/InfoBox";

// `raw` is the backend enum ("advance", "flag_teacher"); `name` is its label.
// Deliberately not called `value` — recharts puts its own `value` (the bar's
// numeric height) on the click payload, and the two silently collide.
type BarDatum = { name: string; raw: string; count: number };
type Drill = { kind: "action" | "strategy"; value: string; label: string };

/** Tooltip styled from the theme — recharts' default is a white box with dark
 *  text, which fights every themed panel on the page. */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>
        {payload[0].value} decision{payload[0].value === 1 ? "" : "s"}
      </span>
      <span className="chart-tooltip-hint">Click to see students</span>
    </div>
  );
}

export default function TeacherExplainability() {
  const [period, setPeriod] = useState<DecisionWindow>("7d");
  const [data, setData] = useState<ClassPatterns | null>(null);
  const [flagged, setFlagged] = useState<FlaggedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Bar drill-down
  const [drill, setDrill] = useState<Drill | null>(null);
  const [drillRows, setDrillRows] = useState<DecisionStudent[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getClassPatterns(period), getFlaggedStudents(period)])
      .then(([patterns, flags]) => {
        setData(patterns);
        setFlagged(flags);
      })
      .catch(() => setError("Failed to load AI decision patterns"))
      .finally(() => setLoading(false));
  }, [period]);

  // Re-run an open drill-down when the window changes, so it can never show
  // students from a period the charts are no longer displaying.
  const openDrill = useCallback(
    (next: Drill) => {
      setDrill(next);
      setDrillLoading(true);
      getDecisionStudents(next.kind, next.value, period)
        .then(setDrillRows)
        .catch(() => setDrillRows([]))
        .finally(() => setDrillLoading(false));
    },
    [period],
  );

  const closeDrill = useCallback(() => {
    setDrill(null);
    setDrillRows([]);
  }, []);

  useEffect(() => {
    if (drill) openDrill(drill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Escape closes the modal, and the page behind it must not scroll while it is
  // open — otherwise the wheel scrolls the charts under the overlay.
  useEffect(() => {
    if (!drill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrill();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [drill, closeDrill]);

  // GET /explanations/class/patterns returns a different shape once any
  // decisions exist ({total, action_distribution, remediation_triggers,
  // override_rate}) vs. the empty case ({total: 0, patterns: []}) — guard
  // on data.total before touching the chart-only fields.
  const actionData: BarDatum[] = data?.action_distribution
    ? Object.entries(data.action_distribution)
        .map(([raw, count]) => ({ name: teachingActionLabel(raw), raw, count }))
        .sort((a, b) => b.count - a.count)
    : [];
  const remediationData: BarDatum[] = data?.remediation_triggers
    ? Object.entries(data.remediation_triggers)
        .map(([raw, count]) => ({ name: remediationStrategyLabel(raw), raw, count }))
        .sort((a, b) => b.count - a.count)
    : [];
  const topRemediation = remediationData.length > 0 ? remediationData[0].name : "—";
  const phrase = windowPhrase(period);

  /** Horizontal bars: category names like "Flagged for teacher" collide badly
   *  on a vertical axis, and ranked categories read better left-to-right. */
  function DecisionChart({
    rows,
    kind,
    color,
  }: {
    rows: BarDatum[];
    kind: "action" | "strategy";
    color: string;
  }) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 52)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 13 }}
            width={150}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--accent-dim)" }} />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            // The original datum lives on `payload` — the top-level fields are
            // recharts' own geometry (x, y, width, value=bar height).
            onClick={(d: any) => {
              const row: BarDatum | undefined = d?.payload;
              if (row?.raw) openDrill({ kind, value: row.raw, label: row.name });
            }}
          >
            {rows.map((r) => (
              <Cell
                key={r.raw}
                fill={color}
                fillOpacity={
                  drill && drill.kind === kind && drill.value !== r.raw ? 0.35 : 1
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="teacher-explainability-page student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">AI Transparency</p>
          <h2 className="editorial-title">AI Decisions</h2>
          <p>
            See why the tutoring AI made the choices it made across your whole
            class — which teaching actions it uses most, and what triggers
            remediation. Click any bar to see the students behind it.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Logged</span>
          <strong>{data?.total ?? 0}</strong>
          <p>decisions · {phrase}</p>
        </div>
      </section>

      <div className="decision-window-bar">
        <label htmlFor="decision-window">Showing</label>
        <select
          id="decision-window"
          className="decision-window-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value as DecisionWindow)}
        >
          {DECISION_WINDOWS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="meta">Applies to every panel on this page.</span>
      </div>

      <InfoBox title="What is this page?" accent="var(--accent)" defaultOpen>
        <p>
          Every time the AI tutor decides to hint, explain, remediate, or
          encourage a student, it logs the decision along with its reasons. This
          page aggregates those decisions across your whole class — open a
          student&apos;s own page (Explainability tab) to see their individual
          decision timeline.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Action</strong> is what the tutor did.{" "}
          <strong>Remediation trigger</strong> is the strategy used when a
          student needed extra help. <strong>Override rate</strong> is how often
          a safety override (like a frustration check) changed the AI&apos;s
          first choice.
        </p>
      </InfoBox>

      {error && <p className="feedback error">{error}</p>}

      {loading ? (
        <div className="empty-state">
          <p className="meta">Loading…</p>
        </div>
      ) : (
        <>
          <section className="teacher-panel">
            <div className="teacher-panel-header">
              <div>
                <p className="teacher-eyebrow">Needs Attention</p>
                <h3 className="editorial-title">Students flagged for review</h3>
              </div>
              <span className="skills-count-pill subtle">
                {flagged.length} · {phrase}
              </span>
            </div>

            {flagged.length === 0 ? (
              <div className="empty-state">
                <p>No students flagged for attention in {phrase}.</p>
                {period !== "all" && (
                  <p className="meta">
                    Try a longer period — a student flagged earlier who then
                    stopped practising will not appear here.
                  </p>
                )}
              </div>
            ) : (
              <div className="flagged-student-list">
                {flagged.map((f) => {
                  const status = avgScoreToStatus(f.avg_mastery);
                  return (
                    <Link
                      key={f.user_id}
                      href={`/teacher/students/${f.user_id}`}
                      className="flagged-student-card"
                    >
                      <div className="flagged-student-top">
                        <strong>{f.full_name || f.username}</strong>
                        <span style={{ color: statusColor(status) }}>
                          {Math.round(f.avg_mastery * 100)}% mastery
                        </span>
                      </div>
                      <p className="meta">
                        {teachingActionLabel(f.teaching_action)} ·{" "}
                        {new Date(f.flagged_at).toLocaleString()}
                      </p>
                      {f.reasons.length > 0 && (
                        <ul className="flagged-student-reasons">
                          {f.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {!data || data.total === 0 ? (
            <div className="empty-state">
              <p>No AI decisions recorded in {phrase}.</p>
              <p className="meta">
                Decisions appear here once students start using the tutor.
              </p>
            </div>
          ) : (
            <>
              <section className="teacher-kpi-grid">
                <div className="teacher-kpi-card">
                  <p>Total decisions</p>
                  <strong>{data.total}</strong>
                  <small>logged · {phrase}</small>
                </div>
                <div className="teacher-kpi-card">
                  <p>Override rate</p>
                  <strong>
                    {Math.round((data.override_rate ?? 0) * 100)}%
                  </strong>
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
                    <span className="skills-count-pill subtle">{phrase}</span>
                  </div>
                  <DecisionChart
                    rows={actionData}
                    kind="action"
                    color="var(--accent)"
                  />
                </section>
              )}

              {remediationData.length > 0 && (
                <section className="teacher-panel">
                  <div className="teacher-panel-header">
                    <div>
                      <p className="teacher-eyebrow">Interventions</p>
                      <h3 className="editorial-title">Remediation triggers</h3>
                    </div>
                    <span className="skills-count-pill subtle">{phrase}</span>
                  </div>
                  <DecisionChart
                    rows={remediationData}
                    kind="strategy"
                    color="#f472b6"
                  />
                </section>
              )}
            </>
          )}
        </>
      )}

      {drill && (
        <div
          className="modal-overlay decision-drill-overlay"
          onClick={closeDrill}
          role="dialog"
          aria-modal="true"
          aria-label={`Students behind ${drill.label}`}
        >
          {/* Stop clicks inside the card from reaching the backdrop handler. */}
          <div
            className="decision-drill-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="decision-drill-head">
              <div>
                <p className="teacher-eyebrow" style={{ margin: 0 }}>
                  Students behind this bar
                </p>
                <h3 className="editorial-title" style={{ margin: "4px 0 0" }}>
                  {drill.label}
                </h3>
                <p className="meta" style={{ margin: "4px 0 0" }}>
                  {phrase}
                  {drillRows.length > 0 &&
                    ` · ${drillRows.length} student${drillRows.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <button
                type="button"
                className="decision-drill-close"
                onClick={closeDrill}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="decision-drill-body">
              {drillLoading ? (
                <p className="meta">Loading students…</p>
              ) : drillRows.length === 0 ? (
                <div className="empty-state">
                  <p>No students matched in {phrase}.</p>
                  <p className="meta">Try a longer period.</p>
                </div>
              ) : (
                <div className="flagged-student-list">
                  {drillRows.map((s) => {
                    const status = avgScoreToStatus(s.avg_mastery);
                    return (
                      <Link
                        key={s.user_id}
                        href={`/teacher/students/${s.user_id}`}
                        className="flagged-student-card"
                      >
                        <div className="flagged-student-top">
                          <strong>{s.full_name || s.username}</strong>
                          <span style={{ color: statusColor(status) }}>
                            {Math.round(s.avg_mastery * 100)}% mastery
                          </span>
                        </div>
                        <p className="meta">
                          {s.count} decision{s.count === 1 ? "" : "s"} · last{" "}
                          {new Date(s.last_at).toLocaleString()}
                        </p>
                        {s.reasons.length > 0 && (
                          <ul className="flagged-student-reasons">
                            {s.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
