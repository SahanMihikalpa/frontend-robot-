import '../styles/globals.css'
// Typesetting for the formulas in tutor messages (see components/TutorMarkdown).
import 'katex/dist/katex.min.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { SWRConfig } from 'swr'
import axios from 'axios'
import Layout from '../components/Layout'
import SessionWatcher from '../components/SessionWatcher'
import { ToastProvider } from '../components/ToastProvider'
import { getCurrentUser } from '../lib/api'
import {
  canAccessPath,
  clearAuthSession,
  getAuthTokenFromStorage,
  getRoleHome,
  getStoredUser,
  isPublicRoute,
  setStoredUser,
} from '../lib/session'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const pathname = router.pathname

      if (isPublicRoute(pathname)) {
        // Redirect already-authenticated users away from login/register.
        // Other public pages (/, /about, /contact) stay accessible to everyone.
        const token = getAuthTokenFromStorage()
        if (token && (pathname === '/login' || pathname === '/register')) {
          let me = getStoredUser()
          if (!me?.role) {
            try {
              me = await getCurrentUser()
              setStoredUser(me || {})
            } catch {
              clearAuthSession()
              setReady(true)
              return
            }
          }
          if (me?.role) {
            router.replace(getRoleHome(me.role))
            return
          }
        }
        setReady(true)
        return
      }

      const token = getAuthTokenFromStorage()
      if (!token) {
        setReady(false)
        router.replace('/login')
        return
      }

      let me = getStoredUser()
      if (!me?.role) {
        try {
          me = await getCurrentUser()
          setStoredUser(me || {})
        } catch {
          clearAuthSession()
          setReady(false)
          router.replace('/login')
          return
        }
      }

      const role = me?.role || null

      if (pathname === '/dashboard') {
        setReady(false)
        router.replace(getRoleHome(role))
        return
      }

      if (!canAccessPath(pathname, role)) {
        setReady(false)
        router.replace(getRoleHome(role))
        return
      }

      setReady(true)
    }

    checkAccess()
  }, [router.pathname])

  if (!ready && !isPublicRoute(router.pathname)) {
    return null
  }

  return (
    <SWRConfig value={{ fetcher: (url: string) => axios.get(url).then(r => r.data) }}>
      <ToastProvider>
        <SessionWatcher />
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </ToastProvider>
    </SWRConfig>
  )
}
