import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { clearAuthSession, getAuthTokenFromStorage, getStoredUser } from '../lib/session'

export default function Nav() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()
    setAuthed(!!token)
    setRole(me?.role || null)
  }, [router.pathname])

  const links = useMemo(() => {
    if (!authed) {
      return [
        { href: '/', label: 'Home' },
        { href: '/login', label: 'Sign in' },
        { href: '/register', label: 'Register' },
      ]
    }

    if (role === 'teacher') {
      return [
        { href: '/', label: 'Home' },
        { href: '/dashboard/teacher', label: 'Dashboard' },
        { href: '/questions', label: 'Questions' },
        { href: '/history', label: 'History' },
        { href: '/tutor', label: 'Tutor' },
        { href: '/engagement', label: 'Engagement' },
        { href: '/analytics', label: 'Analytics' },
      ]
    }

    if (role === 'admin') {
      return [
        { href: '/', label: 'Home' },
        { href: '/dashboard/admin', label: 'Dashboard' },
        { href: '/questions', label: 'Questions' },
        { href: '/history', label: 'History' },
        { href: '/tutor', label: 'Tutor' },
        { href: '/engagement', label: 'Engagement' },
        { href: '/hardware', label: 'Hardware' },
        { href: '/voice', label: 'Voice' },
        { href: '/knowledge', label: 'Knowledge' },
        { href: '/analytics', label: 'Analytics' },
      ]
    }

    return [
      { href: '/', label: 'Home' },
      { href: '/dashboard/student', label: 'Dashboard' },
      { href: '/practice', label: 'Practice' },
      { href: '/mastery', label: 'Mastery' },
      { href: '/history', label: 'History' },
      { href: '/tutor', label: 'Tutor' },
      { href: '/engagement', label: 'Engagement' },
    ]
  }, [authed, role])

  function logout() {
    clearAuthSession()
    router.push('/login')
  }

  return (
    <div className="nav-links">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>{link.label}</Link>
      ))}
      {authed && (
        <button type="button" className="nav-button" onClick={logout}>
          Sign out
        </button>
      )}
    </div>
  )
}
