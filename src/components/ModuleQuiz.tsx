import { useState, useEffect } from 'react'
import { startQuiz, submitQuizAnswer, getQuizResult, type QuizQuestion, type QuizResultResponse } from '@/api'

export type ModuleQuizProps = {
  moduleId: string
  userId: number
  isLocked: boolean
}

const CONFIDENCE_MIN = 0
const CONFIDENCE_MAX = 10
const CONFIDENCE_DEFAULT = 10

function correctnessLabel(correctness: number): string {
  return correctness === 1 || correctness > 0 ? 'Right' : 'Wrong'
}

export default function ModuleQuiz({ moduleId, userId, isLocked }: ModuleQuizProps) {
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [confidence, setConfidence] = useState(CONFIDENCE_DEFAULT)
  const [startLoading, setStartLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<QuizResultResponse | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex >= questions.length - 1
  const isComplete = quizStarted && questions.length > 0 && currentIndex >= questions.length

  const isMcq = currentQuestion?.type === 'MCQ'
  const isDoubleMcq = currentQuestion?.type === 'DOUBLE_MCQ'
  const isSubjective = currentQuestion?.type === 'SUBJECTIVE'

  const hasAnswer =
    isSubjective
      ? selectedAnswer.trim().length > 0
      : (isMcq && !!selectedAnswer) || (isDoubleMcq && selectedOptions.length > 0)
  const canProceed = hasAnswer

  const handleStart = async () => {
    setStartError(null)
    setStartLoading(true)
    try {
      const res = await startQuiz(moduleId, userId)
      setQuizSessionId(res.quiz_session_id)
      setQuestions(res.questions ?? [])
      // console.log('quiz questions', res.questions)
      setQuizStarted(true)
      setCurrentIndex(0)
      setSelectedAnswer('')
      setSelectedOptions([])
      setConfidence(CONFIDENCE_DEFAULT)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start quiz.')
    } finally {
      setStartLoading(false)
    }
  }

  const getUserAnswer = (): string => {
    if (isSubjective) return selectedAnswer
    if (isMcq) return selectedAnswer
    if (isDoubleMcq) return selectedOptions.join('|')
    return ''
  }

  const handleNext = async () => {
    if (!quizSessionId || !currentQuestion) return
    const userAnswer = getUserAnswer()
    const payload = {
      quiz_session_id: quizSessionId,
      question_id: currentQuestion.id,
      user_answer: userAnswer,
      confidence: Math.round(confidence),
      user_id: userId,
    }
    // console.log('Quiz submit payload:', payload)
    setSubmitError(null)
    setSubmitLoading(true)
    try {
      await submitQuizAnswer(payload)
      setSelectedAnswer('')
      setSelectedOptions([])
      setConfidence(CONFIDENCE_DEFAULT)
      setCurrentIndex((i) => i + 1)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit answer.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const toggleOption = (opt: string) => {
    setSelectedOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    )
  }

  useEffect(() => {
    if (!isComplete || !quizSessionId || userId === 0 || result != null || resultLoading || resultError != null) return
    setResultError(null)
    setResultLoading(true)
    getQuizResult(quizSessionId, userId)
      .then((data) => {
        setResult(data)
        // console.log('quiz result', data)
      })
      .catch((err) => setResultError(err instanceof Error ? err.message : 'Failed to load result.'))
      .finally(() => setResultLoading(false))
  }, [isComplete, quizSessionId, userId, result, resultLoading])

  return (
    <div className={`module-quiz-wrap ${isLocked ? 'module-quiz-wrap--locked' : ''}`}>
      {isLocked && (
        <div className="module-quiz-locked-overlay" aria-hidden>
          <p className="module-quiz-locked-message">Complete the module before attempting the quiz.</p>
        </div>
      )}
      <section className="module-quiz-card" data-quiz-session-id={quizSessionId ?? undefined}>
        <h3 className="module-quiz-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          AI Quick Quiz
        </h3>

        {!isLocked && !quizStarted && (
          <>
            <p className="module-quiz-intro">Start the quiz to test your understanding of this module.</p>
            {startError && (
              <p className="module-quiz-error" role="alert">{startError}</p>
            )}
            <button
              type="button"
              className="module-quiz-submit"
              onClick={handleStart}
              disabled={startLoading}
            >
              {startLoading ? 'Starting…' : 'Start quiz'}
            </button>
          </>
        )}

        {!isLocked && quizStarted && questions.length === 0 && !startLoading && (
          <p className="module-quiz-no-questions">No questions available for this module.</p>
        )}

        {!isLocked && quizStarted && currentQuestion && !isComplete && (
          <>
            <p className="module-quiz-question">{currentQuestion.question_text}</p>
            <div className="module-quiz-meta">
              Question {currentIndex + 1} of {questions.length}
              {isDoubleMcq && <span className="module-quiz-type-hint"> (Select all that apply)</span>}
            </div>

            {isSubjective && (
              <div className="module-quiz-subjective-wrap">
                <textarea
                  className="module-quiz-textarea"
                  placeholder="Type your answer here..."
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {isMcq && currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="module-quiz-options">
                {currentQuestion.options.map((opt, i) => (
                  <label key={i} className="module-quiz-option">
                    <input
                      type="radio"
                      name="quiz-option"
                      checked={selectedAnswer === opt}
                      onChange={() => setSelectedAnswer(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {isDoubleMcq && currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="module-quiz-options">
                {currentQuestion.options.map((opt, i) => (
                  <label key={i} className="module-quiz-option">
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(opt)}
                      onChange={() => toggleOption(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="module-quiz-confidence-wrap">
              <label className="module-quiz-confidence-label">
                Confidence in your answer: <strong>{confidence}</strong> / {CONFIDENCE_MAX}
              </label>
              <input
                type="range"
                className="module-quiz-confidence-slider"
                min={CONFIDENCE_MIN}
                max={CONFIDENCE_MAX}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                aria-label="Confidence 0 to 10"
              />
            </div>

            {submitError && (
              <p className="module-quiz-error" role="alert">{submitError}</p>
            )}

            <button
              type="button"
              className="module-quiz-submit"
              onClick={handleNext}
              disabled={!canProceed || submitLoading}
            >
              {submitLoading ? 'Submitting…' : isLastQuestion ? 'Submit' : 'Next'}
            </button>
          </>
        )}

        {!isLocked && isComplete && (
          <div className="module-quiz-result">
            {resultLoading && (
              <p className="module-quiz-result-loading">Loading your results…</p>
            )}
            {resultError && (
              <p className="module-quiz-error" role="alert">{resultError}</p>
            )}
            {result && !resultLoading && (
              <>
                <h4 className="module-quiz-result-title">Quiz Result</h4>
                <div className="module-quiz-result-summary">
                  <div className="module-quiz-result-stat">
                    <span className="module-quiz-result-stat-value">{result.correctness_percentage}%</span>
                    <span className="module-quiz-result-stat-label">Correctness</span>
                  </div>
                  <div className="module-quiz-result-stat">
                    <span className="module-quiz-result-stat-value">{result.total_attempted} / {result.total_questions}</span>
                    <span className="module-quiz-result-stat-label">Questions attempted</span>
                  </div>
                </div>
                {result.aggregated_scores && (
                  <div className="module-quiz-result-scores">
                    <span className="module-quiz-result-scores-label">Scores</span>
                    <div className="module-quiz-result-scores-grid">
                      <span>Conceptual depth: {result.aggregated_scores.conceptual_depth}</span>
                      <span>Reasoning: {result.aggregated_scores.reasoning_quality}</span>
                      <span>Confidence alignment: {result.aggregated_scores.confidence_alignment}</span>
                      <span>Composite: {result.aggregated_scores.composite}</span>
                    </div>
                  </div>
                )}
                {result.strengths && result.strengths.length > 0 && (
                  <div className="module-quiz-result-list">
                    <span className="module-quiz-result-list-label">Strengths</span>
                    <ul>
                      {result.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.weak_areas && result.weak_areas.length > 0 && (
                  <div className="module-quiz-result-list">
                    <span className="module-quiz-result-list-label">Areas to improve</span>
                    <ul>
                      {result.weak_areas.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.per_question && result.per_question.length > 0 && (
                  <div className="module-quiz-result-questions">
                    <span className="module-quiz-result-list-label">Per question</span>
                    {result.per_question.map((q, i) => (
                      <div key={q.question_id} className="module-quiz-result-q">
                        <span className="module-quiz-result-q-meta">
                          Q{i + 1} · {q.question_type} ·{' '}
                          <span className={q.correctness ? 'module-quiz-result-right' : 'module-quiz-result-wrong'}>
                            {correctnessLabel(q.correctness)}
                          </span>
                        </span>
                        {q.feedback && <p className="module-quiz-result-q-feedback">{q.feedback}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
