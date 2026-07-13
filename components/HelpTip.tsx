type Props = {
  /** Tooltip text shown on hover / focus. */
  text: string
  /** Field name, used to build an accessible label (e.g. "Password: …"). */
  label?: string
}

/** A small "?" help icon that reveals a tooltip on hover or keyboard focus.
 *  Keyboard-accessible (focusable) and screen-reader friendly via aria-label. */
export default function HelpTip({ text, label }: Props) {
  return (
    <span
      className="help-tip"
      tabIndex={0}
      role="note"
      aria-label={label ? `${label} help: ${text}` : text}
    >
      <span className="help-tip-mark" aria-hidden="true">?</span>
      <span className="help-tip-bubble" role="tooltip">{text}</span>
    </span>
  )
}
