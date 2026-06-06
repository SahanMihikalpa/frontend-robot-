import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import {
  clearAuthSession,
  getAuthTokenFromStorage,
  getStoredUser,
} from '../lib/session'

export default function Nav() {
  const router = useRouter()

  const [role, setRole] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  const currentPath = router.pathname

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()

    setAuthed(!!token)
    setRole(me?.role || null)
  }, [router.pathname])

  const links = useMemo(() => {
    if (!authed) {
      return [
        { href: '/login', label: 'Sign In' },
        { href: '/register', label: 'Register' },
      ]
    }

    if (role === 'student') {
      return [
        { href: '/dashboard/student', label: 'Dashboard' },
        { href: '/learn', label: 'Practice' },
        { href: '/mastery', label: 'Mastery' },
        { href: '/history', label: 'History' },
      ]
    }

    if (role === 'teacher') {
      return [
        { href: '/dashboard/teacher', label: 'Dashboard' },
        { href: '/teacher/students', label: 'Students' },
        { href: '/teacher/heatmap', label: 'Research' },
        { href: '/analytics', label: 'Analytics' },
      ]
    }

    return [
      { href: '/dashboard/admin', label: 'Dashboard' },
      { href: '/hardware', label: 'Hardware' },
      { href: '/voice', label: 'Voice' },
      { href: '/knowledge', label: 'Knowledge' },
    ]
  }, [authed, role])

  const logout = () => {
    clearAuthSession()
    router.push('/')
  }

  return (
    <nav className="nav-links">
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
        <button
          type="button"
          className="nav-button"
          onClick={logout}
        >
          Sign out
        </button>
      )}
    </nav>
  )
}