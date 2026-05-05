import { useReducer, useState } from 'react'
import { Display } from './Display'
import { Key } from './Key'
import { ROWS, type KeyDef } from './keys'
import { INITIAL_STATE, reduce, type Action } from './engine/engine'
import './HP12C.css'

type Pending = null | 'STO' | 'RCL'

/**
 * The HP 12C calculator face. It owns the engine state and the small bit
 * of UI state needed to model the original "press STO then a digit" flow.
 *
 * This component intentionally has zero financial logic of its own — every
 * computation is driven through `reduce`, so the same engine can power
 * other front-ends (a CLI driver, an end-to-end test, etc.).
 */
export function HP12C() {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE)
  const [pending, setPending] = useState<Pending>(null)

  const handlePress = (def: KeyDef) => {
    // STO/RCL prompt for a register number on the next key press.
    if (def.id === 'STO') { setPending('STO'); return }
    if (def.id === 'RCL') { setPending('RCL'); return }

    if (pending && /^D[0-9]$/.test(def.id)) {
      const reg = Number(def.id.slice(1))
      dispatch({ type: pending, reg } as Action)
      setPending(null)
      return
    }
    if (pending) {
      // Cancel the pending prompt on any non-digit press.
      setPending(null)
    }

    // Pick action based on the current shift state.
    let action: Action | undefined
    if (state.shift === 'f' && def.fAction) action = def.fAction
    else if (state.shift === 'g' && def.gAction) action = def.gAction
    else action = def.action

    // `f` followed by a digit sets FIX precision (HP convention).
    if (state.shift === 'f' && /^D[0-9]$/.test(def.id)) {
      action = { type: 'FIX', digits: Number(def.id.slice(1)) }
    }

    if (action) dispatch(action)
    else if (state.shift) dispatch({ type: 'SHIFT', shift: null })
  }

  const promptText = pending ? `${pending} _` : null

  return (
    <div className="hp12c" data-testid="hp12c">
      <div className="hp12c__brand">
        <span className="hp12c__hp">hp</span>
        <span className="hp12c__model">12C</span>
        <span className="hp12c__sub">FINANCIAL CALCULATOR</span>
      </div>

      <Display
        value={state.stack.x}
        entry={state.entry}
        error={state.error}
        mode={state.display}
        shift={state.shift}
        begin={state.fin.begin === 1}
        prompt={promptText}
      />

      <div className="hp12c__keypad" role="group" aria-label="HP 12C keypad">
        {ROWS.map((row, ri) => (
          <div className="hp12c__row" key={ri}>
            {row.map((def) => (
              <Key
                key={def.id}
                def={def}
                onPress={handlePress}
                highlighted={
                  (state.shift === 'f' && def.id === 'f') ||
                  (state.shift === 'g' && def.id === 'g')
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
