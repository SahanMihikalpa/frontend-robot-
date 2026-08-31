import axios, { type AxiosInstance } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const AUTH_TOKEN_KEY = 'token'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

function readToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function writeToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
}

function dropToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
  delete apiClient.defaults.headers.common.Authorization
}

export function getApiBaseUrl() {
  return BASE_URL
}

export function getAuthToken() {
  return readToken()
}

export function setAuthToken(token: string) {
  writeToken(token)
}

export function clearAuthToken() {
  dropToken()
}

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = readToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      dropToken()
    }
    return Promise.reject(error)
  },
)

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

function toFormUrlEncoded(data: Record<string, string>) {
  const body = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => body.set(key, value))
  return body
}

function wsBaseUrl() {
  const url = new URL(BASE_URL)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString().replace(/\/$/, '')
}

export async function registerUser(payload: {
  email: string
  username: string
  full_name: string
  password: string
  role: 'student' | 'teacher' | 'admin'
}) {
  const { data } = await apiClient.post('/api/v1/auth/register', payload)
  return data
}

export async function loginUser(username: string, password: string) {
  const { data } = await apiClient.post(
    '/api/v1/auth/login',
    toFormUrlEncoded({ username, password }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )

  if (data?.access_token) {
    setAuthToken(data.access_token)
  }

  return data
}

export async function getCurrentUser() {
  const { data } = await apiClient.get('/api/v1/auth/me')
  return data
}

// Extend the session — issues a fresh token. Called on activity so an active
// study session never hits the token's expiry (sliding session).
export async function refreshSession() {
  const { data } = await apiClient.post('/api/v1/auth/refresh')
  if (data?.access_token) setAuthToken(data.access_token)
  return data
}

// Best-effort server logout (JWT is stateless); the caller then clears the token.
export async function logoutRequest() {
  try { await apiClient.post('/api/v1/auth/logout') } catch { /* token may already be gone */ }
}

export async function listSkills() {
  const { data } = await apiClient.get('/api/v1/skills/')
  return data
}

export async function getSkill(id: number) {
  const { data } = await apiClient.get(`/api/v1/skills/${id}`)
  return data
}

export async function createSkill(payload: {
  name: string
  description?: string
  category?: string
  difficulty_level?: number
}) {
  const { data } = await apiClient.post('/api/v1/skills/', payload)
  return data
}

export async function updateSkill(
  id: number,
  payload: {
    name?: string
    description?: string
    category?: string
    difficulty_level?: number
  },
) {
  const { data } = await apiClient.put(`/api/v1/skills/${id}`, payload)
  return data
}

export async function deleteSkill(id: number) {
  const { data } = await apiClient.delete(`/api/v1/skills/${id}`)
  return data
}

export async function getSkillGraph() {
  const { data } = await apiClient.get('/api/v1/skills/graph')
  return data
}

export interface SkillPrerequisiteEdge {
  id: number
  skill_id: number
  prerequisite_id: number
  prerequisite_name: string
}

export async function listSkillPrerequisites(skillId: number): Promise<SkillPrerequisiteEdge[]> {
  const { data } = await apiClient.get(`/api/v1/skills/${skillId}/prerequisites`)
  return data
}

export async function addSkillPrerequisite(skillId: number, prerequisiteId: number): Promise<SkillPrerequisiteEdge> {
  const { data } = await apiClient.post(`/api/v1/skills/${skillId}/prerequisites`, { prerequisite_id: prerequisiteId })
  return data
}

// The second path segment is the *prerequisite skill's own id* (matches
// SkillPrerequisite.prerequisite_id on the backend), not a join-row id.
export async function removeSkillPrerequisite(skillId: number, prerequisiteId: number): Promise<void> {
  await apiClient.delete(`/api/v1/skills/${skillId}/prerequisites/${prerequisiteId}`)
}

export async function listQuestions(params?: { skill_id?: number; skip?: number; limit?: number }) {
  const { data } = await apiClient.get('/api/v1/questions/', { params })
  return data
}

export async function getQuestion(id: number) {
  const { data } = await apiClient.get(`/api/v1/questions/${id}`)
  return data
}

export async function createQuestion(payload: {
  skill_id: number
  question_text: string
  question_type: string
  options?: JsonObject
  correct_answer?: string
  difficulty?: number
}) {
  const { data } = await apiClient.post('/api/v1/questions/', payload)
  return data
}

export async function updateQuestion(
  id: number,
  payload: Partial<{
    skill_id: number
    question_text: string
    question_type: string
    options: JsonObject
    correct_answer: string
    difficulty: number
  }>,
) {
  const { data } = await apiClient.put(`/api/v1/questions/${id}`, payload)
  return data
}

export async function deleteQuestion(id: number) {
  const { data } = await apiClient.delete(`/api/v1/questions/${id}`)
  return data
}

// ── CSV bulk import ──────────────────────────────────────────────────────────

export type BulkImportResult = {
  total_rows: number
  created: number
  skipped: number
  errors: { row: number; error: string }[]
  notes?: string[]
}

async function downloadCsv(path: string, filename: string) {
  const { data } = await apiClient.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadSkillsCsvTemplate() {
  return downloadCsv('/api/v1/skills/bulk-template', 'skills_template.csv')
}

export function downloadQuestionsCsvTemplate() {
  return downloadCsv('/api/v1/questions/bulk-template', 'questions_template.csv')
}

async function uploadCsv(path: string, file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post(path, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function bulkImportSkills(file: File) {
  return uploadCsv('/api/v1/skills/bulk-import', file)
}

export function bulkImportQuestions(file: File) {
  return uploadCsv('/api/v1/questions/bulk-import', file)
}

// ── User management (admin only) ─────────────────────────────────────────────

export type AdminUser = {
  id: number
  username: string
  email: string
  full_name?: string | null
  role: 'student' | 'teacher' | 'admin'
  is_active: boolean
}

export async function listUsers(params?: { role?: string; search?: string }): Promise<AdminUser[]> {
  const { data } = await apiClient.get('/api/v1/users/', { params })
  return data
}

export async function updateUser(
  id: number,
  payload: { role?: 'student' | 'teacher' | 'admin'; is_active?: boolean },
): Promise<AdminUser> {
  const { data } = await apiClient.patch(`/api/v1/users/${id}`, payload)
  return data
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/users/${id}`)
}

export function downloadUsersCsvTemplate() {
  return downloadCsv('/api/v1/users/bulk-template', 'users_template.csv')
}

export function bulkImportUsers(file: File) {
  return uploadCsv('/api/v1/users/bulk-import', file)
}

export async function createInteraction(payload: {
  question_id: number
  skill_id: number
  is_correct: boolean
  time_taken: number
  session_id?: string
}) {
  const { data } = await apiClient.post('/api/v1/interactions/', payload)
  return data
}

export async function getMyInteractions(params?: { skill_id?: number }) {
  const { data } = await apiClient.get('/api/v1/interactions/me', { params })
  return data
}

export async function getInteraction(id: number) {
  const { data } = await apiClient.get(`/api/v1/interactions/${id}`)
  return data
}

export async function getNextQuestion(params?: { strategy?: 'bkt_zpd' | 'zone_proximal' | 'dkt_legacy' }) {
  const { data } = await apiClient.get('/api/v1/dkt/next-question', { params })
  return data
}

export async function getDktPredictions(student_id: number) {
  const { data } = await apiClient.get('/api/v1/dkt/predictions', { params: { student_id } })
  return data
}

export async function getKnowledgeState(student_id: number) {
  const { data } = await apiClient.get('/api/v1/dkt/knowledge-state', { params: { student_id } })
  return data
}

export async function trainDktModel() {
  const { data } = await apiClient.post('/api/v1/dkt/train')
  return data
}

export async function getBktState(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/bkt/state/${user_id}`)
  return data
}

export async function getBktSkillState(user_id: number, skill_id: number) {
  const { data } = await apiClient.get(`/api/v1/bkt/state/${user_id}/${skill_id}`)
  return data
}

export async function getBktParameters(skill_id: number) {
  const { data } = await apiClient.get(`/api/v1/bkt/parameters/${skill_id}`)
  return data
}

export async function setBktParameters(
  skill_id: number,
  payload: { p_l0: number; p_t: number; p_s: number; p_g: number },
) {
  const { data } = await apiClient.put(`/api/v1/bkt/parameters/${skill_id}`, payload)
  return data
}

export async function fitBktParameters() {
  const { data } = await apiClient.post('/api/v1/bkt/fit-parameters')
  return data
}

export async function getMasteryProgress(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/mastery/progress/${user_id}`)
  return data
}

export async function getConceptMap(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/mastery/concept-map/${user_id}`)
  return data
}

export async function getMasterySummary(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/mastery/summary/${user_id}`)
  return data
}

export async function getNextSkill(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/mastery/next/${user_id}`)
  return data
}

export async function getUnlockedSkills(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/mastery/unlocked/${user_id}`)
  return data
}

export async function resetBktState(user_id: number, skill_id: number) {
  const { data } = await apiClient.post(`/api/v1/mastery/reset/${user_id}/${skill_id}`)
  return data
}

export async function askTutor(payload: { query: string; user_id: number; domain?: string; session_id?: string }) {
  const body = { session_id: `tutor-${Date.now()}`, ...payload }
  const { data } = await apiClient.post('/api/v1/tutor/ask', body)
  return data
}

export async function getTutorProgress() {
  const { data } = await apiClient.get('/api/v1/tutor/progress')
  return data
}

export async function getLearningPath(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/tutor/learning-path/${user_id}`)
  return data
}

