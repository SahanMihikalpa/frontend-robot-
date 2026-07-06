import Link from 'next/link'

const FEATURES = [
  {
    title: 'Adaptive Learning',
    desc: 'Personalized learning paths that evolve with every student interaction.',
  },
  {
    title: 'AI Tutor',
    desc: 'An intelligent assistant that explains concepts and guides students through difficult topics.',
  },
  {
    title: 'Bayesian Knowledge Tracing',
    desc: 'Continuously estimates learner mastery using probabilistic models.',
  },
  {
    title: 'Dynamic Knowledge Tracing',
    desc: 'Deep learning models that capture long-term learning behavior for more accurate personalization.',
  },
  {
    title: 'Learning Analytics',
    desc: 'Real-time dashboards providing meaningful insights for teachers and administrators.',
  },
  {
    title: 'Engagement Monitoring',
    desc: 'Analyze learner interaction patterns to identify students needing additional support.',
  },
  {
    title: 'Role-Based Experience',
    desc: 'Dedicated interfaces tailored for students, teachers, and administrators.',
  },
  {
    title: 'Knowledge Management',
    desc: 'Organize skills, concepts, and question banks within a centralized learning ecosystem.',
  },
]

const ROLES = [
  {
    name: 'Students',
    desc: 'Adaptive practice, AI tutoring, personalized question recommendations, mastery tracking, and full learning history.',
  },
  {
    name: 'Teachers',
    desc: 'Classroom analytics, student monitoring, mastery heatmaps, engagement insights, and question & knowledge management.',
  },
  {
    name: 'Administrators',
    desc: 'Platform operations, user management, analytics, and educational resource management.',
  },
]

export default function About() {
  return (
    <>
      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-mesh" />
        <p className="home-eyebrow">About Atlas</p>
        <h1 className="editorial-title about-hero-title">
          Transforming education through adaptive, AI-powered learning.
        </h1>
        <p className="home-hero-desc about-hero-desc">
          Atlas is a Final Year Project built to make classrooms more personalized,
          data-driven, and engaging — pairing probabilistic and deep learning models
          with real-time analytics for students, teachers, and administrators.
        </p>
      </section>

      {/* Product overview */}
      <section className="about-overview">
        <div className="about-overview-inner">
          <div className="about-overview-copy">
            <p className="home-eyebrow">What Is Atlas</p>
            <h2 className="editorial-title">One platform, three tailored experiences.</h2>
            <p className="home-hero-desc" style={{ marginBottom: 0 }}>
              Atlas combines Bayesian Knowledge Tracing (BKT) and Dynamic Knowledge
              Tracing (DKT) with AI tutoring and engagement detection to model exactly
              how each student learns — then puts that insight to work differently
              for every role on the platform.
            </p>
          </div>

          <div className="about-role-list">
            {ROLES.map(role => (
              <div className="about-role-item" key={role.name}>
                <span className="about-role-marker" />
                <div>
                  <h3>{role.name}</h3>
                  <p>{role.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="about-features">
        <div className="home-section-header">
          <p className="home-eyebrow">Capabilities</p>
          <h2 className="editorial-title">Everything adaptive learning needs, in one system.</h2>
        </div>

        <div className="about-feature-grid">
          {FEATURES.map(feature => (
            <div className="about-feature-cell" key={feature.title}>
              <span className="about-feature-icon" />
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vision */}
      <section className="about-vision">
        <p className="home-eyebrow">Our Vision</p>
        <h2 className="editorial-title about-vision-title">
          Building the future of intelligent education.
        </h2>
        <p className="home-hero-desc about-vision-desc">
          Atlas brings together educational research, artificial intelligence, and
          modern software engineering to give every classroom the kind of personalized
          attention that used to only be possible one student at a time.
        </p>
      </section>

      {/* Closing CTA */}
      <section className="home-cta-section">
        <p className="home-eyebrow">Get Started</p>
        <h2 className="editorial-title home-cta-title">
          Ready to experience adaptive learning?
        </h2>
        <p className="home-cta-desc">
          Create an account or explore the platform to see how Atlas adapts to every learner.
        </p>
        <div className="home-cta-actions">
          <Link href="/register" className="btn">
            Create account
          </Link>
          <Link href="/" className="btn home-btn-outline">
            Learn more
          </Link>
        </div>
      </section>
    </>
  )
}
