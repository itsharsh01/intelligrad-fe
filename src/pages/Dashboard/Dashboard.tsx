import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FaTrophy, FaComments, FaLock, FaEquals, FaSitemap, FaProjectDiagram, FaShieldAlt } from 'react-icons/fa'
import { FiTrendingUp } from 'react-icons/fi'
import { IoLayers } from 'react-icons/io5'
import { getStoredUser, logout } from '../../auth'
import { getScoresSummary, type ScoreSummaryItem } from '../../api'
import { SAMPLE_MODULE } from '../../data/sampleModule'
import { DATA_STRUCTURES_OUTLINE } from '../../data/courseOutline'
import './Dashboard.css'
import { TbRosetteDiscountCheck } from 'react-icons/tb'
import { RiCompasses2Fill } from 'react-icons/ri'
import { LuBrain } from 'react-icons/lu'

const MILESTONE_MAX = { evaluation: 100, conversation: 50 }
const MASTERY_LEVELS = [
  { id: 'array-ace', label: 'Array Ace', mastered: true, icon: 'arrow' },
  { id: 'stack-specialist', label: 'Stack Specialist', mastered: false, icon: 'equals' },
  { id: 'tree-navigator', label: 'Tree Navigator', mastered: false, icon: 'tree' },
  { id: 'graph-guru', label: 'Graph Guru', mastered: false, icon: 'graph' },
] as const

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'courses', label: 'My Courses', icon: 'courses' },
  { id: 'achievements', label: 'Achievements', icon: 'trophy' },
] as const