export async function getTutorHints(payload: JsonObject) {
  const { data } = await apiClient.post('/api/v1/tutor/hints', payload)
  return data
}

export async function transcribeAudio(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post('/api/v1/tutor/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function analyzeVisualEngagement(payload: {
  user_id: number
  session_id: string
  frame_data: string
}) {
  const { data } = await apiClient.post('/api/v1/engagement/visual', payload)
  return data
}

export async function analyzeAudioEngagement(payload: JsonObject) {
  const { data } = await apiClient.post('/api/v1/engagement/analyze-audio', payload)
  return data
}

export async function getEngagementSummary(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/engagement/summary/${user_id}`)
  return data
}

export async function getEngagementSession(session_id: string) {
  const { data } = await apiClient.get(`/api/v1/engagement/session/${session_id}`)
  return data
}

export async function getHardwareStatus() {
  const { data } = await apiClient.get('/api/v1/hardware/status')
  return data
}

export async function startCamera(payload?: {
  device_index?: number
  width?: number
  height?: number
  fps?: number
}) {
  const { data } = await apiClient.post('/api/v1/hardware/camera/start', payload || {})
  return data
}

export async function stopCamera() {
  const { data } = await apiClient.post('/api/v1/hardware/camera/stop')
  return data
}

export async function getCameraSnapshot() {
  const { data } = await apiClient.get('/api/v1/hardware/camera/snapshot')
  return data
}

export async function getCameraStatus() {
  const { data } = await apiClient.get('/api/v1/hardware/camera/status')
  return data
}

export async function startMicrophone(payload?: { duration_sec?: number; silence_timeout?: number }) {
  const { data } = await apiClient.post('/api/v1/hardware/microphone/start', payload || {})
  return data
}

export async function stopMicrophone() {
  const { data } = await apiClient.post('/api/v1/hardware/microphone/stop')
  return data
}

export async function getMicrophoneStatus() {
  const { data } = await apiClient.get('/api/v1/hardware/microphone/status')
  return data
}

export function createTutorStreamSocket(
  payload: { token: string; userId: number; query: string; skillId?: number; domain?: string },
  callbacks?: {
    onOpen?: () => void
    onToken?: (token: string) => void
    onDone?: (data: JsonObject) => void
    onError?: (event: Event) => void
  },
) {
  if (typeof window === 'undefined') {
    return null
  }

  const socket = new WebSocket(`${wsBaseUrl()}/api/v1/tutor/ask/stream`)

  socket.addEventListener('open', () => {
    callbacks?.onOpen?.()
    socket.send(JSON.stringify({
      token: payload.token,
      user_id: payload.userId,
      query: payload.query,
      skill_id: payload.skillId,
      domain: payload.domain,
    }))
  })

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      return
    }

    try {
      const parsed = JSON.parse(event.data) as JsonObject
      if (parsed.done) {
        callbacks?.onDone?.(parsed)
      }
      return
    } catch {
      callbacks?.onToken?.(event.data)
    }
  })

  socket.addEventListener('error', (event) => callbacks?.onError?.(event))

  return socket
}

export function createVoiceSocket(
  sessionId: string,
  callbacks?: {
    onOpen?: () => void
    onMessage?: (data: string) => void
    onError?: (event: Event) => void
  },
) {
  if (typeof window === 'undefined') {
    return null
  }

  const socket = new WebSocket(`${wsBaseUrl()}/api/v1/voice/ws/${sessionId}`)

  socket.addEventListener('open', () => callbacks?.onOpen?.())
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      callbacks?.onMessage?.(event.data)
    }
  })
  socket.addEventListener('error', (event) => callbacks?.onError?.(event))

  return socket
}

export async function uploadKnowledgeDocument(file: File, subject?: string) {
  const formData = new FormData()
  formData.append('file', file)
  if (subject) formData.append('subject', subject)
  const { data } = await apiClient.post('/api/v1/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listKnowledgeDocuments() {
  const { data } = await apiClient.get('/api/v1/knowledge/documents')
  return data
}

export async function getKnowledgeStats() {
  const { data } = await apiClient.get('/api/v1/knowledge/stats')
  return data
}

export async function queryKnowledgeBase(payload: { query: string; subject?: string; top_k?: number }) {
  const { data } = await apiClient.post('/api/v1/knowledge/query', payload)
  return data
}

export async function deleteKnowledgeDocument(source_name: string) {
  const { data } = await apiClient.delete(`/api/v1/knowledge/documents/${encodeURIComponent(source_name)}`)
  return data
}

export async function deleteKnowledgeEntry(entry_id: number) {
  const { data } = await apiClient.delete(`/api/v1/knowledge/${entry_id}`)
  return data
}

export async function getStudentInteractions(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/interactions/student/${user_id}`)
  return data
}

