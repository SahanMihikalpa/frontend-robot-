/**
 * Teacher Analytics API — client functions
 * All calls require a teacher/admin auth token.
 */
import { apiClient, JsonObject } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentDetailed {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  overall_score: number | null;
  total_interactions: number;
  mastered_skills: number;
  struggling_skills: number;
  last_active: string | null;
  zpd_status:
    | "mastered"
    | "near_mastery"
    | "learning"
    | "struggling"
    | "not_started";
}

export interface HeatmapData {
  students: { user_id: number; username: string; full_name: string }[];
  skills: { skill_id: number; skill_name: string }[];
  matrix: {
    user_id: number;
    skill_id: number;
    p_mastery: number;
    is_mastered: boolean;
    attempts: number;
    status: string;
  }[];
}

export interface MasteryHistorySkill {
  skill_id: number;
  skill_name: string;
  events: { timestamp: string; p_mastery: number; event_type: string }[];
  current_p_mastery: number;
  status: string;
  total_attempts: number;
  is_mastered: boolean;
}

export interface InteractionTrends {
  user_id: number;
  buckets: {
    date: string;
    total: number;
    correct: number;
    accuracy: number;
    avg_response_ms: number | null;
  }[];
  repeated_errors: {
    question_id: number;
    question_text: string;
    skill_id: number;
    skill_name: string;
    wrong_count: number;
    last_attempted: string | null;
  }[];
}

export interface EngagementTimeline {
  user_id: number;
  sessions: {
    session_id: string;
    session_start: string | null;
    avg_visual_engagement: number;
    face_detected_pct: number;
    sample_count: number;
  }[];
  overall_avg: number;
  status_distribution: {
    ENGAGED: number;
    PARTIALLY_ENGAGED: number;
    DISENGAGED: number;
  };
}

export interface FusionWeights {
  user_id: number;
  skills: {
    skill_id: number;
    skill_name: string;
    attempts: number;
    weight_bkt: number;
    weight_dkt: number;
    bkt_mastery: number;
    dkt_mastery: number | null;
    fused_mastery: number | null;
    status: string;
  }[];
}

// ── XAI / explainability types ──────────────────────────────────────────────

export interface DecisionItem {
  id: number;
  timestamp: string; // ISO datetime string
  skill_id: number | null;
  skill_name: string | null;
  teaching_action: string;
  remediation_strategy: string; // backend defaults to the literal string "none"
  confidence: string; // "HIGH" | "MEDIUM" | "LOW"
  reasons: string[];
  signals: JsonObject;
  overrides_applied: string[];
  teacher_feedback: string | null;
  teacher_override_to: string | null;
}

export interface DecisionListResponse {
  decisions: DecisionItem[];
  total: number;
}

export interface DecisionSummary {
  total_decisions: number;
  most_common_action: string | null;
  high_confidence_pct: number;
  override_rate: number;
  action_distribution: Record<string, number>;
}

