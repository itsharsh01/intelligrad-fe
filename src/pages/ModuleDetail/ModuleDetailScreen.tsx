import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { ModuleData } from '../../data/sampleModule'
import { SAMPLE_MODULE } from '../../data/sampleModule'
import type { CourseOutline } from '../../data/courseOutline'
import { getStoredUser } from '../../auth'
import { fetchModuleContent, markModuleComplete, sendConversationMessage } from '@/api'
import ModuleQuiz from '../../components/ModuleQuiz'
import './ModuleDetailScreen.css'

export type { ModuleData }

/* Fallback when no courseOutline in state (e.g. direct URL) */
const FALLBACK_SECTIONS = [
  { section_name: 'Linked Lists', modules: [
    { id: 'singly_linked_list', name: 'Singly Linked List' },
    { id: 'doubly_linked_list', name: 'Doubly Linked List' },
  ]},
] as const

export default function ModuleDetailScreen() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const location = useLocation()
  const state = location.state as { module?: ModuleData; courseOutline?: CourseOutline } | null
  const courseOutline = state?.courseOutline ?? null
  const user = getStoredUser()

  const sections = useMemo(() => courseOutline?.sections ?? FALLBACK_SECTIONS, [courseOutline])
  const courseName = courseOutline?.course ?? 'Course'

  const [content, setContent] = useState<ModuleData | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId) {
      setContent(null)
      setContentError(null)
      return
    }
    let cancelled = false
    setContentLoading(true)
    setContentError(null)
    fetchModuleContent(moduleId)
      .then((data) => {
        if (!cancelled) {
          setContent(data)
          setContentError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setContentError(err instanceof Error ? err.message : 'Failed to load content.')
          setContent(null)
        }
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false)
      })
    return () => { cancelled = true }
  }, [moduleId])

  const displayModule = content ?? (state?.module ?? SAMPLE_MODULE)
  const displayTitle = content?.title ?? (moduleId ? (sections.flatMap((s) => s.modules).find((m) => m.id === moduleId)?.name ?? 'Module') : 'Module')

  const sectionIdToExpand = useMemo(() => {
    if (!moduleId) return null
    const idx = sections.findIndex((s) => s.modules.some((m) => m.id === moduleId))
    return idx >= 0 ? `section-${idx}` : null
  }, [moduleId, sections])

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    const firstSectionWithModule = moduleId
      ? sections.findIndex((s) => s.modules.some((m) => m.id === moduleId))
      : 0
    sections.forEach((_, i) => {
      init[`section-${i}`] = firstSectionWithModule === i || (firstSectionWithModule < 0 && i === 0)
    })
    return init
  })
  const [chatInput, setChatInput] = useState('')
  const [chatDialogOpen, setChatDialogOpen] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [moduleCompleted, setModuleCompleted] = useState(false)
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false)
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'user'; text: string; time: string; followUpQuestions?: string[] }>>([
    { role: 'ai', text: "I'm your AI tutor for this module. Ask me anything about the content.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ])

  const formatTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleSendChat = useCallback(async (questionOverride?: string) => {
    const question = (questionOverride ?? chatInput).trim()
    if (!question || chatLoading || !user?.id) return
    const moduleContextId = displayModule.module_id ?? moduleId ?? ''
    setChatError(null)
    setChatMessages((prev) => [...prev, { role: 'user', text: question, time: formatTime() }])
    if (!questionOverride) setChatInput('')
    setChatLoading(true)
    const payload = {
      user_id: user.id,
      module_context_id: moduleContextId,
      user_question: question,
      context_question: '',
    }
    // console.log('Conversation payload:', payload)
    try {
      const data = await sendConversationMessage(payload)
      // console.log('Conversation response:', data)
      const responseText = (data.response ?? '').trim()
      const looksLikeError = /429|RESOURCE_EXHAUSTED|quota exceeded|"error":\s*\{/i.test(responseText) || responseText.length > 500
      if (looksLikeError) {
        setChatError('The AI is busy or something went wrong. Please try again in a moment.')
        setChatMessages((prev) => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process that. Please try again.', time: formatTime() }])
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: responseText || 'No response.',
            time: formatTime(),
            followUpQuestions: data.follow_up_questions && data.follow_up_questions.length > 0 ? data.follow_up_questions : undefined,
          },
        ])
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to get a response.'
      const friendly = raw.length > 120 || /RESOURCE_EXHAUSTED|quota|rate.limit|429/i.test(raw)
        ? 'The AI is busy or something went wrong. Please try again in a moment.'
        : raw
      setChatError(friendly)
      setChatMessages((prev) => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process that. Please try again.', time: formatTime() }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, user?.id, displayModule.module_id, moduleId])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isSectionExpanded = (sectionIndex: number) => {
    const id = `section-${sectionIndex}`
    if (expandedSections[id] !== undefined) return expandedSections[id]
    return sectionIdToExpand === id
  }

  const copyCode = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const pre = (e.currentTarget as HTMLElement).closest('.module-code-wrap')?.querySelector('pre')
    if (!pre) return
    const code = pre.textContent ?? ''
    navigator.clipboard.writeText(code).then(() => {
      const btn = e.currentTarget
      const orig = btn.textContent
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = orig }, 1500)
    })
  }, [])

  const handleRetry = useCallback(() => {
    if (!moduleId) return
    setContentError(null)
    setContentLoading(true)
    fetchModuleContent(moduleId)
      .then((data) => {
        setContent(data)
      })
      .catch((err) => {
        setContentError(err instanceof Error ? err.message : 'Failed to load content.')
      })
      .finally(() => setContentLoading(false))
  }, [moduleId])

  return (
    <div className="module-detail-screen">
      {/* Top nav */}
      <header className="module-topnav">
        <div className="module-topnav-left">
          <Link to="/dashboard" className="module-topnav-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M8 7h8" />
              <path d="M8 11h8" />
            </svg>
            <span>IntelliGrad</span>
          </Link>
          
        </div>
        <div className="module-topnav-right">
          <div className="module-topnav-progress">
            <span className="module-topnav-progress-text">35% Complete</span>
            <div className="module-topnav-progress-bar">
              <div className="module-topnav-progress-fill" style={{ width: '35%' }} />
            </div>
          </div>
          <button type="button" className="module-topnav-icon" aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a2.2 2.2 0 0 0 3.4 0" />
            </svg>
          </button>
          <div className="module-topnav-avatar" title={user?.email}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
          </div>
        </div>
      </header>

      <div className="module-detail-body">
        {/* Left sidebar – course outline from API response */}
        <aside className="module-sidebar-left">
          <h2 className="module-outline-title">{courseName.toUpperCase()}</h2>
          <ul className="module-outline-list">
            {sections.map((section, sectionIndex) => (
              <li key={`${section.section_name}-${sectionIndex}`} className="module-outline-section">
                <button
                  type="button"
                  className={`module-outline-heading ${isSectionExpanded(sectionIndex) ? 'module-outline-heading--open' : ''}`}
                  onClick={() => toggleSection(`section-${sectionIndex}`)}
                >
                  <svg className="module-outline-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <svg className="module-outline-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                  </svg>
                  <span>{section.section_name}</span>
                </button>
                {isSectionExpanded(sectionIndex) && (
                  <ul className="module-outline-sublist">
                    {section.modules.map((mod) => (
                      <li key={mod.id}>
                        <Link
                          to={`/module/${mod.id}`}
                          state={{ courseOutline: courseOutline ?? undefined }}
                          className={`module-outline-item ${moduleId === mod.id ? 'module-outline-item--active' : ''}`}
                        >
                          {mod.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Center – module content */}
        <main className="module-main">
          <nav className="module-breadcrumb">
            <Link to="/dashboard">IntelliGrad</Link>
            <span className="module-breadcrumb-sep">/</span>
            <span>{courseName.toUpperCase()}</span>
            <span className="module-breadcrumb-sep">/</span>
            <span>{displayTitle.toUpperCase()}</span>
          </nav>
          <h1 className="module-main-title">{displayTitle}</h1>

          {contentLoading && (
            <div className="module-content-loading" aria-busy="true">
              <div className="module-content-spinner" />
              <p>Loading module content…</p>
            </div>
          )}

          {contentError && !contentLoading && (
            <div className="module-content-error" role="alert">
              <p>{contentError}</p>
              <button type="button" className="module-content-retry" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}

          {!contentLoading && !contentError && (
            <>
              <article className="module-content">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="module-md-h2">{children}</h2>,
                    h3: ({ children }) => <h3 className="module-md-h3">{children}</h3>,
                    p: ({ children }) => <p className="module-md-p">{children}</p>,
                    ul: ({ children }) => <ul className="module-md-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="module-md-ol">{children}</ol>,
                    li: ({ children }) => <li className="module-md-li">{children}</li>,
                    pre: ({ children }) => (
                      <div className="module-code-wrap">
                        <div className="module-code-header">
                          <span className="module-code-filename">Example</span>
                          <button type="button" className="module-code-copy" onClick={copyCode}>Copy</button>
                        </div>
                        <pre className="module-md-pre">{children}</pre>
                      </div>
                    ),
                    code: ({ children, ...props }) => <code className="module-md-code" {...props}>{children}</code>,
                    strong: ({ children }) => <strong className="module-md-strong">{children}</strong>,
                    em: ({ children }) => <em className="module-md-em">{children}</em>,
                  }}
                >
                  {displayModule.content_md}
                </ReactMarkdown>
              </article>
              <div className="module-mark-complete-wrap">
                {markCompleteError && (
                  <p className="module-mark-complete-error" role="alert">{markCompleteError}</p>
                )}
                <button
                  type="button"
                  className="module-btn-mark-complete"
                  disabled={markCompleteLoading || moduleCompleted}
                  onClick={async () => {
                    const idToComplete = displayModule.module_id ?? moduleId ?? ''
                    if (!idToComplete) return
                    setMarkCompleteError(null)
                    setMarkCompleteLoading(true)
                    try {
                      await markModuleComplete(idToComplete)
                      setModuleCompleted(true)
                    } catch (err) {
                      setMarkCompleteError(err instanceof Error ? err.message : 'Failed to mark module complete.')
                    } finally {
                      setMarkCompleteLoading(false)
                    }
                  }}
                >
                  {markCompleteLoading ? 'Marking…' : moduleCompleted ? 'Completed' : 'Mark as complete'}
                </button>
              </div>
            </>
          )}
        </main>

        {/* Right sidebar – quiz + chat */}
        <aside className="module-sidebar-right">
          <ModuleQuiz
            moduleId={displayModule.module_id ?? moduleId ?? ''}
            userId={user?.id ?? 0}
            isLocked={!moduleCompleted}
          />

          <section className="module-chat-card">
            <h3 className="module-chat-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
              </svg>
              AI Learning Assistant
              <button
                type="button"
                className="module-chat-expand-btn"
                onClick={() => setChatDialogOpen(true)}
                aria-label="Open chat in full screen"
                title="View chat in full screen"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
              <span className="module-chat-status" title="Online">●</span>
            </h3>
            <div className="module-chat-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`module-chat-msg module-chat-msg--${msg.role}`}>
                  <span className="module-chat-msg-label">{msg.role === 'ai' ? 'AI Tutor' : 'You'}</span>
                  <p>{msg.text}</p>
                  {msg.role === 'ai' && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                    <div className="module-chat-follow-ups">
                      <span className="module-chat-follow-ups-label">Suggested questions:</span>
                      {msg.followUpQuestions.map((q, j) => (
                        <button
                          key={j}
                          type="button"
                          className="module-chat-follow-up-btn"
                          onClick={() => handleSendChat(q)}
                          disabled={chatLoading}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="module-chat-msg-time">{msg.time}</span>
                </div>
              ))}
              {chatLoading && (
                <div className="module-chat-msg module-chat-msg--ai">
                  <span className="module-chat-msg-label">AI Tutor</span>
                  <p className="module-chat-typing"><span className="module-chat-typing-text">Typing</span><span className="module-chat-typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                </div>
              )}
            </div>
            {chatError && <p className="module-chat-error" role="alert">{chatError}</p>}
            <div className="module-chat-input-wrap">
              <input
                type="text"
                placeholder="Ask a doubt..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChat() } }}
                className="module-chat-input"
                disabled={chatLoading}
              />
              <button type="button" className="module-chat-send" aria-label="Send" onClick={() => handleSendChat()} disabled={chatLoading}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13" />
                  <path d="M22 2 15 22 11 13 2 9 22 2z" />
                </svg>
              </button>
            </div>
            <p className="module-chat-disclaimer">AI can make mistakes. Verify important info.</p>
          </section>
        </aside>
      </div>

      {/* Chat full-screen dialog */}
      {chatDialogOpen && (
        <div
          className="module-chat-dialog-overlay"
          onClick={() => setChatDialogOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-chat-dialog-title"
        >
          <div
            className="module-chat-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="module-chat-dialog-header">
              <h2 id="module-chat-dialog-title" className="module-chat-dialog-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                </svg>
                AI Learning Assistant
                <span className="module-chat-status" title="Online">●</span>
              </h2>
              <button
                type="button"
                className="module-chat-dialog-close"
                onClick={() => setChatDialogOpen(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="module-chat-dialog-card">
              <div className="module-chat-dialog-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`module-chat-msg module-chat-msg--${msg.role} module-chat-dialog-msg`}>
                    <span className="module-chat-msg-label">{msg.role === 'ai' ? 'AI Tutor' : 'You'}</span>
                    <p>{msg.text}</p>
                    {msg.role === 'ai' && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                      <div className="module-chat-follow-ups">
                        <span className="module-chat-follow-ups-label">Suggested questions:</span>
                        {msg.followUpQuestions.map((q, j) => (
                          <button
                            key={j}
                            type="button"
                            className="module-chat-follow-up-btn"
                            onClick={() => handleSendChat(q)}
                            disabled={chatLoading}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="module-chat-msg-time">{msg.time}</span>
                  </div>
                ))}
                {chatLoading && (
                  <div className="module-chat-msg module-chat-msg--ai module-chat-dialog-msg">
                    <span className="module-chat-msg-label">AI Tutor</span>
                    <p className="module-chat-typing"><span className="module-chat-typing-text">Typing</span><span className="module-chat-typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
                  </div>
                )}
              </div>
              {chatError && <p className="module-chat-error" role="alert">{chatError}</p>}
              <div className="module-chat-input-wrap module-chat-dialog-input-wrap">
                <input
                  type="text"
                  placeholder="Ask a doubt..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChat() } }}
                  className="module-chat-input"
                  disabled={chatLoading}
                />
                <button type="button" className="module-chat-send" aria-label="Send" onClick={() => handleSendChat()} disabled={chatLoading}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13" />
                    <path d="M22 2 15 22 11 13 2 9 22 2z" />
                  </svg>
                </button>
              </div>
              <p className="module-chat-disclaimer">AI can make mistakes. Verify important info.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