export async function listStudentsAnalytics() {
  const { data } = await apiClient.get('/api/v1/analytics/students')
  return data
}

export async function getStudentAnalytics(user_id: number) {
  const { data } = await apiClient.get(`/api/v1/analytics/student/${user_id}`)
  return data
}

export async function getSkillsAnalytics() {
  const { data } = await apiClient.get('/api/v1/analytics/skills')
  return data
}

// ─── Unified Chat Endpoints ───────────────────────────────────────────────────

export async function getSessionStatus(skill_id: number) {
  const { data } = await apiClient.get('/api/v1/chat/session-status', { params: { skill_id } })
  return data as {
    has_active_session: boolean
    session_id: string | null
    assessment_done: boolean
    mastery: number | null
    message_count: number
  }
}

export async function getAssessmentQuestions(skill_id: number) {
  const { data } = await apiClient.get(`/api/v1/chat/assessment/${skill_id}`)
  return data as {
    skill_id: number
    skill_name: string
    questions: Array<{
      question_id: number
      question_text: string
      options: Record<string, string> | null
      correct_answer: string
      difficulty: number | null
    }>
  }
}

export async function completeAssessment(payload: {
  skill_id: number
  answers: Array<{ question_id: number; answer: string; is_correct: boolean; time_taken?: number }>
}) {
  const { data } = await apiClient.post('/api/v1/chat/assessment/complete', payload)
  return data as { skill_id: number; mastery: number; correct: number; total: number; accuracy: number; assessment_done: boolean }
}

