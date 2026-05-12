/**
 * Teacher Analytics API — client functions
 * All calls require a teacher/admin auth token.
 */
import { apiClient } from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentDetailed {
  user_id: number
  username: string
  full_name: string
  email: string
  overall_score: number | null
  total_interactions: number
  mastered_skills: number
  struggling_skills: number
  last_active: string | null
  zpd_status: 'mastered' | 'near_mastery' | 'learning' | 'struggling' | 'not_started'
}

export interface HeatmapData {
  students: { user_id: number; username: string; full_name: string }[]
  skills:   { skill_id: number; skill_name: string }[]
  matrix:   {
    user_id: number; skill_id: number
    p_mastery: number; is_mastered: boolean
    attempts: number; status: string
  }[]
}

export interface MasteryHistorySkill {
  skill_id: number
  skill_name: string
  events: { timestamp: string; p_mastery: number; event_type: string }[]
  current_p_mastery: number
  status: string
  total_attempts: number
  is_mastered: boolean
}

export interface InteractionTrends {
  user_id: number
  buckets: {
    date: string
    total: number
    correct: number
    accuracy: number
    avg_response_ms: number | null
  }[]
  repeated_errors: {
    question_id: number
    question_text: string
    skill_id: number
    skill_name: string
    wrong_count: number
    last_attempted: string | null
  }[]
}

export interface EngagementTimeline {
  user_id: number
  sessions: {
    session_id: string
    session_start: string | null
    avg_visual_engagement: number
    face_detected_pct: number
    sample_count: number
  }[]
  overall_avg: number
  status_distribution: { ENGAGED: number; PARTIALLY_ENGAGED: number; DISENGAGED: number }
}

export interface FusionWeights {
  user_id: number
  skills: {
    skill_id: number
    skill_name: string
    attempts: number
    weight_bkt: number
    weight_dkt: number
    bkt_mastery: number
    dkt_mastery: number | null
    fused_mastery: number | null
    status: string
  }[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getStudentsDetailed(): Promise<StudentDetailed[]> {
  const r = await apiClient.get('/api/v1/analytics/students/detailed')
  return r.data
}

export async function getClassHeatmap(): Promise<HeatmapData> {
  const r = await apiClient.get('/api/v1/analytics/class-heatmap')
  return r.data
}

export async function getStudentMasteryHistory(userId: number): Promise<{ user_id: number; skills: MasteryHistorySkill[] }> {
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}/mastery-history`)
  return r.data
}

export async function getStudentInteractionTrends(userId: number, skillId?: number): Promise<InteractionTrends> {
  const params = skillId ? { skill_id: skillId } : {}
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}/interaction-trends`, { params })
  return r.data
}

export async function getStudentEngagementTimeline(userId: number, days = 30): Promise<EngagementTimeline> {
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}/engagement-timeline`, { params: { days } })
  return r.data
}

export async function getStudentFusionWeights(userId: number): Promise<FusionWeights> {
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}/fusion-weights`)
  return r.data
}

export async function getStudentAnalytics(userId: number) {
  const r = await apiClient.get(`/api/v1/analytics/student/${userId}`)
  return r.data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function statusColor(status: string): string {
  switch (status) {
    case 'mastered':     return '#4ade80'
    case 'near_mastery': return '#60a5fa'
    case 'learning':     return '#fbbf24'
    case 'struggling':   return '#f87171'
    default:             return '#94a3b8'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'mastered':     return 'Mastered'
    case 'near_mastery': return 'Near Mastery'
    case 'learning':     return 'Learning'
    case 'struggling':   return 'Struggling'
    default:             return 'Not Started'
  }
}

export function scoreColor(score: number | null): string {
  if (score == null) return '#94a3b8'
  if (score >= 0.7)  return '#4ade80'
  if (score >= 0.4)  return '#fbbf24'
  return '#f87171'
}