const TREND_POINTS = [40, 55, 45, 65, 58, 72] // Jan–Jun approximate values for SVG
const COURSES = [
  { id: 'data-structures', title: 'Data Structures & Algorithms', difficulty: 'INTERMEDIATE', difficultyClass: 'orange', description: 'Linked lists, trees, heaps, sets, queues, and AVL trees.', duration: '18h', image: 'data', courseOutline: DATA_STRUCTURES_OUTLINE },
  { id: '1', title: 'Advanced Python', difficulty: 'INTERMEDIATE', difficultyClass: 'orange', description: 'Master decorators, generators, and async programming.', duration: '12h 45m', image: 'python' },
  { id: '2', title: 'UI/UX Design', difficulty: 'BEGINNER', difficultyClass: 'green', description: 'Learn design principles and Figma from scratch.', duration: '8h 20m', image: 'design' },
  { id: '3', title: 'Data Science Fundamentals', difficulty: 'INTERMEDIATE', difficultyClass: 'orange', description: 'Statistics, Python, and visualization basics.', duration: '15h 10m', image: 'data' },
  { id: '4', title: 'Machine Learning Ops', difficulty: 'EXPERT', difficultyClass: 'red', description: 'Deploy and monitor ML models in production.', duration: '22h 30m', image: 'ml' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getStoredUser()
  const isAchievements = location.pathname === '/achievements'
  const [activeNav, setActiveNav] = useState(isAchievements ? 'achievements' : 'dashboard')
  const [scoresSummary, setScoresSummary] = useState<ScoreSummaryItem[] | null>(null)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [scoresError, setScoresError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
    }
  }, [user?.id, navigate])

  useEffect(() => {
    setActiveNav(isAchievements ? 'achievements' : 'dashboard')
  }, [isAchievements])

  useEffect(() => {
    if (!isAchievements || !user?.id) return
    setScoresError(null)
    setScoresLoading(true)
    getScoresSummary(user.id)
      .then((data) => {
        // console.log('Achievement scores API response:', data)
        setScoresSummary(Array.isArray(data) ? data : [])
      })
      .catch((err) => setScoresError(err instanceof Error ? err.message : 'Failed to load achievements.'))
      .finally(() => setScoresLoading(false))
  }, [isAchievements, user?.id])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleNav = (id: string) => {
    if (id === 'achievements') {
      navigate('/achievements')
      return
    }
    setActiveNav(id)
    if (id === 'dashboard') navigate('/dashboard')
  }

  const openModule = (course?: (typeof COURSES)[0]) => {
    if (course && 'courseOutline' in course && course.courseOutline) {
      const firstModuleId = course.courseOutline.sections[0]?.modules[0]?.id
      if (firstModuleId) {
        navigate(`/module/${firstModuleId}`, {
          state: { courseOutline: course.courseOutline, module: SAMPLE_MODULE },
        })
        return
      }
    }
    navigate(`/module/${SAMPLE_MODULE.module_id}`, { state: { module: SAMPLE_MODULE } })
  }

  if (!user) return null

  const width = 280
  const height = 120
  const padding = { top: 8, right: 8, bottom: 24, left: 8 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const minY = Math.min(...TREND_POINTS)
  const maxY = Math.max(...TREND_POINTS)
  const range = maxY - minY || 1
  const getTrendPoints = (): string =>
    TREND_POINTS.map((v, i) => {
      const x = padding.left + (i / (TREND_POINTS.length - 1)) * chartWidth
      const y = padding.top + chartHeight - ((v - minY) / range) * chartHeight
      return `${x},${y}`
    }).join(' ')
  const trendPointsStr = getTrendPoints()
  void trendPointsStr
  return (
    <div className="student-dashboard">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-profile">
          <div className="dashboard-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <path d="M9 14h6v4H9z" />
            </svg>
          </div>
          <div className="dashboard-profile-info">
            <span className="dashboard-profile-name">{user.name ?? user.email}</span>
            <span className="dashboard-profile-badge">Premium Learner</span>
          </div>
        </div>

        <nav className="dashboard-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dashboard-nav-item ${(activeNav === item.id || (item.id === 'achievements' && isAchievements)) ? 'dashboard-nav-item--active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              {item.icon === 'grid' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              )}
              {item.icon === 'courses' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  <path d="M8 7h8" />
                  <path d="M8 11h8" />
                </svg>
              )}
              {item.icon === 'trophy' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47 1-1.05 1H7.05C6.47 18 6 17.55 6 17v-2.34" />
                  <path d="M14 14.66V17c0 .55.47 1 1.05 1h1.9c.58 0 1.05-.45 1.05-1v-2.34" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <button
            type="button"
            className="dashboard-nav-item dashboard-nav-logout"
            onClick={handleLogout}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-body">
        <header className="dashboard-page-header">
          <h1 className="dashboard-page-title">Student Learning Dashboard</h1>
        </header>

        <main className="dashboard-main">
          {isAchievements ? (
            <div className="dashboard-achievement-gallery">
              <div className="dashboard-achievement-layout">
                <div className="dashboard-achievement-main">
                  <div className="dashboard-achievement-hero">
                    <div className="dashboard-achievement-shield">
                      <FaShieldAlt className="dashboard-achievement-shield-icon" aria-hidden />
                      <span className="dashboard-achievement-shield-num">1</span>
                    </div>
                    <h2 className="dashboard-achievement-title">IntelliGrad Achievement Gallery</h2>
                    <p className="dashboard-achievement-subtitle">
                      {scoresSummary?.length
                        ? 'Data Structures & Algorithms: Level 1 foundations. Master challenges to evolve your ranking in the global mastery path.'
                        : 'Complete courses to see your achievement gallery here.'}
                    </p>
                  </div>
                  {scoresLoading && <p className="dashboard-achievement-loading">Loading…</p>}
                  {scoresError && <p className="dashboard-achievement-error" role="alert">{scoresError}</p>}
                  {!scoresLoading && !scoresError && (
                    <section className="dashboard-achievement-milestones">
                      <div className="dashboard-achievement-milestones-head">
                        <h3 className="dashboard-achievement-milestones-title">
                          <FaTrophy className="dashboard-achievement-milestones-icon" />
                          Knowledge Milestones
                        </h3>
                        <span className="dashboard-achievement-count">
                          {scoresSummary?.length ? [scoresSummary[0].evaluation_score > 0, scoresSummary[0].conversation_count > 0, scoresSummary[0].question_completion_score > 0].filter(Boolean).length : 0}/4 Unlocked
                        </span>
                      </div>
                      <div className="dashboard-achievement-cards">
                        <div className="dashboard-achievement-card">
                          <div className="dashboard-achievement-card-row">
                            <span className="dashboard-achievement-card-icon" aria-hidden>
                              <LuBrain />
                            </span>
                            <span className="dashboard-achievement-card-lock" aria-hidden><FaLock /></span>
                          </div>
                          <h4>Problem Solver</h4>
                          <p>Evaluation Score: {Number(scoresSummary?.[0]?.evaluation_score ?? 0).toFixed(2)}/{MILESTONE_MAX.evaluation}</p>
                          <div className="dashboard-achievement-bar"><div className="dashboard-achievement-bar-fill" style={{ width: `${scoresSummary?.[0] ? (scoresSummary[0].evaluation_score / MILESTONE_MAX.evaluation) * 100 : 0}%` }} /></div>
                        </div>
                        <div className="dashboard-achievement-card">
                          <div className="dashboard-achievement-card-row">
                            <span className="dashboard-achievement-card-icon" aria-hidden><FaComments /></span>
                            <span className="dashboard-achievement-card-lock" aria-hidden><FaLock /></span>
                          </div>
                          <h4>Active Learner</h4>
                          <p>Conversations: {Number(scoresSummary?.[0]?.conversation_count ?? 0).toFixed(2)}/{MILESTONE_MAX.conversation}</p>
                          <div className="dashboard-achievement-bar"><div className="dashboard-achievement-bar-fill" style={{ width: `${scoresSummary?.[0] ? (scoresSummary[0].conversation_count / MILESTONE_MAX.conversation) * 100 : 0}%` }} /></div>
                        </div>
                        <div className="dashboard-achievement-card">
                          <div className="dashboard-achievement-card-row">
                            <span className="dashboard-achievement-card-icon" aria-hidden><TbRosetteDiscountCheck /></span>
                            <span className="dashboard-achievement-card-lock" aria-hidden><FaLock /></span>
                          </div>
                          <h4>Master of Basics</h4>
                          <p>Question Completion: {Number(scoresSummary?.[0]?.question_completion_score ?? 0).toFixed(2)}%</p>
                          <div className="dashboard-achievement-bar"><div className="dashboard-achievement-bar-fill" style={{ width: `${scoresSummary?.[0]?.question_completion_score ?? 0}%` }} /></div>
                        </div>
                        <div className="dashboard-achievement-card dashboard-achievement-card--ultimate">
                          <div className="dashboard-achievement-card-row">
                            <span className="dashboard-achievement-card-icon dashboard-achievement-card-icon--muted" aria-hidden><RiCompasses2Fill /></span>
                            <span className="dashboard-achievement-card-lock" aria-hidden><FaLock /></span>
                          </div>
                          <h4>Data Architect</h4>
                          <p>Ultimate Level 1 Milestone</p>
                          <div className="dashboard-achievement-bar"><div className="dashboard-achievement-bar-fill" style={{ width: `${Math.min(100, scoresSummary?.[0]?.total_score ?? 0)}%` }} /></div>
                        </div>
                      </div>
                    </section>
                  )}
                  
                </div>
                <aside className="dashboard-achievement-sidebar">
                  <h3 className="dashboard-achievement-sidebar-title">
                    <FiTrendingUp className="dashboard-achievement-sidebar-title-icon" />
                    Path to Mastery
                  </h3>
                  <div className="dashboard-achievement-path">
                    {MASTERY_LEVELS.map((level, i) => (
                      <div key={level.id} className={`dashboard-achievement-path-item ${level.mastered ? 'dashboard-achievement-path-item--mastered' : ''} ${i < MASTERY_LEVELS.length - 1 ? 'dashboard-achievement-path-item--next' : ''}`}>
                        <div className="dashboard-achievement-path-dot">
                          {level.icon === 'arrow' && <IoLayers />}
                          {level.icon === 'equals' && <FaEquals />}
                          {level.icon === 'tree' && <FaSitemap />}
                          {level.icon === 'graph' && <FaProjectDiagram />}
                        </div>
                        <div className="dashboard-achievement-path-content">
                          <span className="dashboard-achievement-path-label">{level.label}</span>
                          {level.mastered ? <span className="dashboard-achievement-path-badge">MASTERED</span> : <span className="dashboard-achievement-path-locked">Locked</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="dashboard-achievement-mastery">
                    <span className="dashboard-achievement-mastery-label">MASTERY PROGRESS</span>
                    <span className="dashboard-achievement-mastery-value">{scoresSummary?.[0] ? Number(Math.min(100, scoresSummary[0].total_score)).toFixed(2) : '0.00'}%</span>
                    <div className="dashboard-achievement-mastery-bar">
                      <div className="dashboard-achievement-mastery-fill" style={{ width: `${scoresSummary?.[0] ? Math.min(100, Math.round(scoresSummary[0].total_score)) : 0}%` }} />
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <>
              <div className="dashboard-welcome-row">
                <div className="dashboard-welcome-text">
                  <h2>Welcome back, {(user.name ?? user.email).split(' ')[0]}! 👋</h2>
                  <p>You&apos;ve mastered <strong>3 new skills</strong> this week. Keep up the momentum!</p>
                </div>
              </div>
              <section className="dashboard-courses">
                <div className="dashboard-courses-grid">
                  {COURSES.map((course) => {
                    const isDataStructures = course.id === 'data-structures'
                    return (
                      <div
                        key={course.id}
                        className={`dashboard-course-card ${!isDataStructures ? 'dashboard-course-card--disabled' : ''}`}
                        role="button"
                        tabIndex={isDataStructures ? 0 : -1}
                        onClick={() => isDataStructures && openModule(course)}
                        onKeyDown={(e) => { if (isDataStructures && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openModule(course) } }}
                      >
                        <span className={`dashboard-course-difficulty dashboard-course-difficulty--${course.difficultyClass}`}>
                          {course.difficulty}
                        </span>
                        <div className={`dashboard-course-image dashboard-course-image--${course.image}`} />
                        <h4>{course.title}</h4>
                        <p>{course.description}</p>
                        <div className="dashboard-course-meta">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          <span>{course.duration}</span>
                        </div>
                        <button
                          type="button"
                          className={`dashboard-btn-start ${!isDataStructures ? 'dashboard-btn-start--disabled' : ''}`}
                          disabled={!isDataStructures}
                          onClick={(e) => { e.stopPropagation(); if (isDataStructures) openModule(course) }}
                        >
                          Start
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </main>

        <div className="dashboard-float-help">
          <span>Need help?</span>
          <button type="button" className="dashboard-float-btn" aria-label="AI help">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5a3 3 0 1 0-5.998.235 4 4 0 0 1 2.103 3.415A3 3 0 0 0 9 14a3 3 0 0 0 3-3" />
              <path d="M12 19v-4" />
              <path d="M12 15h.01" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
