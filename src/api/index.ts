/**
 * API client for module content, quiz, and conversation.
 */

import { getAccessToken } from '../auth'
import type { ModuleData } from '../data/sampleModule'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Response from GET /content-loading/{module_id} */
export type ContentLoadingResponse = {
  id: string
  title: string
  content: string
  created_at?: string
}

function normalizeContent(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\\n/g, '\n')
}

/** Fetch module content by id. GET /content-loading/{module_id} */
export async function fetchModuleContent(moduleId: string): Promise<ModuleData> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/content-loading/${moduleId}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to load module content.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
  const data = (await res.json()) as ContentLoadingResponse
  return {
    module_id: data.id,
    title: data.title ?? '',
    content_md: normalizeContent(data.content ?? ''),
  }
}

/** Mark a module as complete. POST /progress/module/{module_id}/complete */
export async function markModuleComplete(moduleId: string): Promise<void> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to mark a module complete.')
  const res = await fetch(`${API_BASE}/progress/module/${moduleId}/complete`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to mark module complete.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
}

/** Question type from POST /quiz/start response */
export type QuizQuestionType = 'SUBJECTIVE' | 'MCQ' | 'DOUBLE_MCQ'

export type QuizQuestion = {
  id: string
  question_text: string
  type: QuizQuestionType
  options?: string[]
}

export type QuizStartResponse = {
  quiz_session_id: string
  questions: QuizQuestion[]
}

/** Start a quiz. POST /quiz/start */
export async function startQuiz(moduleId: string, userId: number): Promise<QuizStartResponse> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to start a quiz.')
  const res = await fetch(`${API_BASE}/quiz/start`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ module_id: moduleId, user_id: userId }),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to start quiz.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
  return res.json() as Promise<QuizStartResponse>
}

export type QuizSubmitPayload = {
  quiz_session_id: string
  question_id: string
  user_answer: string
  confidence: number
  user_id: number
}

export type QuizSubmitResponse = {
  success?: boolean
  [key: string]: unknown
}

/** Submit a quiz answer. POST /quiz/submit */
export async function submitQuizAnswer(payload: QuizSubmitPayload): Promise<QuizSubmitResponse> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to submit an answer.')
  const res = await fetch(`${API_BASE}/quiz/submit`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to submit answer.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
  return res.json() as Promise<QuizSubmitResponse>
}

export type QuizResultResponse = {
  correctness_percentage: number
  total_attempted: number
  total_questions: number
  aggregated_scores?: {
    conceptual_depth: number
    reasoning_quality: number
    confidence_alignment: number
    composite: number
  }
  strengths?: string[]
  weak_areas?: string[]
  per_question?: Array<{
    question_id: string
    question_type: string
    correctness: number
    feedback?: string
  }>
}

/** Get quiz result. GET /quiz/result/{quiz_session_id} */
export async function getQuizResult(quizSessionId: string, userId: number): Promise<QuizResultResponse> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to view quiz result.')
  const url = `${API_BASE}/quiz/result/${encodeURIComponent(quizSessionId)}?user_id=${userId}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to load quiz result.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
  const result = (await res.json()) as QuizResultResponse
  // console.log('getQuizResult result:', result)
  return result
}

/** Request body for POST /conversation/ */
export type ConversationRequest = {
  user_id: number
  module_context_id: string
  user_question: string
  context_question: string
}

/** Response from POST /conversation/ (AI Learning Assistant) */
export type ConversationResponse = {
  response: string
  follow_up_questions?: string[]
}

/** Send a message to the AI Learning Assistant. POST /conversation/ */
export async function sendConversationMessage(payload: ConversationRequest): Promise<ConversationResponse> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to use the AI assistant.')
  const res = await fetch(`${API_BASE}/conversation/`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to get a response from the assistant.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') {
        const raw = json.detail
        if (res.status === 429 || /RESOURCE_EXHAUSTED|quota|rate[-.]?limit/i.test(raw)) {
          message = 'The AI is busy. Please try again in a moment.'
        } else if (res.status >= 500) {
          message = 'Something went wrong. Please try again.'
        } else {
          message = raw.length > 120 ? 'Something went wrong. Please try again.' : raw
        }
      }
    } catch {
      // use default
    }
    throw new Error(message)
  }
  return res.json() as Promise<ConversationResponse>
}

/** Single course score summary from GET /scores/{user_id}/summary */
export type ScoreSummaryItem = {
  course_id: string
  course_name: string
  total_score: number
  color_grade: string
  question_completion_score: number
  evaluation_score: number
  conversation_score: number
  evaluation_count: number
  conversation_count: number
}

/** Get scores summary for a user. GET /scores/{user_id}/summary */
export async function getScoresSummary(userId: number): Promise<ScoreSummaryItem[]> {
  const token = getAccessToken()
  if (!token) throw new Error('You must be logged in to view scores.')
  const res = await fetch(`${API_BASE}/scores/${userId}/summary`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let message = 'Failed to load scores summary.'
    try {
      const json = JSON.parse(text) as { detail?: string }
      if (typeof json.detail === 'string') message = json.detail
    } catch {
      // use default
    }
    throw new Error(message)
  }
  return res.json() as Promise<ScoreSummaryItem[]>
}
