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
                color: 'var(--accent)',
                fontStyle: 'italic'
              }}
            >
              you
            </span>{' '}
            learn.
          </h1>

          <p className="home-hero-desc">
            Adaptive learning driven by Bayesian Knowledge Tracing with AI tutoring,
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
              <div style={{ color: 'var(--muted)' }}>
                Tutoring
              </div>
            </div>

            <div>
              <div className="editorial-title" style={{ fontSize: 36 }}>
                BKT
              </div>
              <div style={{ color: 'var(--muted)' }}>
                Knowledge Tracking
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

    <div className="stack" style={{ gap: 0 }}>

      {/* Role cards */}
      <section className="home-roles-section">
      <div className="home-roles-inner">
      <div className="home-section-header">
        <p className="home-eyebrow">Choose Your Path</p>
        <h2 className="editorial-title">Built for every seat in the classroom</h2>
      </div>
      <div className="grid-three">
        <div className="card stack home-role-card-outer">
          <div className="home-role-card">
            <div className="home-role-icon home-role-icon-student">S</div>
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Practice adaptive questions, track mastery,
              and receive AI tutoring support.
            </p>
          </div>
        </div>
        <div className="card stack home-role-card-outer">
          <div className="home-role-card">
            <div className="home-role-icon home-role-icon-teacher">T</div>
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Monitor engagement, performance analytics,
              and classroom progress.
            </p>
          </div>
        </div>
        <div className="card stack home-role-card-outer">
          <div className="home-role-card">
            <div className="home-role-icon home-role-icon-admin">A</div>
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Manage hardware, analytics,
              knowledge bases and platform operations.
            </p>
          </div>
        </div>
      </div>
      </div>
      </section>

      {/* Product preview */}
      <section className="home-preview-section">
        <div className="home-preview-copy">
          <p className="home-eyebrow">Under The Hood</p>
          <h2 className="editorial-title home-preview-title">
            See the classroom, at a glance.
          </h2>
          <p className="home-hero-desc" style={{ marginBottom: 0 }}>
            Live mastery tracking, engagement signals, and skill heatmaps —
            built for teachers who want the full picture without digging for it.
          </p>
        </div>

        <div className="home-preview-mockup-wrap">
        <div className="home-preview-mockup" aria-hidden="true">
          <div className="home-preview-mockup-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="home-preview-mockup-body">
            <div className="home-preview-kpis">
              <div className="home-preview-kpi">
                <p>Mastery</p>
                <strong>92%</strong>
              </div>
              <div className="home-preview-kpi">
                <p>Active</p>
                <strong>128</strong>
              </div>
            </div>
            <div className="home-preview-chart">
              <i style={{ height: '38%' }} />
              <i style={{ height: '62%' }} />
              <i style={{ height: '48%' }} />
              <i style={{ height: '80%' }} />
              <i style={{ height: '58%' }} />
              <i style={{ height: '94%' }} />
              <i style={{ height: '70%' }} />
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="home-how-section">
        <div className="home-section-header">
          <p className="home-eyebrow">How It Works</p>
          <h2 className="editorial-title">Three steps to a personalized classroom</h2>
        </div>

        <div className="home-how-grid">
          {/* Step 01 */}

          <div className="home-step">
            <div className="home-step-number">
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Authenticate securely and access your personalized learning experience.
            </p>
          </div>

          {/* Step 02 */}

          <div className="home-step">
            <div className="home-step-number">
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Students, teachers and administrators receive role-specific capabilities.
            </p>
          </div>

          {/* Step 03 */}

          <div className="home-step">
            <div className="home-step-number">
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
                color: 'var(--text-secondary)',
                lineHeight: 1.8
              }}
            >
              Adaptive learning, AI tutoring, engagement sensing and analytics work together in real time.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="home-cta-section">
        <p className="home-eyebrow">Get Started</p>
        <h2 className="editorial-title home-cta-title">
          Start learning the way you learn.
        </h2>
        <p className="home-cta-desc">
          Join as a student, teacher, or admin and put adaptive, AI-driven
          learning to work in your classroom today.
        </p>
        <div className="home-cta-actions">
          {authed ? (
            <Link href={dashboardHref} className="btn">
              Go to my dashboard
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn">
                Create account
              </Link>
              <Link href="/login" className="btn home-btn-outline">
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

    </div>


    </>
  )
}
