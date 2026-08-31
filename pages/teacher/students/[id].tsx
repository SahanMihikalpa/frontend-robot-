/**
 * /teacher/students/[id] — Per-student deep-dive (5 tabs)
 * Tabs: Mastery | Performance | Engagement | Personalization | Explainability
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  getStudentAnalytics,
  getStudentMasteryHistory,
  getStudentInteractionTrends,
  getStudentEngagementTimeline,
  getStudentFusionWeights,
  getStudentDecisions,
  getStudentDecisionSummary,
  MasteryHistorySkill,
  InteractionTrends,
  EngagementTimeline,
  FusionWeights,
  DecisionItem,
  DecisionListResponse,
  DecisionSummary,
  statusColor,
  statusLabel,
  scoreColor,
  confidenceColor,
  teachingActionLabel,
  remediationStrategyLabel,
} from "../../../lib/teacher-api";

// ── Colour palette for multi-line mastery chart ────────────────────────────
const LINE_COLORS = [
  "#60a5fa",
  "#4ade80",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#e879f9",
];

// ── Reusable interpretation components ────────────────────────────────────

/** Collapsible info box — click header to expand/collapse */
function InfoBox({
  title,
  children,
  accent = "#60a5fa",
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="student-info-box">
      <button
        type="button"
        className="student-info-box-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="student-info-box-title">
          <span
            className="student-info-box-icon"
            style={{
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              color: accent,
            }}
            aria-hidden="true"
          >
            i
          </span>
          {title}
        </span>
        <span className="student-info-box-caret">
          {open ? "▲ close" : "▼ expand"}
        </span>
      </button>
      {open && <div className="student-info-box-body">{children}</div>}
    </div>
  );
}

/** Yellow action tip box */
function ActionTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="student-action-tip">
      <span style={{ fontSize: 16 }} aria-hidden="true">
        💡
      </span>
      <div>{children}</div>
    </div>
  );
}