// GET /explanations/class/patterns has two genuinely different response
// shapes depending on whether any decisions exist yet — model that honestly
// rather than pretending the chart-only fields are always present.
export interface ClassPatterns {
  total: number;
  action_distribution?: Record<string, number>;
  remediation_triggers?: Record<string, number>;
  override_rate?: number;
  window?: string; // echoed back so the UI can state the period it charted
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getStudentsDetailed(): Promise<StudentDetailed[]> {
  const r = await apiClient.get("/api/v1/analytics/students/detailed");
  return r.data;
}

export async function getClassHeatmap(): Promise<HeatmapData> {
  const r = await apiClient.get("/api/v1/analytics/class-heatmap");
  return r.data;
}

export async function getStudentMasteryHistory(
  userId: number,
): Promise<{ user_id: number; skills: MasteryHistorySkill[] }> {
  const r = await apiClient.get(
    `/api/v1/analytics/student/${userId}/mastery-history`,
  );
  return r.data;
}

export async function getStudentInteractionTrends(
  userId: number,
  skillId?: number,
): Promise<InteractionTrends> {
  const params = skillId ? { skill_id: skillId } : {};
  const r = await apiClient.get(
    `/api/v1/analytics/student/${userId}/interaction-trends`,
    { params },
  );
  return r.data;
}

export async function getStudentEngagementTimeline(
  userId: number,
  days = 30,
): Promise<EngagementTimeline> {
  const r = await apiClient.get(
    `/api/v1/analytics/student/${userId}/engagement-timeline`,
    { params: { days } },
  );
  return r.data;
}

export async function getStudentFusionWeights(
  userId: number,
): Promise<FusionWeights> {
  const r = await apiClient.get(
    `/api/v1/analytics/student/${userId}/fusion-weights`,
  );
  return r.data;
}

export async function getStudentAnalytics(userId: number) {
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}`);
  return r.data;
}

// ── XAI / explainability calls ──────────────────────────────────────────────
// Note: POST /explanations/{id}/feedback (teacher agree/disagree/override) is
// intentionally not wrapped here yet — out of scope for the current pass.

export async function getStudentDecisions(
  userId: number,
  params?: {
    limit?: number;
    skip?: number;
    action?: string;
    session_id?: string;
  },
): Promise<DecisionListResponse> {
  const r = await apiClient.get(`/api/v1/explanations/student/${userId}`, {
    params,
  });
  return r.data;
}

export async function getStudentDecisionSummary(
  userId: number,
): Promise<DecisionSummary> {
  const r = await apiClient.get(
    `/api/v1/explanations/student/${userId}/summary`,
  );
  return r.data;
}

// Period covered by the AI-decision panels. Every request on that page sends the
// same value, so the charts and the student lists can never describe different
// periods while sitting next to each other.
export type DecisionWindow = "24h" | "7d" | "30d" | "all";

export const DECISION_WINDOWS: { value: DecisionWindow; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

/** Lower-case phrase for sentences, e.g. "in the last 7 days". */
export function windowPhrase(w: DecisionWindow): string {
  return w === "all" ? "all time" : (DECISION_WINDOWS.find((o) => o.value === w)?.label ?? w).toLowerCase();
}

export async function getClassPatterns(
  window: DecisionWindow = "all",
): Promise<ClassPatterns> {
  const r = await apiClient.get("/api/v1/explanations/class/patterns", {
    params: { window },
  });
  return r.data;
}

export interface FlaggedStudent {
  user_id: number;
  username: string;
  full_name: string | null;
  flagged_at: string; // ISO datetime
  teaching_action: string;
  reasons: string[];
  avg_mastery: number;
}

// Students flagged with remediation_strategy=="flag_teacher" within the window —
// the concrete "who" behind the class-wide flag_teacher count.
export async function getFlaggedStudents(
  window: DecisionWindow = "24h",
): Promise<FlaggedStudent[]> {
  const r = await apiClient.get("/api/v1/analytics/flagged-students", {
    params: { window },
  });
  return r.data;
}

export interface DecisionStudent {
  user_id: number;
  username: string;
  full_name: string | null;
  last_at: string; // ISO datetime
  count: number;
  reasons: string[];
  avg_mastery: number;
}

// The students behind one bar of the decision charts — `kind` selects which
// column the value matches, so one endpoint serves both charts.
export async function getDecisionStudents(
  kind: "action" | "strategy",
  value: string,
  window: DecisionWindow = "all",
): Promise<DecisionStudent[]> {
  const r = await apiClient.get("/api/v1/analytics/decision-students", {
    params: { kind, value, window },
  });
  return r.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function statusColor(status: string): string {
  switch (status) {
    case "mastered":
      return "#4ade80";
    case "near_mastery":
      return "#60a5fa";
    case "learning":
      return "#fbbf24";
    case "struggling":
      return "#f87171";
    default:
      return "#94a3b8";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "mastered":
      return "Mastered";
    case "near_mastery":
      return "Near Mastery";
    case "learning":
      return "Learning";
    case "struggling":
      return "Struggling";
    default:
      return "Not Started";
  }
}

export function scoreColor(score: number | null): string {
  if (score == null) return "#94a3b8";
  if (score >= 0.7) return "#4ade80";
  if (score >= 0.4) return "#fbbf24";
  return "#f87171";
}

// Same thresholds as heatmap.tsx's ACTION_GUIDE / cellBg, so a skill graph
// node's color always agrees with the heatmap's for the same skill.
export function avgScoreToStatus(
  score: number | null | undefined,
): "mastered" | "near_mastery" | "learning" | "struggling" | "not_started" {
  if (score == null) return "not_started";
  if (score >= 0.95) return "mastered";
  if (score >= 0.85) return "near_mastery";
  if (score >= 0.3) return "learning";
  return "struggling";
}

// Human-readable labels for the raw backend enum values (app/ml/agents/base_agent.py
// TeachingAction, app/services/remediation_service.py RemediationStrategy) — used
// everywhere these show up (charts, decision timeline, flagged-students list) so a
// teacher never sees a raw snake_case identifier like "flag_teacher" or "same_hint".
const TEACHING_ACTION_LABELS: Record<string, string> = {
  explain: "Explain",
  hint: "Hint",
  remediate: "Remediate",
  advance: "Advance",
  encourage: "Encourage",
  practice: "Practice",
};

export function teachingActionLabel(action: string): string {
  return TEACHING_ACTION_LABELS[action] || action;
}

const REMEDIATION_STRATEGY_LABELS: Record<string, string> = {
  same_hint: "Same hint again",
  analogy_example: "Analogy + example",
  decompose: "Broken into steps",
  flag_teacher: "Flagged for teacher",
  none: "None",
};

export function remediationStrategyLabel(strategy: string): string {
  return REMEDIATION_STRATEGY_LABELS[strategy] || strategy;
}

export function confidenceColor(confidence: string): string {
  switch (confidence) {
    case "HIGH":
      return "#4ade80";
    case "MEDIUM":
      return "#fbbf24";
    case "LOW":
      return "#f87171";
    default:
      return "#94a3b8";
  }
}
