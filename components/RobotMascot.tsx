export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

const NAVY = '#37426B'
const BODY = '#E4E9F7'
const PANEL = '#EFF2FB'

const CFG: Record<ToastVariant, {
  acol: string; anim: string; eyes: 'happy' | 'x' | 'shock' | 'dots'
  mouth?: 'smile' | 'flat'; wave?: boolean; tri?: boolean
}> = {
  success: { acol: '#16A34A', anim: 'bob',    eyes: 'happy', mouth: 'smile', wave: true },
  error:   { acol: '#EF4444', anim: 'shake',  eyes: 'x',     mouth: 'flat',  tri: true },
  warning: { acol: '#F59E0B', anim: 'wobble', eyes: 'shock' },
  info:    { acol: '#2563EB', anim: 'nod',    eyes: 'dots',  wave: true },
}

/** Animated Atlas robot mascot for toast notifications — head + body + arms.
 *  One expression per variant. `size` is the rendered height in px. */
export default function RobotMascot({ variant, size = 62 }: { variant: ToastVariant; size?: number }) {
  const c = CFG[variant]
  const width = Math.round((size * 54) / 70)
  return (
    <svg
      className="atlas-bot"
      width={width}
      height={size}
      viewBox="0 0 54 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className={`atlas-bi atlas-${c.anim}`}>
        {/* antenna */}
        <line x1="27" y1="13" x2="27" y2="7.6" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
        <circle className="atlas-ping" cx="27" cy="6" r="3.2" fill={c.acol} stroke={NAVY} strokeWidth="1.4" />

        {/* neck */}
        <path d="M23.5 33 v4 M30.5 33 v4" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" />

        {/* body */}
        <rect x="13" y="37" width="28" height="25" rx="9" fill={BODY} stroke={NAVY} strokeWidth="2.4" />
        <rect x="20" y="44.5" width="14" height="10" rx="3.5" fill={PANEL} stroke={NAVY} strokeWidth="1.5" />
        {/* feet */}
        <rect x="19" y="60.5" width="7" height="6" rx="2.6" fill={BODY} stroke={NAVY} strokeWidth="2.2" />
        <rect x="28" y="60.5" width="7" height="6" rx="2.6" fill={BODY} stroke={NAVY} strokeWidth="2.2" />

        {/* arms from the body */}
        <path d="M13 44 c-6 1.5 -7 9 -3 13" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {c.wave ? (
          <g className="atlas-arm">
            <path d="M41 43 c6 -2 9 -8 8 -14" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          <path d="M41 44 c6 1.5 7 9 3 13" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        )}

        {/* head */}
        <rect x="14" y="13" width="26" height="21" rx="8" fill={BODY} stroke={NAVY} strokeWidth="2.4" />

        {c.eyes === 'dots' && (
          <>
            <circle cx="22" cy="23" r="2.4" fill={NAVY} />
            <circle cx="32" cy="23" r="2.4" fill={NAVY} />
          </>
        )}
        {c.eyes === 'happy' && (
          <>
            <path d="M18.8 24.5 q3.2 -4 6.4 0" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M28.8 24.5 q3.2 -4 6.4 0" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </>
        )}
        {c.eyes === 'x' && (
          <>
            <path d="M20 21 l4 4 M24 21 l-4 4" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
            <path d="M30 21 l4 4 M34 21 l-4 4" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {c.eyes === 'shock' && (
          <>
            <circle cx="22" cy="23" r="3.2" fill="#fff" stroke={NAVY} strokeWidth="2" />
            <circle cx="32" cy="23" r="3.2" fill="#fff" stroke={NAVY} strokeWidth="2" />
            <circle cx="22" cy="23" r="1.1" fill={NAVY} />
            <circle cx="32" cy="23" r="1.1" fill={NAVY} />
          </>
        )}
        {c.mouth === 'smile' && (
          <path d="M23 29 q4 3 8 0" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        )}
        {c.mouth === 'flat' && (
          <path d="M23 29.5 h8" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" />
        )}

        {c.tri && (
          <>
            <path d="M42.5 3 l5.5 9.2 h-11 z" fill={c.acol} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
            <line x1="42.5" y1="6.4" x2="42.5" y2="9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="42.5" cy="10.6" r="0.8" fill="#fff" />
          </>
        )}
      </g>
    </svg>
  )
}