/** Coloured inline badge */
function Badge({ status }: { status: string }) {
  return (
    <span
      style={{
        background: statusColor(status) + "22",
        color: statusColor(status),
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────
function Pct({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: "var(--muted)" }}>—</span>;
  return <span style={{ color: scoreColor(v) }}>{Math.round(v * 100)}%</span>;
}

function KPI({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="teacher-kpi-card" style={{ minHeight: 120, padding: 20 }}>
      <p>{label}</p>
      <strong style={{ fontSize: 36 }}>{children}</strong>
      {sub && (
        <p
          className="meta"
          style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="student-section-title">{children}</h4>;
}

/** Horizontal coloured bar (0–1 value) */
function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 32 }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ── Status guide card used inside the mastery tab ─────────────────────────
const STATUS_GUIDE = [
  {
    status: "mastered",
    what: "P(mastery) ≥ 95%",
    meaning:
      "Student has demonstrated consistent, reliable knowledge of this skill.",
    action:
      "Ready to move on. Introduce the next skill or more advanced problems.",
  },
  {
    status: "near_mastery",
    what: "85% – 95%",
    meaning:
      "Almost there — the student knows the topic well with only minor gaps.",
    action:
      "Assign 2–3 more practice questions on this skill to push across the mastery threshold.",
  },
  {
    status: "learning",
    what: "30% – 85%",
    meaning:
      "The student is actively learning. This is the normal working zone.",
    action: "Continue current practice. Monitor for any drop below 30%.",
  },
  {
    status: "struggling",
    what: "P(mastery) < 30%",
    meaning:
      "Student is repeatedly answering incorrectly. Foundational gaps likely.",
    action:
      "Prioritise this skill. Review prerequisite concepts, provide worked examples, or schedule 1-on-1 support.",
  },
  {
    status: "not_started",
    what: "No attempts",
    meaning: "Student has not yet attempted any questions for this skill.",
    action:
      "No action needed unless other skills are already mastered and this one is still untouched.",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function StudentDetail() {
  const router = useRouter();
  const userId = Number(router.query.id);
  const [tab, setTab] = useState<
    | "mastery"
    | "performance"
    | "engagement"
    | "personalization"
    | "explainability"
  >("mastery");

  // Data states
  const [profile, setProfile] = useState<any>(null);
  const [mastery, setMastery] = useState<{
    skills: MasteryHistorySkill[];
  } | null>(null);
  const [trends, setTrends] = useState<InteractionTrends | null>(null);
  const [engagement, setEngagement] = useState<EngagementTimeline | null>(null);
  const [fusion, setFusion] = useState<FusionWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Explainability tab — lazily loaded only once that tab is opened
  const [decisions, setDecisions] = useState<DecisionListResponse | null>(null);
  const [decisionSummary, setDecisionSummary] =
    useState<DecisionSummary | null>(null);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [decisionsError, setDecisionsError] = useState("");

  // Mastery chart: which skills to show
  const [visibleSkills, setVisibleSkills] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      getStudentAnalytics(userId),
      getStudentMasteryHistory(userId),
      getStudentInteractionTrends(userId),
      getStudentEngagementTimeline(userId),
      getStudentFusionWeights(userId),
    ])
      .then(([prof, mast, tr, eng, fus]) => {
        setProfile(prof);
        setMastery(mast);
        setTrends(tr);
        setEngagement(eng);
        setFusion(fus);
        setVisibleSkills(
          new Set(mast.skills.map((s: MasteryHistorySkill) => s.skill_id)),
        );
      })
      .catch(() => setError("Failed to load student data"))
      .finally(() => setLoading(false));
  }, [userId]);

  // Explainability tab data is fetched only once that tab is actually opened —
  // unlike the five calls above, which feed the always-visible hero/KPI row.
  function loadDecisionsInitial() {
    if (!userId) return;
    setDecisionsLoading(true);
    setDecisionsError("");
    Promise.all([
      getStudentDecisions(userId, { limit: 50, skip: 0 }),
      getStudentDecisionSummary(userId),
    ])
      .then(([dec, sum]) => {
        setDecisions(dec);
        setDecisionSummary(sum);
      })
      .catch(() => setDecisionsError("Failed to load AI decisions"))
      .finally(() => setDecisionsLoading(false));
  }

  function loadMoreDecisions() {
    if (!userId || !decisions) return;
    setDecisionsLoading(true);
    getStudentDecisions(userId, { limit: 50, skip: decisions.decisions.length })
      .then((more) =>
        setDecisions((prev) =>
          prev
            ? {
                decisions: [...prev.decisions, ...more.decisions],
                total: more.total,
              }
            : more,
        ),
      )
      .catch(() => setDecisionsError("Failed to load more decisions"))
      .finally(() => setDecisionsLoading(false));
  }

  useEffect(() => {
    if (tab === "explainability" && decisions === null) {
      loadDecisionsInitial();
    }
  }, [tab, userId]);

  if (loading) {
    return (
      <div className="student-detail-page">
        <div className="empty-state" style={{ padding: "80px 24px" }}>
          <p className="meta">Loading student data…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="student-detail-page">
        <p className="feedback error">{error}</p>
      </div>
    );
  }
  if (!profile) return null;

  // ── Build mastery chart data ─────────────────────────────────────────────
  const allEvents: { time: number; label: string; [key: string]: any }[] = [];
  const skillsToShow =
    mastery?.skills.filter((s) => visibleSkills.has(s.skill_id)) ?? [];

  if (mastery) {
    const times = new Set<string>();
    mastery.skills.forEach((sk) =>
      sk.events.forEach((e) => {
        if (e.timestamp) times.add(e.timestamp);
      }),
    );
    const sortedTimes = Array.from(times).sort();
    const lastKnown: Record<number, number> = {};
    mastery.skills.forEach((sk) => {
      lastKnown[sk.skill_id] = 0.1;
    });
    sortedTimes.forEach((ts) => {
      const row: any = {
        time: new Date(ts).getTime(),
        label: new Date(ts).toLocaleDateString(),
      };
      mastery.skills.forEach((sk) => {
        const evt = sk.events.find((e) => e.timestamp === ts);
        if (evt) lastKnown[sk.skill_id] = evt.p_mastery;
        row[`skill_${sk.skill_id}`] = lastKnown[sk.skill_id];
      });
      allEvents.push(row);
    });
  }

  // ── Build engagement chart data ──────────────────────────────────────────
  const engagementChartData = (engagement?.sessions ?? []).map((s) => ({
    label: s.session_start
      ? new Date(s.session_start).toLocaleDateString()
      : s.session_id.slice(-6),
    score: Math.round(s.avg_visual_engagement * 100),
    face: Math.round(s.face_detected_pct * 100),
  }));
  const statusDist = engagement?.status_distribution ?? {
    ENGAGED: 0,
    PARTIALLY_ENGAGED: 0,
    DISENGAGED: 0,
  };
  const totalEngSamples =
    statusDist.ENGAGED + statusDist.PARTIALLY_ENGAGED + statusDist.DISENGAGED;

  // Computed values
  const accuracy =
    profile.total_interactions > 0
      ? profile.correct_answers / profile.total_interactions
      : null;

  const masteredCount =
    mastery?.skills.filter((s) => s.status === "mastered").length ?? 0;
  const strugglingCount =
    mastery?.skills.filter((s) => s.status === "struggling").length ?? 0;
  const totalSkills = mastery?.skills.length ?? 0;

  return (
    <div className="student-detail-page">
      {/* ── Back navigation ── */}
      <Link href="/teacher/students" className="student-detail-back">
        ← All Students
      </Link>

      {/* ── Hero ── */}
      <section className="teacher-hero student-detail-hero">
        <div>
          <p className="teacher-eyebrow">Student Profile</p>
          <h2 className="editorial-title">
            {profile.full_name || profile.username}
          </h2>
          <p className="student-detail-contact">
            {profile.email}
            {" · "}
            <strong>{profile.total_interactions} questions answered</strong>
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Overall mastery</span>
          <strong style={{ fontSize: 52 }}>
            {profile.overall_score != null
              ? `${Math.round(profile.overall_score * 100)}%`
              : "—"}
          </strong>
          <p>average P(mastery) across all skills</p>
        </div>
      </section>

      {/* ── Top KPI row ── */}
      <div className="teacher-kpi-grid">
        <KPI label="Overall mastery" sub="Average P(mastery) across all skills">
          <Pct v={profile.overall_score} />
        </KPI>
        <KPI label="Answer accuracy" sub="Correct ÷ total questions answered">
          {accuracy != null ? (
            <span style={{ color: scoreColor(accuracy) }}>
              {Math.round(accuracy * 100)}%
            </span>
          ) : (
            "—"
          )}
        </KPI>
        <KPI label="Skills mastered" sub={`Out of ${totalSkills} skills`}>
          <span style={{ color: "var(--success)" }}>{masteredCount}</span>
        </KPI>
        <KPI label="Skills struggling" sub="Needs teacher attention">
          <span
            style={{
              color: strugglingCount > 0 ? "var(--danger)" : "var(--muted)",
            }}
          >
            {strugglingCount || "—"}
          </span>
        </KPI>
      </div>

      {/* ── Tab strip ── */}
      <div className="student-tabs" role="tablist">
        {(
          [
            "mastery",
            "performance",
            "engagement",
            "personalization",
            "explainability",
          ] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            role="tab"
            aria-selected={tab === t}
            className={`student-tab ${tab === t ? "active" : ""}`}
          >
            {t}
            {t === "mastery" && strugglingCount > 0 && (
              <span className="student-tab-badge">{strugglingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
           TAB: MASTERY
         ══════════════════════════════════════════════════════ */}
      {tab === "mastery" && (
        <div className="stack">
          {/* Explanation box */}
          <InfoBox title="What does this tab show?" accent="#60a5fa">
            <p style={{ margin: "0 0 8px" }}>
              This tab shows how the student's{" "}
              <strong>knowledge probability (P(mastery))</strong> has changed
              over time for each skill, using a model called{" "}
              <strong>BKT (Bayesian Knowledge Tracing)</strong>.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              Every time the student answers a question, the system updates its
              estimate:
            </p>
            <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              <li>
                <strong>Correct answer</strong> → P(mastery) increases
              </li>
              <li>
                <strong>Wrong answer</strong> → P(mastery) decreases slightly
              </li>
            </ul>
            <p style={{ margin: 0 }}>
              The chart lines show how each skill's mastery estimate changed
              with each practice session. A rising line means the student is
              learning. A flat or falling line may need attention.
            </p>
          </InfoBox>

          {/* Reference line legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              padding: "12px 16px",
              background: "var(--surface-2)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: "var(--muted)",
                alignSelf: "center",
              }}
            >
              Chart thresholds:
            </span>
            <span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>── 95%</span>{" "}
              Mastered — system unlocks next skill
            </span>
            <span>
              <span style={{ color: "#60a5fa", fontWeight: 700 }}>── 85%</span>{" "}
              Near Mastery — 2–3 correct answers away
            </span>
            <span>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>── 30%</span>{" "}
              ZPD boundary — below = Struggling zone
            </span>
          </div>

          {/* Skill toggles */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span className="meta" style={{ fontSize: 12 }}>
              Show/hide skills:
            </span>
            {mastery?.skills.map((sk, i) => {
              const on = visibleSkills.has(sk.skill_id);
              return (
                <button
                  key={sk.skill_id}
                  onClick={() => {
                    const next = new Set(visibleSkills);
                    on ? next.delete(sk.skill_id) : next.add(sk.skill_id);
                    setVisibleSkills(next);
                  }}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    cursor: "pointer",
                    border: `2px solid ${LINE_COLORS[i % LINE_COLORS.length]}`,
                    background: on
                      ? LINE_COLORS[i % LINE_COLORS.length] + "33"
                      : "transparent",
                    color: LINE_COLORS[i % LINE_COLORS.length],
                  }}
                >
                  {sk.skill_name}
                </button>
              );
            })}
          </div>

          {allEvents.length < 2 ? (
            <p className="meta">
              Not enough history yet — student needs more interactions.
            </p>
          ) : (
            <div className="student-chart-card">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={allEvents}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [
                      `${Math.round(Number(v) * 100)}%`,
                      name,
                    ]}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <ReferenceLine
                    y={0.95}
                    stroke="#4ade80"
                    strokeDasharray="4 4"
                    label={{
                      value: "Mastered ≥95%",
                      fontSize: 10,
                      fill: "#4ade80",
                      position: "insideTopLeft",
                    }}
                  />
                  <ReferenceLine
                    y={0.85}
                    stroke="#60a5fa"
                    strokeDasharray="4 4"
                    label={{
                      value: "Near Mastery 85%",
                      fontSize: 10,
                      fill: "#60a5fa",
                      position: "insideTopLeft",
                    }}
                  />
                  <ReferenceLine
                    y={0.3}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    label={{
                      value: "ZPD lower 30%",
                      fontSize: 10,
                      fill: "#fbbf24",
                      position: "insideTopLeft",
                    }}
                  />
                  {skillsToShow.map((sk, i) => (
                    <Line
                      key={sk.skill_id}
                      type="monotone"
                      dataKey={`skill_${sk.skill_id}`}
                      name={sk.skill_name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Current skill status cards */}
          <SectionTitle>Current Status per Skill</SectionTitle>

          {!mastery || mastery.skills.length === 0 ? (
            <p className="meta">No mastery data yet.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              {mastery.skills.map((sk) => (
                <div
                  key={sk.skill_id}
                  className="student-skill-card"
                  style={{
                    border: `1px solid ${statusColor(sk.status)}40`,
                    borderTop: `3px solid ${statusColor(sk.status)}`,
                  }}
                >
                  <div className="student-skill-name">{sk.skill_name}</div>
                  <MiniBar
                    value={sk.current_p_mastery}
                    color={statusColor(sk.status)}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <Badge status={sk.status} />
                    <span className="meta" style={{ fontSize: 11 }}>
                      {sk.total_attempts} attempts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* What each status means */}
          <InfoBox
            title="What each status means — and what to do"
            accent="#a78bfa"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {STATUS_GUIDE.map((g) => (
                <div
                  key={g.status}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: statusColor(g.status) + "12",
                    border: `1px solid ${statusColor(g.status)}30`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Badge status={g.status} />
                    <span className="meta" style={{ fontSize: 11 }}>
                      {g.what}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 2px", fontSize: 12 }}>
                    {g.meaning}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--warning)",
                      fontWeight: 600,
                    }}
                  >
                    → {g.action}
                  </p>
                </div>
              ))}
            </div>
          </InfoBox>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: PERFORMANCE
         ══════════════════════════════════════════════════════ */}
      {tab === "performance" && (
        <div className="stack">
          <InfoBox title="What does this tab show?" accent="#4ade80">
            This tab tracks the student's <strong>raw answer behaviour</strong>{" "}
            — not what the system estimates, but what the student actually did:
            how often they were correct, how quickly they answered, and which
            specific questions they struggled with repeatedly.
          </InfoBox>

          {/* Accuracy trend */}
          <SectionTitle>Daily Answer Accuracy</SectionTitle>

          <InfoBox title="How to read the accuracy chart" accent="#4ade80">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <strong style={{ color: "#4ade80" }}>Above 70%</strong> —
                Student is answering well. Questions may be at the right
                difficulty level.
              </li>
              <li>
                <strong style={{ color: "#fbbf24" }}>40% – 70%</strong> — Normal
                learning zone. Some difficulty is expected and healthy.
              </li>
              <li>
                <strong style={{ color: "#f87171" }}>Below 40%</strong> —
                Questions may be too hard, or the student is guessing. Consider
                reviewing the topic.
              </li>
            </ul>
            <p style={{ margin: "8px 0 0" }}>
              A sudden <strong>drop</strong> in accuracy may coincide with a new
              skill being introduced. A sustained drop suggests the student
              needs additional support.
            </p>
          </InfoBox>

          {(trends?.buckets ?? []).length < 2 ? (
            <p className="meta">Not enough data yet.</p>
          ) : (
            <div className="student-chart-card">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={trends!.buckets}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v: any) => `${Math.round(Number(v) * 100)}%`}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <ReferenceLine
                    y={0.7}
                    stroke="#4ade80"
                    strokeDasharray="3 3"
                    label={{
                      value: "70% good",
                      fontSize: 10,
                      fill: "#4ade80",
                      position: "insideTopLeft",
                    }}
                  />
                  <ReferenceLine
                    y={0.4}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    label={{
                      value: "40% threshold",
                      fontSize: 10,
                      fill: "#fbbf24",
                      position: "insideTopLeft",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Response time trend */}
          <SectionTitle>Average Response Time per Day</SectionTitle>

          <InfoBox title="What response time tells you" accent="#60a5fa">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <strong style={{ color: "#4ade80" }}>Under 5 seconds</strong> —
                Quick, confident responses. Student likely knows the answer.
              </li>
              <li>
                <strong style={{ color: "#fbbf24" }}>5 – 8 seconds</strong> —
                Taking time to think. Normal for challenging questions.
              </li>
              <li>
                <strong style={{ color: "#f87171" }}>Over 8 seconds</strong> —
                Student may be struggling, re-reading the question, or guessing.
              </li>
            </ul>
            <p style={{ margin: "8px 0 0" }}>
              A gradual <strong>increase</strong> in response time often
              precedes a drop in accuracy — an early warning sign that content
              is becoming too difficult.
            </p>
          </InfoBox>

          {(trends?.buckets ?? []).filter((b) => b.avg_response_ms != null)
            .length < 2 ? (
            <p className="meta">Not enough response time data.</p>
          ) : (
            <div className="student-chart-card">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={trends!.buckets.filter(
                    (b) => b.avg_response_ms != null,
                  )}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={55}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                  />
                  <Tooltip
                    formatter={(v: any) => [
                      `${(Number(v) / 1000).toFixed(1)}s`,
                      "Avg response",
                    ]}
                  />
                  <ReferenceLine
                    y={8000}
                    stroke="#f87171"
                    strokeDasharray="3 3"
                    label={{
                      value: "8s — slow",
                      fontSize: 10,
                      fill: "#f87171",
                      position: "insideTopLeft",
                    }}
                  />
                  <ReferenceLine
                    y={5000}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    label={{
                      value: "5s",
                      fontSize: 10,
                      fill: "#fbbf24",
                      position: "insideTopLeft",
                    }}
                  />
                  <Bar
                    dataKey="avg_response_ms"
                    name="Avg response"
                    fill="#60a5fa"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Repeated errors */}
          <SectionTitle>
            Repeated Wrong Answers (answered incorrectly ≥ 2 times)
          </SectionTitle>

          {(trends?.repeated_errors ?? []).length === 0 ? (
            <p className="meta" style={{ color: "#4ade80" }}>
              ✓ No repeated errors — student has not persistently struggled with
              any single question.
            </p>
          ) : (
            <>
              <ActionTip>
                These questions were answered{" "}
                <strong>incorrectly multiple times</strong>. They represent
                specific knowledge gaps that the AI alone cannot fix.
                Recommended actions:
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  <li>
                    Review the underlying concept with the student in class
                  </li>
                  <li>Provide a worked example or explanation for the skill</li>
                  <li>Check whether the question wording may be confusing</li>
                </ul>
              </ActionTip>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Skill area</th>
                      <th style={{ textAlign: "right" }}>Wrong × times</th>
                      <th>Last attempted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends!.repeated_errors.map((e) => (
                      <tr key={e.question_id}>
                        <td
                          style={{
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={e.question_text}
                        >
                          {e.question_text}
                        </td>
                        <td>
                          <span style={{ color: "#60a5fa" }}>
                            {e.skill_name}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: "#f87171",
                            fontWeight: 700,
                          }}
                        >
                          {e.wrong_count}×
                        </td>
                        <td className="meta">
                          {e.last_attempted
                            ? new Date(e.last_attempted).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: ENGAGEMENT
         ══════════════════════════════════════════════════════ */}
      {tab === "engagement" && (
        <div className="stack">
          <InfoBox title="How is engagement measured?" accent="#a78bfa">
            <p style={{ margin: "0 0 8px" }}>
              Every <strong>10 seconds</strong> while the student is on the
              learning page, the system takes a snapshot from the student's
              camera and analyses it automatically. It checks:
            </p>
            <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              <li>
                <strong>Face detected</strong> — Is the student's face visible
                in the frame?
              </li>
              <li>
                <strong>Head pose</strong> — Is the student looking at the
                screen (frontal), or turned away?
              </li>
              <li>
                <strong>Stability</strong> — Is the student staying still
                (attentive) or moving around frequently?
              </li>
            </ul>
            <p style={{ margin: "0 0 8px" }}>
              These signals are combined into a single{" "}
              <strong>engagement score (0 – 100%)</strong>:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <span style={{ color: "#4ade80", fontWeight: 600 }}>
                  ≥ 70% — ENGAGED
                </span>
                : Student appears attentive and focused
              </li>
              <li>
                <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                  40% – 70% — PARTIALLY ENGAGED
                </span>
                : Some distraction detected
              </li>
              <li>
                <span style={{ color: "#f87171", fontWeight: 600 }}>
                  {"< 40% — DISENGAGED"}
                </span>
                : Student may be away from the screen or looking elsewhere
              </li>
            </ul>
            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
              ⚠ Note: Low scores can also be caused by{" "}
              <strong>poor lighting</strong>,{" "}
              <strong>backlit environments</strong>, or the camera not being
              positioned correctly — not necessarily disengagement. Check the
              "Face detected %" column to distinguish between technical issues
              and genuine disengagement.
            </p>
          </InfoBox>

          {/* KPI row */}
          <div className="teacher-kpi-grid">
            <KPI label="Overall engagement" sub="Average across all sessions">
              <span
                style={{ color: scoreColor(engagement?.overall_avg ?? null) }}
              >
                {engagement
                  ? `${Math.round(engagement.overall_avg * 100)}%`
                  : "—"}
              </span>
            </KPI>
            <KPI label="Engaged" sub="≥ 70% score">
              <span style={{ color: "#4ade80" }}>
                {totalEngSamples > 0
                  ? `${Math.round((statusDist.ENGAGED / totalEngSamples) * 100)}%`
                  : "—"}
              </span>
            </KPI>
            <KPI label="Partially engaged" sub="40 – 70% score">
              <span style={{ color: "#fbbf24" }}>
                {totalEngSamples > 0
                  ? `${Math.round((statusDist.PARTIALLY_ENGAGED / totalEngSamples) * 100)}%`
                  : "—"}
              </span>
            </KPI>
            <KPI label="Disengaged" sub="< 40% score">
              <span style={{ color: "#f87171" }}>
                {totalEngSamples > 0
                  ? `${Math.round((statusDist.DISENGAGED / totalEngSamples) * 100)}%`
                  : "—"}
              </span>
            </KPI>
          </div>

          {/* Engagement chart */}
          <SectionTitle>
            Engagement Score per Session (last 30 days)
          </SectionTitle>

          {engagementChartData.length === 0 ? (
            <p className="meta">
              No engagement data yet — camera tracking may not be active for
              this student.
            </p>
          ) : (
            <div className="student-chart-card">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={engagementChartData}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [`${v}%`, name]}
                    labelFormatter={(l) => `Session: ${l}`}
                  />
                  <ReferenceLine
                    y={70}
                    stroke="#4ade80"
                    strokeDasharray="3 3"
                    label={{
                      value: "70% engaged",
                      fontSize: 10,
                      fill: "#4ade80",
                      position: "insideTopLeft",
                    }}
                  />
                  <ReferenceLine
                    y={40}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    label={{
                      value: "40%",
                      fontSize: 10,
                      fill: "#fbbf24",
                      position: "insideTopLeft",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    name="Engagement score"
                    stroke="#a78bfa"
                    fill="url(#engGrad)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="face"
                    name="Face detected %"
                    stroke="#4ade80"
                    strokeWidth={1}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <p className="meta" style={{ fontSize: 12, marginTop: 10 }}>
                Solid area = engagement score. Dashed green line = % of
                snapshots where student's face was visible. If the dashed line
                is low but engagement score is also low, it may be a{" "}
                <strong>camera/lighting issue</strong>.
              </p>
            </div>
          )}

          {/* Action tip for low engagement */}
          {engagement && engagement.overall_avg < 0.5 && (
            <ActionTip>
              <strong>This student's average engagement is below 50%.</strong>{" "}
              Before concluding the student is disengaged, check if there is a
              technical reason (low "Face detected %" in the table below). If
              face detection is also high but scores are low, the student may
              benefit from:
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                <li>
                  A discussion about their learning habits and study environment
                </li>
                <li>Checking whether the content difficulty is appropriate</li>
                <li>Shorter, more frequent practice sessions</li>
              </ul>
            </ActionTip>
          )}

          {/* Session table */}
          {(engagement?.sessions ?? []).length > 0 && (
            <>
              <SectionTitle>Session-by-Session Details</SectionTitle>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Engagement score</th>
                      <th style={{ textAlign: "right" }}>Face detected</th>
                      <th style={{ textAlign: "right" }}>Snapshots taken</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagement!.sessions
                      .slice(-15)
                      .reverse()
                      .map((s) => {
                        const engPct = s.avg_visual_engagement;
                        const engStatus =
                          engPct >= 0.7
                            ? "ENGAGED"
                            : engPct >= 0.4
                              ? "PARTIALLY ENGAGED"
                              : "DISENGAGED";
                        const engColor =
                          engPct >= 0.7
                            ? "#4ade80"
                            : engPct >= 0.4
                              ? "#fbbf24"
                              : "#f87171";
                        return (
                          <tr key={s.session_id}>
                            <td className="meta">
                              {s.session_start
                                ? new Date(s.session_start).toLocaleDateString()
                                : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                color: scoreColor(s.avg_visual_engagement),
                                fontWeight: 600,
                              }}
                            >
                              {Math.round(s.avg_visual_engagement * 100)}%
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                color:
                                  s.face_detected_pct < 0.5
                                    ? "#f87171"
                                    : "#94a3b8",
                              }}
                            >
                              {Math.round(s.face_detected_pct * 100)}%
                              {s.face_detected_pct < 0.5 && (
                                <span title="Face rarely detected — may be a camera/lighting issue">
                                  {" "}
                                  ⚠
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {s.sample_count}
                            </td>
                            <td>
                              <span
                                style={{
                                  color: engColor,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {engStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: PERSONALIZATION
         ══════════════════════════════════════════════════════ */}
      {tab === "personalization" && (
        <div className="stack">
          {/* Main explanation — always open */}
          <InfoBox
            title="How does the personalization system work?"
            accent="#f472b6"
            defaultOpen
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#60a5fa15",
                  border: "1px solid #60a5fa30",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontWeight: 700,
                    color: "#60a5fa",
                  }}
                >
                  📐 BKT — Bayesian Knowledge Tracing
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  A <strong>rule-based statistical model</strong> that updates
                  mastery probabilities using 4 fixed parameters:
                </p>
                <ul style={{ margin: "0", paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>
                    <strong>Prior (10%)</strong> — assumed starting knowledge
                  </li>
                  <li>
                    <strong>Learning rate (20%)</strong> — probability of
                    learning per correct answer
                  </li>
                  <li>
                    <strong>Slip (10%)</strong> — chance of a wrong answer even
                    when skilled
                  </li>
                  <li>
                    <strong>Guess (20%)</strong> — chance of a right answer
                    without knowing
                  </li>
                </ul>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--muted)",
                    fontSize: 12,
                  }}
                >
                  ✓ Works from question 1. Reliable and predictable.
                </p>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#f472b615",
                  border: "1px solid #f472b630",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontWeight: 700,
                    color: "#f472b6",
                  }}
                >
                  🤖 DKT — Deep Knowledge Tracing
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  An <strong>AI (neural network) model</strong> that learns the
                  student's individual patterns from their full answer history.
                </p>
                <ul style={{ margin: "0", paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>Learns which skills transfer knowledge to each other</li>
                  <li>Adapts to this student's unique learning style</li>
                  <li>More accurate — but needs enough data first</li>
                </ul>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--muted)",
                    fontSize: 12,
                  }}
                >
                  ✓ Becomes reliable after ~20 answers per skill.
                </p>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fbbf2415",
                  border: "1px solid #fbbf2430",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontWeight: 700,
                    color: "#fbbf24",
                  }}
                >
                  ⚖ Fusion — Best of Both
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  The final mastery estimate <strong>blends both models</strong>{" "}
                  automatically based on how much data is available:
                </p>
                <ul style={{ margin: "0", paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>
                    <strong>0 attempts</strong> → 100% BKT, 0% DKT
                  </li>
                  <li>
                    <strong>10 attempts</strong> → 70% BKT, 30% DKT
                  </li>
                  <li>
                    <strong>≥20 attempts</strong> → 40% BKT, 60% DKT
                  </li>
                </ul>
                <p
                  style={{
                    margin: "6px 0 4px",
                    fontStyle: "italic",
                    color: "var(--muted)",
                    fontSize: 12,
                  }}
                >
                  Final mastery = (BKT weight × BKT estimate) + (DKT weight ×
                  DKT estimate)
                </p>
              </div>
            </div>
          </InfoBox>

          {/* Chart */}
          <SectionTitle>BKT vs DKT Blend per Skill</SectionTitle>

          {(fusion?.skills ?? []).length === 0 ? (
            <p className="meta">
              No personalization data yet — student has not practised any
              skills.
            </p>
          ) : (
            <div className="student-chart-card">
              <p className="meta" style={{ fontSize: 12, marginBottom: 10 }}>
                Each bar shows the current model blend for that skill.
                <span style={{ color: "#60a5fa" }}> Blue (BKT)</span> =
                classical model,
                <span style={{ color: "#f472b6" }}> Pink (DKT)</span> = AI
                model. More pink = more data collected = more personalised.
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={fusion!.skills.map((sk) => ({
                    name:
                      sk.skill_name.length > 12
                        ? sk.skill_name.slice(0, 12) + "…"
                        : sk.skill_name,
                    BKT: Math.round(sk.weight_bkt * 100),
                    DKT: Math.round(sk.weight_dkt * 100),
                    attempts: sk.attempts,
                  }))}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [
                      `${v}%`,
                      `${name} weight`,
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="BKT" name="BKT" stackId="a" fill="#60a5fa" />
                  <Bar
                    dataKey="DKT"
                    name="DKT"
                    stackId="a"
                    fill="#f472b6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fusion detail table */}
          <SectionTitle>Mastery Estimates per Skill</SectionTitle>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Status</th>
                  <th
                    style={{ textAlign: "right" }}
                    title="Total questions answered for this skill"
                  >
                    Attempts
                  </th>
                  <th
                    style={{ textAlign: "right" }}
                    title="How much of the final score comes from BKT"
                  >
                    BKT weight
                  </th>
                  <th
                    style={{ textAlign: "right" }}
                    title="How much of the final score comes from DKT"
                  >
                    DKT weight
                  </th>
                  <th
                    style={{ textAlign: "right" }}
                    title="BKT's estimate of mastery"
                  >
                    BKT mastery
                  </th>
                  <th
                    style={{ textAlign: "right" }}
                    title="DKT's estimate of mastery"
                  >
                    DKT mastery
                  </th>
                  <th
                    style={{ textAlign: "right" }}
                    title="Final blended mastery used for recommendations"
                  >
                    Final mastery
                  </th>
                </tr>
              </thead>
              <tbody>
                {(fusion?.skills ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: "center", color: "var(--muted)" }}
                    >
                      No data yet
                    </td>
                  </tr>
                ) : (
                  fusion!.skills.map((sk) => (
                    <tr key={sk.skill_id}>
                      <td style={{ fontWeight: 500 }}>{sk.skill_name}</td>
                      <td>
                        <Badge status={sk.status} />
                      </td>
                      <td style={{ textAlign: "right" }}>{sk.attempts}</td>
                      <td style={{ textAlign: "right", color: "#60a5fa" }}>
                        {Math.round(sk.weight_bkt * 100)}%
                      </td>
                      <td style={{ textAlign: "right", color: "#f472b6" }}>
                        {Math.round(sk.weight_dkt * 100)}%
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Pct v={sk.bkt_mastery} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {sk.dkt_mastery != null ? (
                          <Pct v={sk.dkt_mastery} />
                        ) : (
                          <span className="meta" title="Needs more data">
                            not enough data
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        <Pct v={sk.fused_mastery} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ActionTip>
            <strong>What does this mean for you as a teacher?</strong>
            <br />
            Skills where DKT weight is still 0% (all-blue bars) are in{" "}
            <strong>cold-start mode</strong> — the AI hasn't collected enough
            data yet. The system's mastery estimates for these skills are less
            adaptive but still statistically sound. Encourage the student to
            attempt more questions in those skills so the AI can learn their
            individual patterns and provide better-tailored practice.
          </ActionTip>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: EXPLAINABILITY (XAI)
         ══════════════════════════════════════════════════════ */}
      {tab === "explainability" && (
        <div className="stack">
          <InfoBox title="What does this tab show?" accent="#a78bfa">
            <p style={{ margin: "0 0 8px" }}>
              This is the AI's <strong>decision-by-decision audit trail</strong>{" "}
              for this student — every time the tutor chose to hint, explain,
              remediate, or encourage, the system logged exactly why.
            </p>
            <p style={{ margin: 0 }}>
              This is different from the <strong>Personalization</strong> tab,
              which explains the BKT/DKT methodology in general. Here, each row
              is one specific decision, with the reasons and signals that led to
              it.
            </p>
          </InfoBox>

          {decisionsError && <p className="feedback error">{decisionsError}</p>}

          {decisionSummary && decisionSummary.total_decisions > 0 && (
            <div
              className="teacher-kpi-grid"
              style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}
            >
              <KPI label="Total decisions">
                {decisionSummary.total_decisions}
              </KPI>
              <KPI label="Most common action">
                {decisionSummary.most_common_action
                  ? teachingActionLabel(decisionSummary.most_common_action)
                  : "—"}
              </KPI>
              <KPI label="High confidence">
                {Math.round(decisionSummary.high_confidence_pct * 100)}%
              </KPI>
              <KPI label="Override rate">
                {Math.round(decisionSummary.override_rate * 100)}%
              </KPI>
            </div>
          )}

          {decisionSummary &&
            Object.keys(decisionSummary.action_distribution).length > 0 && (
              <div className="student-chart-card">
                <p className="meta" style={{ fontSize: 12, marginBottom: 10 }}>
                  How often each teaching action was used.
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={Object.entries(
                      decisionSummary.action_distribution,
                    ).map(([name, count]) => ({
                      name: teachingActionLabel(name),
                      count,
                    }))}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      width={30}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          <SectionTitle>Decision timeline</SectionTitle>

          {decisionsLoading && !decisions ? (
            <p className="meta">Loading…</p>
          ) : !decisions || decisions.decisions.length === 0 ? (
            <p className="meta">
              No AI decisions recorded yet for this student.
            </p>
          ) : (
            <>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {decisions.decisions.map((d: DecisionItem) => (
                  <div
                    key={d.id}
                    className="student-chart-card"
                    style={{ padding: 16 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>
                          {teachingActionLabel(d.teaching_action)}
                        </strong>
                        {d.remediation_strategy !== "none" && (
                          <span className="meta" style={{ marginLeft: 8 }}>
                            · {remediationStrategyLabel(d.remediation_strategy)}
                          </span>
                        )}
                        {d.skill_name && (
                          <span className="meta" style={{ marginLeft: 8 }}>
                            · {d.skill_name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            background: `${confidenceColor(d.confidence)}22`,
                            color: confidenceColor(d.confidence),
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {d.confidence}
                        </span>
                        <span className="meta" style={{ fontSize: 12 }}>
                          {new Date(d.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {d.reasons.length > 0 && (
                      <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                        {d.reasons.map((r, i) => (
                          <li
                            key={i}
                            className="meta"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}

                    {Object.keys(d.signals || {}).length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px 16px",
                          marginTop: 10,
                        }}
                      >
                        {Object.entries(d.signals).map(([k, v]) => (
                          <span
                            key={k}
                            className="meta"
                            style={{ fontSize: 12 }}
                          >
                            <strong style={{ color: "var(--text)" }}>
                              {k}:
                            </strong>{" "}
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    )}

                    {d.overrides_applied.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {d.overrides_applied.map((o, i) => (
                          <span
                            key={i}
                            className="badge danger"
                            style={{ fontSize: 11 }}
                          >
                            {o}
                          </span>
                        ))}
                      </div>
                    )}

                    {d.teacher_feedback && (
                      <p
                        className="meta"
                        style={{ marginTop: 10, fontStyle: "italic" }}
                      >
                        Reviewed: {d.teacher_feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {decisions.decisions.length < decisions.total && (
                <button
                  type="button"
                  className="skills-action secondary"
                  disabled={decisionsLoading}
                  onClick={loadMoreDecisions}
                >
                  {decisionsLoading
                    ? "Loading…"
                    : `Load more (${decisions.decisions.length} of ${decisions.total})`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
