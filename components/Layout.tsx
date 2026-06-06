import Nav from './Nav'
import React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getAuthTokenFromStorage, getStoredUser } from '../lib/session'

const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()

    if (!token || !me) {
      setName('')
      setRole('')
      return
    }

    setName(me.full_name || me.username || me.email || 'User')
    setRole(me.role || '')
  }, [router.pathname])

  return (
    <div>
      <header className="site-header">
        <div className="brand">
          <div className="logo" />
          <h1>ATLAS</h1>
        </div>

        <div className="header-right">
          <Nav />

          {name && (
            <div className="profile-badge">
              <span className="profile-name">{name}</span>
              <span className="profile-role">
                {role || 'student'}
              </span>
            </div>
          )}
        </div>
      </header>

      <main 
        className={
          router.pathname === '/login' ||
          router.pathname === '/register'
            ? ''
            : 'container'
        }
      >{children}</main>
    </div>
  )
}

export default Layout