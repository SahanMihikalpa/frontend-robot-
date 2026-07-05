import { useEffect } from 'react'

/** Full-screen popup viewer for AI-generated visuals. Click anywhere or press Esc to close. */
export default function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      <button
        type="button"
        aria-label="Close image"
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 20,
          background: 'rgba(255, 255, 255, 0.12)', color: '#fff',
          border: 'none', borderRadius: '50%', width: 40, height: 40,
          fontSize: 18, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="AI-generated visual (enlarged)"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '92vh',
          borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          cursor: 'default', background: '#fff',
        }}
      />
    </div>
  )
}
