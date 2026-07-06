import { useState } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INFO_CARDS = [
  {
    label: 'E',
    title: 'Email',
    lines: ['General support and inquiries.', 'support@atlas.edu'],
  },
  {
    label: 'P',
    title: 'Project',
    lines: ['A Final Year Project focused on', 'AI-powered adaptive learning.'],
  },
  {
    label: 'U',
    title: 'University',
    lines: ['University of Ruhuna', 'Faculty of Engineering — Dept. of Computer Engineering'],
  },
  {
    label: 'R',
    title: 'Response Time',
    lines: ['We typically respond', 'within 24–48 hours.'],
  },
]

type FormState = {
  name: string
  email: string
  subject: string
  message: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function updateField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function validate(values: FormState): FormErrors {
    const next: FormErrors = {}
    if (!values.name.trim()) next.name = 'Please enter your name.'
    if (!values.email.trim()) next.email = 'Please enter your email.'
    else if (!EMAIL_RE.test(values.email.trim())) next.email = 'Please enter a valid email address.'
    if (!values.subject.trim()) next.subject = 'Please enter a subject.'
    if (!values.message.trim()) next.message = 'Please enter a message.'
    return next
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false)
      return
    }
    setSubmitted(true)
    setForm({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <>
      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-mesh" />
        <p className="home-eyebrow">Contact</p>
        <h1 className="editorial-title about-hero-title">Let's start a conversation.</h1>
        <p className="home-hero-desc about-hero-desc">
          Questions, feedback, technical support, or collaboration ideas about Atlas —
          reach out and our team will get back to you.
        </p>
      </section>

      {/* Main contact section */}
      <section className="contact-main">
        <div className="contact-main-inner">
          {/* Info cards */}
          <div className="contact-info-grid">
            {INFO_CARDS.map(card => (
              <div className="contact-info-card" key={card.title}>
                <span className="contact-info-icon">{card.label}</span>
                <h3>{card.title}</h3>
                {card.lines.map(line => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="contact-form-card">
            <p className="home-eyebrow">Send A Message</p>
            <h2 className="editorial-title contact-form-title">Tell us what's on your mind.</h2>

            {submitted && (
              <p className="feedback success" style={{ marginTop: 20 }}>
                Thanks for reaching out — we'll get back to you within 24–48 hours.
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ marginTop: 28 }}>
              <div className="form-row">
                <label className="form-label" htmlFor="contact-name">
                  Full Name
                </label>
                <input
                  id="contact-name"
                  className="editorial-input"
                  type="text"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                />
                {errors.name && (
                  <p className="form-error" id="contact-name-error">{errors.name}</p>
                )}
              </div>

              <div className="form-row" style={{ marginTop: 20 }}>
                <label className="form-label" htmlFor="contact-email">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  className="editorial-input"
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                />
                {errors.email && (
                  <p className="form-error" id="contact-email-error">{errors.email}</p>
                )}
              </div>

              <div className="form-row" style={{ marginTop: 20 }}>
                <label className="form-label" htmlFor="contact-subject">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  className="editorial-input"
                  type="text"
                  value={form.subject}
                  onChange={e => updateField('subject', e.target.value)}
                  aria-invalid={!!errors.subject}
                  aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                />
                {errors.subject && (
                  <p className="form-error" id="contact-subject-error">{errors.subject}</p>
                )}
              </div>

              <div className="form-row" style={{ marginTop: 20 }}>
                <label className="form-label" htmlFor="contact-message">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  className="editorial-input contact-textarea"
                  rows={5}
                  value={form.message}
                  onChange={e => updateField('message', e.target.value)}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? 'contact-message-error' : undefined}
                />
                {errors.message && (
                  <p className="form-error" id="contact-message-error">{errors.message}</p>
                )}
              </div>

              <button className="btn" type="submit" style={{ width: '100%', marginTop: 28 }}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
