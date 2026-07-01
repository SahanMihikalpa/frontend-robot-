import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getAuthTokenFromStorage, getStoredUser, getRoleHome } from '../lib/session'
import Image from 'next/image'

export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [dashboardHref, setDashboardHref] = useState('/login')

  useEffect(() => {
    const token = getAuthTokenFromStorage()
    const me = getStoredUser()
    if (token && me?.role) {
      setAuthed(true)
      setDashboardHref(getRoleHome(me.role))
    }
  }, [])

  return (
    <>
    {/* Hero */}

      <section className="home-hero">
        <div className="home-hero-left-wrap">
          {/* LEFT PANEL */}

        <div className="home-hero-left">
          <p className="home-eyebrow">
            Personalized Learning
          </p>

          <h1 className="editorial-title home-hero-title">
            A tutor that
            <br />
            learns the
            <br />
            way{' '}
            <span
              style={{
                color: '#C85B43',
                fontStyle: 'italic'
              }}
            >
              you
            </span>{' '}
            learn.
          </h1>

          <p className="home-hero-desc">
            Adaptive learning driven by BKT & DKT, with AI tutoring,
            visual engagement sensing, and real-time analytics.
          </p>

          <div className="home-hero-actions">

            {authed ? (
              <Link href={dashboardHref} className="btn">
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn">
                  Sign in
                </Link>

                <Link href="/register" className="btn home-btn-outline">
                  Create account
                </Link>
              </>
            )}
          </div>
          <div className="home-hero-stats">
            <div>
              <div className="editorial-title" style={{ fontSize: 36 }}>
                AI
              </div>
              <div style={{ color: '#726A61' }}>
                Tutoring
              </div>
            </div>

            <div>
              <div className="editorial-title" style={{ fontSize: 36 }}>
                BKT
              </div>
              <div style={{ color: '#726A61' }}>
                Knowledge Tracking
              </div>
            </div>

            <div>
              <div className="editorial-title" style={{ fontSize: 36 }}>
                DKT
              </div>
              <div style={{ color: '#726A61' }}>
                Deep Learning Models
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* RIGHT PANEL */}

        <div className="home-hero-right">
          <div className="home-hero-mesh" />
          <Image
            src="/Hero.svg"
            alt="Atlas Robot"
            width={400}
            height={400}
            className="home-hero-image"
          />
        </div>
      </section>

    <div className="stack" style={{ gap: 32 }}>

      {/* Role cards */}
      <div className="grid-three">
        <div className="card stack">
          <div className="home-role-card">
            <div className="home-role-eyebrow">
              I AM A
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                fontSize: '2rem'
              }}
            >
              Student
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Practice adaptive questions, track mastery,
              and receive AI tutoring support.
            </p>
          </div>
        </div>
        <div className="card stack">
          <div className="home-role-card">
            <div className="home-role-eyebrow">
              I AM A
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                fontSize: '2rem'
              }}
            >
              Teacher
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Monitor engagement, performance analytics,
              and classroom progress.
            </p>
          </div>
        </div>
        <div className="card stack">
          <div className="home-role-card">
            <div className="home-role-eyebrow">
              I AM AN
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                fontSize: '2rem'
              }}
            >
              Admin
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Manage hardware, analytics,
              knowledge bases and platform operations.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section className="home-how-section">
        <p className="home-eyebrow" style={{ textAlign: 'center' }}>
          How It Works
        </p>

        <div className="home-how-grid">
          {/* Step 01 */}

          <div>
            <div
              style={{
                fontSize: 64,
                color: '#C85B43',
                fontFamily: 'serif'
              }}
            >
              01
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                marginBottom: 16,
                fontSize: '2rem'
              }}
            >
              Sign In
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Authenticate securely and access your personalized learning experience.
            </p>
          </div>

          {/* Step 02 */}

          <div>
            <div
              style={{
                fontSize: 64,
                color: '#C85B43',
                fontFamily: 'serif'
              }}
            >
              02
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                marginBottom: 16,
                fontSize: '2rem'
              }}
            >
              Choose Role
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Students, teachers and administrators receive role-specific capabilities.
            </p>
          </div>

          {/* Step 03 */}

          <div>
            <div
              style={{
                fontSize: 64,
                color: '#C85B43',
                fontFamily: 'serif'
              }}
            >
              03
            </div>

            <h3
              className="editorial-title"
              style={{
                marginTop: 12,
                marginBottom: 16,
                fontSize: '2rem'
              }}
            >
              Learn & Analyse
            </h3>

            <p
              style={{
                color: '#726A61',
                lineHeight: 1.8
              }}
            >
              Adaptive learning, AI tutoring, engagement sensing and analytics work together in real time.
            </p>
          </div>
        </div>
      </section>
    </div>
    </>
  )
}
