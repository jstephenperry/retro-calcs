import { formatNumber } from './engine/display'
import type { DisplayMode, Shift } from './engine/types'

interface Props {
  /** The committed value of stack X. */
  value: number
  /** When non-null, the user is mid-entry; show this string raw. */
  entry: string | null
  /** Sticky error message, when present. */
  error: string | null
  mode: DisplayMode
  shift: Shift
  begin: boolean
  /** Optional pending-register prompt, e.g. "STO _". */
  prompt?: string | null
}

/**
 * The HP 12C LCD. Renders the formatted value, plus the small annunciators
 * the original calculator shows along the bottom of the display
 * (BEGIN, f, g, etc.).
 */
export function Display(props: Props) {
  const { value, entry, error, mode, shift, begin, prompt } = props

  let text: string
  if (error) text = error
  else if (prompt) text = prompt
  else if (entry !== null) text = entry.replace('e', ' E')
  else text = formatNumber(value, mode)

  return (
    <div className="hp12c-display" data-testid="hp12c-display" role="status" aria-live="polite">
      <div className="hp12c-display__lcd">
        <span className="hp12c-display__text" data-testid="hp12c-display-text">
          {text}
        </span>
      </div>
      <div className="hp12c-display__annunciators" aria-hidden="true">
        <span className={begin ? 'on' : ''}>BEGIN</span>
        <span className={shift === 'f' ? 'on' : ''}>f</span>
        <span className={shift === 'g' ? 'on' : ''}>g</span>
        <span>{mode.kind === 'fix' ? `FIX ${mode.digits}` : `SCI ${mode.digits}`}</span>
      </div>
    </div>
  )
}