export async function startChatSession(
  payload: { skill_id: number; user_id: number; defer_lesson?: boolean },
) {
  const { data } = await apiClient.post('/api/v1/chat/session', payload)
  return data
}

/**
 * Stream a deferred full lesson over Server-Sent Events.
 * Uses fetch (not EventSource) so the Authorization header can be sent.
 * Calls onDelta for each token chunk, onDone when the lesson completes.
 * Returns an abort function to cancel the stream.
 */
export function streamLesson(
  sessionId: string,
  handlers: {
    onDelta?: (text: string) => void
    onDone?: (full: string, llmAvailable: boolean) => void
    onError?: (message: string) => void
  },
): () => void {
  const controller = new AbortController()
  const token = readToken()

  ;(async () => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/chat/session/${sessionId}/lesson/stream`,
        {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        },
      )
      if (!res.ok || !res.body) {
        handlers.onError?.(`Lesson stream failed (HTTP ${res.status})`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line.
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const line = frame.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue
          try {
            const evt = JSON.parse(jsonStr)
            if (evt.error) { handlers.onError?.(evt.error); continue }
            if (evt.delta) handlers.onDelta?.(evt.delta)
            if (evt.done) handlers.onDone?.(evt.content || '', evt.llm_available !== false)
          } catch { /* ignore malformed frame */ }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handlers.onError?.(err?.message || 'Lesson stream error')
      }
    }
  })()

  return () => controller.abort()
}

export async function sendChatMessage(payload: {
  session_id: string
  message_type: 'ANSWER' | 'QUESTION' | 'HINT_REQUEST'
  content: string
  engagement_data?: JsonObject
  response_time_ms?: number
}) {
  const { data } = await apiClient.post('/api/v1/chat/message', payload)
  return data
}

export async function getChatSession(session_id: string) {
  const { data } = await apiClient.get(`/api/v1/chat/session/${session_id}`)
  return data
}

export async function endChatSession(session_id: string) {
  const { data } = await apiClient.post('/api/v1/chat/end-session', { session_id })
  return data
}

// ─── Self-directed learning (student-created skills, no teacher) ───────────────

export async function slStartSession(payload: { topic: string; teaching_provider?: string; dynamic_skill_id?: number }) {
  const { data } = await apiClient.post('/api/v1/selflearn/session', payload)
  return data
}

// Upload course material (PDF/TXT/MD) → build a private, material-backed skill.
export async function slCreatePack(payload: { topic: string; files: File[] }) {
  const form = new FormData()
  form.append('topic', payload.topic)
  payload.files.forEach((f) => form.append('files', f))
  const { data } = await apiClient.post('/api/v1/selflearn/pack', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as {
    skill: { id: number; canonical_name: string; description?: string; is_private: boolean }
    documents: Array<{ filename: string; status: string; method?: string; chunk_count: number; warning?: string }>
    ingested: number; skipped: number; concepts: number; material_backed: boolean; subject: string
  }
}

export async function slSendMessage(payload: { session_id: string; content: string }) {
  const { data } = await apiClient.post('/api/v1/selflearn/message', payload)
  return data
}

export async function slResumeSession(session_id: string) {
  const { data } = await apiClient.get(`/api/v1/selflearn/session/${session_id}`)
  return data
}

export async function slGetMastery(session_id: string) {
  const { data } = await apiClient.get(`/api/v1/selflearn/mastery/${session_id}`)
  return data
}

export async function slGetProgress() {
  const { data } = await apiClient.get('/api/v1/selflearn/progress')
  return data as Array<{
    session_id: string; topic: string; is_private: boolean; phase: string; status: string
    current_level: string; last_active_at?: string; overall_mastery: number
    concepts_total: number; concepts_mastered: number; concepts_skipped: number
    documents: Array<{ filename: string; status: string; chunk_count: number; warning?: string }>
  }>
}

export async function slListSessions() {
  const { data } = await apiClient.get('/api/v1/selflearn/sessions')
  return data
}

export async function slGetProviders() {
  const { data } = await apiClient.get('/api/v1/selflearn/providers')
  return data
}

export type SlAssessmentQuestion = {
  concept_id: number
  concept_name: string
  question_text: string
  options: Record<string, string> | null
  correct_answer: string
  difficulty: number | null
}

// Build the course (concept map) if needed + return a diagnostic quiz. No session yet.
export async function slStartAssessment(payload: { topic: string; teaching_provider?: string; dynamic_skill_id?: number }) {
  const { data } = await apiClient.post('/api/v1/selflearn/assessment', payload)
  return data as {
    skill: { id: number; canonical_name: string; slug: string; description?: string }
    dynamic_skill_id: number
    questions: SlAssessmentQuestion[]
  }
}

// Grade the diagnostic → seed per-concept mastery so known concepts are skipped.
export async function slCompleteAssessment(payload: {
  dynamic_skill_id: number
  answers: Array<{ concept_id: number; is_correct: boolean }>
}) {
  const { data } = await apiClient.post('/api/v1/selflearn/assessment/complete', payload)
  return data as {
    dynamic_skill_id: number
    concepts_assessed: number
    concepts_known: number
    concepts_head_start: number
    concepts_to_learn: number
  }
}

export type SlRoadmapConcept = {
  concept_id: number
  name: string
  description?: string | null
  level: string | null
  difficulty: number | null
  order_index: number
  mastery: number
  mastered: boolean
  skipped: boolean
  is_current: boolean
}

export async function slGetRoadmap(session_id: string) {
  const { data } = await apiClient.get(`/api/v1/selflearn/roadmap/${session_id}`)
  return data as {
    session_id: string
    concepts: SlRoadmapConcept[]
    current_concept_id: number | null
    skipped_count: number
    completed: boolean
  }
}

// Jump ahead to a chosen concept — earlier concepts are set aside as SKIPPED (not
// mastered); they stay revisitable via slRevisitConcept / slPractice*.
export async function slSkipToConcept(payload: { session_id: string; concept_id: number }) {
  const { data } = await apiClient.post('/api/v1/selflearn/skip', payload)
  return data
}

// Return to a skipped concept and learn it normally (re-teach + checks).
export async function slRevisitConcept(payload: { session_id: string; concept_id: number }) {
  const { data } = await apiClient.post('/api/v1/selflearn/revisit', payload)
  return data
}

export type SlPracticeQuestion = {
  question_id: number
  concept_id: number
  concept_name: string
  qtype: string
  stem: string
  options: Record<string, string> | null
}

// Practice a concept without teaching: fetch a question…
export async function slPracticeQuestion(payload: { session_id: string; concept_id: number }) {
  const { data } = await apiClient.post('/api/v1/selflearn/practice/question', payload)
  return data as SlPracticeQuestion
}

// …then submit the answer → graded, mastery updated via BKT.
export async function slPracticeAnswer(payload: { session_id: string; question_id: number; answer: string }) {
  const { data } = await apiClient.post('/api/v1/selflearn/practice/answer', payload)
  return data as {
    is_correct: boolean
    feedback: string
    mastery: number
    mastered: boolean
    completed: boolean
    concept_id: number
  }
}

export default apiClient
