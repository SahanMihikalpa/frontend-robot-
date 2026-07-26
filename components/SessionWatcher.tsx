import { useEffect, useRef } from 'react'
import { getAuthToken, refreshSession, logoutRequest, clearAuthToken } from '../lib/api'
import { clearAuthSession, isPublicRoute } from '../lib/session'

// Inactivity-based session policy (replaces the old absolute 30-min token cutoff):
//  • while the user is active, roll the token so a long lesson never expires;
//  • after 60 min with no activity at all → log out and clear the token.
const IDLE_LIMIT_MS = 60 * 60 * 1000     // 60 min of no activity → logout
const REFRESH_EVERY_MS = 20 * 60 * 1000  // roll the token this often while not idle-logged-out
const CHECK_EVERY_MS = 30 * 1000         // watchdog tick

/**
 * Global, headless watchdog. Mount once (in _app). Tracks real user activity and
 * either refreshes the token (active) or logs the user out (idle ≥ 60 min).
 */
export default function SessionWatcher() {
  const lastActivity = useRef(Date.now())
  const lastRefresh = useRef(Date.now())
  const loggingOut = useRef(false)

  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    async function logoutIdle() {
      if (loggingOut.current) return
      loggingOut.current = true
      await logoutRequest()
      clearAuthToken()
      clearAuthSession()
      // Full navigation (not client route) so all in-memory state is dropped too.
      window.location.href = '/login?reason=idle'
    }

    const id = window.setInterval(() => {
      const token = getAuthToken()
      if (!token || isPublicRoute(window.location.pathname)) return
      const now = Date.now()
      const idleMs = now - lastActivity.current
      if (idleMs >= IDLE_LIMIT_MS) { void logoutIdle(); return }
      // Sliding refresh: roll the token well before its 90-min life so an active
      // session never hits expiry mid-lesson. (Idle sessions are logged out above.)
      if (now - lastRefresh.current >= REFRESH_EVERY_MS) {
        refreshSession().then(() => { lastRefresh.current = Date.now() }).catch(() => { /* 401 handled elsewhere */ })
      }
    }, CHECK_EVERY_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      window.clearInterval(id)
    }
  }, [])

  return null
}
