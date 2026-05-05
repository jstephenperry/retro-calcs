import type { KeyDef } from './keys'

interface Props {
  def: KeyDef
  onPress: (def: KeyDef) => void
  highlighted?: boolean
}

/**
 * A single HP 12C key. The key face shows the primary label centered, the
 * gold `f` annotation above the key, and the blue `g` annotation in the
 * lower part of the key face — matching the original silkscreen layout.
 */
export function Key({ def, onPress, highlighted }: Props) {
  const classes = ['hp12c-key']
  if (def.wide) classes.push('hp12c-key--wide')
  if (def.color === 'gold') classes.push('hp12c-key--gold')
  if (def.color === 'blue') classes.push('hp12c-key--blue')
  if (highlighted) classes.push('hp12c-key--active')

  return (
    <div className="hp12c-keycell">
      <div className="hp12c-key__flabel" aria-hidden="true">{def.fLabel ?? ''}</div>
      <button
        type="button"
        className={classes.join(' ')}
        data-testid={`key-${def.id}`}
        data-key-id={def.id}
        aria-label={`${def.primary}${def.fLabel ? ` (f: ${def.fLabel})` : ''}${def.gLabel ? ` (g: ${def.gLabel})` : ''}`}
        onClick={() => onPress(def)}
      >
        <span className="hp12c-key__primary">{def.primary}</span>
        <span className="hp12c-key__glabel" aria-hidden="true">{def.gLabel ?? ''}</span>
      </button>
    </div>
  )
}
