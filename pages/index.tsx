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

      <section
        style={{
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          minHeight: 'calc(100vh - 90px)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#F4F0EA'
        }}
      >
        {/* LEFT PANEL */}

        <div
          style={{
            padding: '90px 80px',
            borderRight: '1px solid rgba(114,106,97,0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <p
            style={{
              letterSpacing: '.35em',
              textTransform: 'uppercase',
              fontSize: 12,
              color: '#726A61'
            }}
          >
            Personalized Learning
          </p>

          <h1
            className="editorial-title"
            style={{
              fontSize: '5rem',
              lineHeight: '1',
              marginTop: 30,
              marginBottom: 30,
              fontWeight: 500,
              color: '#171411'
            }}
          >
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

          <p
            style={{
              maxWidth: 550,
              color: '#726A61',
              lineHeight: 1.8,
              fontSize: 18,
              marginBottom: 40
            }}
          >
            Adaptive learning driven by BKT & DKT, with AI tutoring,
            visual engagement sensing, and real-time analytics.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap'
            }}
          >
            {authed ? (
              <Link href={dashboardHref} className="btn">
                Go to my dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn">
                  Sign in
                </Link>

                <Link href="/register" className="btn secondary">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            background:
            'radial-gradient(circle, rgba(200,91,67,.18) 0%, rgba(200,91,67,.08) 45%, transparent 75%)'
          }}
        >
          <Image
            src="/Hero.svg"
            alt="Atlas Robot"
            width={360}
            height={360}
          />
        </div>
      </section>
    
    <div className="stack" style={{ gap: 32 }}>

      {/* Role cards */}
      <div className="grid-three">
        <div className="card stack">
          <div
            style={{
              border: '1px solid rgba(114,106,97,.18)',
              borderRadius: 30,
              padding: 40,
              background: '#F4F0EA'
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                color: '#726A61'
              }}
            >
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
          <div
            style={{
              border: '1px solid rgba(114,106,97,.18)',
              borderRadius: 30,
              padding: 40,
              background: '#F4F0EA'
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                color: '#726A61'
              }}
            >
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
          <div
            style={{
              border: '1px solid rgba(114,106,97,.18)',
              borderRadius: 30,
              padding: 40,
              background: '#F4F0EA'
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.25em',
                textTransform: 'uppercase',
                color: '#726A61'
              }}
            >
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
      <section
        style={{
          padding: '40px 80px 120px',
          background: '#F4F0EA'
        }}
      >
        <p
          style={{
            letterSpacing: '.35em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: '#726A61',
            textAlign: 'center'
          }}
        >
          How It Works
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 50,
            marginTop: 60
          }}
        >
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
