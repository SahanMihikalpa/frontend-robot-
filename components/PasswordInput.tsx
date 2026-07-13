import { useState } from 'react'

type Props = {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  ariaInvalid?: boolean
  placeholder?: string
  required?: boolean
}

const EyeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

/** Password field with a show/hide (eye) toggle, styled to match .editorial-input. */
export default function PasswordInput({
  id, value, onChange, autoComplete, ariaInvalid, placeholder, required = true,
}: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-field">
      <input
        id={id}
        className="editorial-input password-field-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={ariaInvalid || undefined}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  )
}
