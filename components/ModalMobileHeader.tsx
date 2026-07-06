type Props = {
  title: string
  subtitle?: string
  onBack: () => void
  backLabel?: string
}

export default function ModalMobileHeader({ title, subtitle, onBack, backLabel = 'Back' }: Props) {
  return (
    <div className="modal-mobile-header">
      <button
        type="button"
        className="modal-mobile-back"
        aria-label={backLabel}
        onClick={onBack}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="modal-mobile-header-text">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  )
}
