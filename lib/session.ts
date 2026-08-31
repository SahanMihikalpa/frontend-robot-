export type UserRole = 'student' | 'teacher' | 'admin'

export type SessionUser = {
  id?: number
  username?: string
  email?: string
  full_name?: string
  role?: UserRole
}

const AUTH_TOKEN_KEY = 'token'
const AUTH_USER_KEY = 'auth_user'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getAuthTokenFromStorage() {
  if (!isBrowser()) {
    return null
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function getStoredUser(): SessionUser | null {
  if (!isBrowser()) {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function setStoredUser(user: SessionUser) {
  if (!isBrowser()) {
    return
  }
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.localStorage.removeItem(AUTH_USER_KEY)
  // Reset the cross-page study-break timer so a new sign-in starts fresh.
  window.localStorage.removeItem('study_break_elapsed_s')
}

export function getRoleHome(role?: string | null) {
  if (role === 'teacher') {
    return '/dashboard/teacher'
  }
  if (role === 'admin') {
    return '/dashboard/admin'
  }
  return '/dashboard/student'
}

export function isPublicRoute(pathname: string) {
  return pathname === '/' || pathname === '/login' || pathname === '/register'
    || pathname === '/about' || pathname === '/contact'
}

export function canAccessPath(pathname: string, role?: string | null) {
  if (!role) {
    return false
  }

  if (pathname === '/dashboard') {
    return true
  }

  if (role === 'student') {
    return ![
      '/dashboard/teacher',
      '/dashboard/admin',
      '/dashboard/users',
      '/analytics',
      '/knowledge',
      '/hardware',
      '/voice',
      '/questions',
      '/skills/graph',
      '/teacher/explainability',
    ].includes(pathname)
  }

  if (role === 'teacher') {
    return !['/dashboard/student', '/dashboard/admin', '/dashboard/users', '/hardware', '/voice'].includes(pathname)
  }

  return true
}
