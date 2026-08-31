import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { clearAuthSession, getAuthTokenFromStorage, getStoredUser } from '../lib/session'

export default function Nav() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [open, setOpen] = useState(false)
  const currentPath = router.pathname

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()
    setAuthed(!!token)
    setRole(me?.role || null)
  }, [router.pathname])

  useEffect(() => {
    setOpen(false)
  }, [router.pathname])

  const links = useMemo(() => {
    if (!authed) {
      return [
        { href: '/login', label: 'Sign in' },
        { href: '/register', label: 'Register' },
      ]
    }

    if (role === 'teacher') {
      return [
        { href: '/dashboard/teacher', label: 'Dashboard' },
        { href: '/teacher/students', label: 'Students' },
        { href: '/teacher/heatmap', label: 'Heatmap' },
        { href: '/teacher/explainability', label: 'AI Decisions' },
        { href: '/skills', label: 'Skills' },
        { href: '/skills/graph', label: 'Skill Graph' },
        { href: '/questions', label: 'Questions' },
        { href: '/knowledge', label: 'Knowledge' },
        { href: '/history', label: 'History' },
        { href: '/analytics', label: 'Analytics' },
      ]
    }

    if (role === 'admin') {
      return [
        { href: '/dashboard/admin', label: 'Dashboard' },
        { href: '/dashboard/users', label: 'Users' },
        { href: '/skills', label: 'Skills' },
        { href: '/skills/graph', label: 'Skill Graph' },
        { href: '/questions', label: 'Questions' },
        { href: '/history', label: 'History' },
        //{ href: '/tutor', label: 'Tutor' },
        //{ href: '/engagement', label: 'Engagement' },
        { href: '/hardware', label: 'Hardware' },
        { href: '/voice', label: 'Voice' },
        { href: '/knowledge', label: 'Knowledge' },
        { href: '/analytics', label: 'Analytics' },
      ]
    }

    return [
      { href: '/dashboard/student', label: 'Dashboard' },
      //{ href: '/practice', label: 'Practice' },
      //{ href: '/learn', label: 'Learn' },
      { href: '/learn', label: 'Learn' },
      { href: '/selflearn', label: 'Learn Anything' },
      { href: '/mastery', label: 'Mastery' },
      { href: '/history', label: 'History' },
      //{ href: '/tutor', label: 'Tutor' },
      //{ href: '/engagement', label: 'Engagement' },
    ]
  }, [authed, role])

  function logout() {
    clearAuthSession()
    router.push('/')
  }

  // The student nav has far fewer links than teacher/admin, so it can stay
  // as a full row down to a much narrower window before it needs to
  // collapse into the hamburger menu.
  const compact = links.length <= 6

  return (
    <>
      <button
        type="button"
        className={`nav-toggle${compact ? ' compact' : ''}${open ? ' open' : ''}`}
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-links${compact ? ' compact' : ''}${open ? ' open' : ''}`}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={currentPath === link.href ? 'active' : ''}
          >
            {link.label}
          </Link>
        ))}
        {authed && (
          <button type="button" className="nav-button" onClick={logout}>
            Sign out
          </button>
        )}
      </div>
    </>
  )
}
