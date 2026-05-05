import { useReducer, useState } from 'react'
import { Display } from './Display'
import { Key } from './Key'
import { ROWS, type KeyDef } from './keys'
import { INITIAL_STATE, reduce, type Action } from './engine/engine'
import type { FinKey } from './engine/engine'
import './HP12C.css'

type Pending = null | 'STO' | 'RCL'

/** Map from a key id to the financial-register name it represents. */
const TVM_KEY_TO_FIN: Partial<Record<string, FinKey>> = {
  n: 'n',
  i: 'i',
  PV: 'pv',
  PMT: 'pmt',
  FV: 'fv',
}

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
    // STO/RCL prompt for a register on the next key press.
    if (def.id === 'STO') { setPending('STO'); return }
    if (def.id === 'RCL') { setPending('RCL'); return }

    if (pending) {
      // RCL/STO followed by a digit → numbered register (R0..R9).
      if (/^D[0-9]$/.test(def.id)) {
        const reg = Number(def.id.slice(1))
        dispatch({ type: pending, reg } as Action)
        setPending(null)
        return
      }
      // RCL/STO followed by a TVM key → financial register.
      const finKey = TVM_KEY_TO_FIN[def.id]
      if (finKey) {
        if (pending === 'RCL') dispatch({ type: 'RCL_FIN', key: finKey })
        else dispatch({ type: 'STORE_FIN', key: finKey })
        setPending(null)
        return
      }
      // Anything else cancels the prompt and re-dispatches as a normal press.
      setPending(null)
    }

    // Resolve the action, honoring the f/g shift state. The HP 12C uses
    // `f` + digit as FIX n only when the digit key has no specific
    // f-shifted function — otherwise the per-key fAction wins (e.g.
    // f-shifted `9` is MEM, not FIX 9).
    let action: Action | undefined
    if (state.shift === 'f') {
      if (def.fAction) action = def.fAction
      else if (/^D[0-9]$/.test(def.id)) action = { type: 'FIX', digits: Number(def.id.slice(1)) }
      else action = def.action
    } else if (state.shift === 'g') {
      action = def.gAction ?? def.action
    } else {
      action = def.action
    }

    if (action) dispatch(action)
    else if (state.shift) dispatch({ type: 'SHIFT', shift: null })
  }

  const promptText = pending ? `${pending} _` : null

  return (
    <div className="hp12c" data-testid="hp12c">
      <div className="hp12c__top">
        <div className="hp12c__brand">
          <span className="hp12c__hp">hp</span>
          <span className="hp12c__model">12C</span>
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
      </div>

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

      <div className="hp12c__footer">
        <span className="hp12c__sub">FINANCIAL CALCULATOR</span>
      </div>
    </div>
  )
}
