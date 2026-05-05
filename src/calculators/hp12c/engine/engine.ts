// HP 12C calculator state machine.
//
// The engine receives semantic actions (one per logical key) and returns
// the next state. The reducer is pure so the React layer can hold it as a
// `useReducer` state and tests can drive it without rendering.
//
// Stack-lift discipline (a real HP 12C subtlety):
//   * After arithmetic, RCL, LASTX or pushing a stored value, lift is
//     ENABLED — the next number entry will lift the stack before writing X.
//   * After ENTER, CLx or finishing a digit-entry, lift is DISABLED — the
//     next digit overwrites X without lifting.
//
// The `liftEnabled` flag captures that bit of state so digit entry can do
// the right thing without inspecting the previous action.

import { EMPTY_STACK, clearX, drop, enter, lift, replaceX, rollDown, swapXY } from './stack'
import { parseEntry } from './display'
import { solveFV, solveI, solveN, solvePMT, solvePV } from './tvm'
import type { CalcState, FinancialRegisters, Shift } from './types'

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
export type FinKey = 'n' | 'i' | 'pv' | 'pmt' | 'fv'

export type Action =
  | { type: 'DIGIT'; d: Digit }
  | { type: 'DOT' }
  | { type: 'CHS' }
  | { type: 'EEX' }
  | { type: 'CLX' }
  | { type: 'BACKSPACE' }
  | { type: 'ENTER' }
  | { type: 'SWAP' }
  | { type: 'ROLL_DOWN' }
  | { type: 'LSTX' }
  | { type: 'ADD' } | { type: 'SUB' } | { type: 'MUL' } | { type: 'DIV' }
  | { type: 'INV' } | { type: 'SQRT' } | { type: 'YX' } | { type: 'LN' } | { type: 'EXP' }
  | { type: 'PCT' } | { type: 'PCT_T' } | { type: 'PCT_DELTA' }
  | { type: 'INT_PART' } | { type: 'FRAC_PART' }
  | { type: 'SHIFT'; shift: Shift }
  | { type: 'FIX'; digits: number }
  | { type: 'SCI'; digits: number }
  | { type: 'BEGIN' }
  | { type: 'END' }
  | { type: 'STO'; reg: number }
  | { type: 'RCL'; reg: number }
  | { type: 'STORE_FIN'; key: FinKey }
  | { type: 'STORE_FIN_SCALED'; key: FinKey; factor: number }
  | { type: 'SOLVE_FIN'; key: FinKey }
  /** Smart bare-press of a TVM key: stores X if the user just keyed in
   *  a value, otherwise solves for the named register. Mirrors the real
   *  HP 12C, where the same physical key both stores and computes. */
  | { type: 'FIN'; key: FinKey }
  | { type: 'CLEAR_FIN' }
  | { type: 'CLEAR_REG' }

/** Internal state — stable shape across HP calculators in this repo. */
export interface InternalState extends CalcState {
  liftEnabled: boolean
  /** True when the immediately previous action was a TVM store/solve.
   *  Used by the `FIN` action to disambiguate "store X here" from
   *  "compute the value of this register". */
  lastWasTvm: boolean
}

export const INITIAL_STATE: InternalState = {
  stack: { ...EMPTY_STACK },
  fin: { n: 0, i: 0, pv: 0, pmt: 0, fv: 0, begin: 0 },
  mem: new Array<number>(20).fill(0),
  display: { kind: 'fix', digits: 2 },
  shift: null,
  entry: null,
  error: null,
  liftEnabled: false,
  lastWasTvm: false,
}

export function isEditing(s: InternalState): boolean {
  return s.entry !== null
}

/** Commit any pending entry into stack.x and clear the entry buffer. */
function commit(state: InternalState): InternalState {
  if (state.entry === null) return state
  const value = parseEntry(state.entry)
  if (Number.isNaN(value)) {
    return { ...state, entry: null, error: 'Error 0' }
  }
  return {
    ...state,
    entry: null,
    stack: { ...state.stack, x: value },
    liftEnabled: true,
  }
}

function withError(s: InternalState, msg: string): InternalState {
  return { ...s, error: msg, shift: null, entry: null, liftEnabled: false }
}

function unary(state: InternalState, fn: (x: number) => number): InternalState {
  const s = commit(state)
  if (s.error) return s
  const result = fn(s.stack.x)
  if (!Number.isFinite(result)) return withError(s, 'Error 0')
  return { ...s, stack: replaceX(s.stack, result), shift: null, liftEnabled: true }
}

function binary(state: InternalState, fn: (y: number, x: number) => number): InternalState {
  const s = commit(state)
  if (s.error) return s
  const result = fn(s.stack.y, s.stack.x)
  if (!Number.isFinite(result)) return withError(s, 'Error 0')
  return { ...s, stack: drop(s.stack, result), shift: null, liftEnabled: true }
}

function appendDigit(state: InternalState, ch: string): InternalState {
  // First character of a new entry. Lift the stack if lift is enabled,
  // otherwise overwrite X. Either way, X is going to be re-derived from
  // the entry buffer when we commit.
  if (state.entry === null) {
    const stack = state.liftEnabled ? lift(state.stack, 0) : { ...state.stack, x: 0 }
    return {
      ...state,
      entry: ch === '.' ? '0.' : ch,
      stack,
      liftEnabled: false,
      error: null,
      shift: null,
    }
  }
  if (ch === '.') {
    if (state.entry.includes('.') || state.entry.includes('e')) return state
    return { ...state, entry: state.entry + '.' }
  }
  // Cap the entry at 10 significant digits, matching the HP 12C display.
  const sig = state.entry.replace(/[-.]/g, '').replace(/^0+/, '')
  if (sig.length >= 10) return state
  return { ...state, entry: state.entry + ch }
}

function applyCHS(state: InternalState): InternalState {
  if (state.entry !== null) {
    // CHS during entry toggles the sign of either the mantissa or the
    // exponent depending on whether an `e` is present.
    const idx = state.entry.indexOf('e')
    if (idx >= 0) {
      const mantissa = state.entry.slice(0, idx)
      const exp = state.entry.slice(idx + 1)
      const nextExp = exp.startsWith('-') ? exp.slice(1) : '-' + exp
      return { ...state, entry: mantissa + 'e' + nextExp }
    }
    const next = state.entry.startsWith('-') ? state.entry.slice(1) : '-' + state.entry
    return { ...state, entry: next }
  }
  return { ...state, stack: { ...state.stack, x: -state.stack.x } }
}

function applyEEX(state: InternalState): InternalState {
  // Starting a new EEX entry implicitly enters "1" as the mantissa, which
  // matches the HP 12C: pressing EEX with no entry yields 1.0 e+00.
  if (state.entry === null) {
    const stack = state.liftEnabled ? lift(state.stack, 0) : { ...state.stack, x: 0 }
    return { ...state, entry: '1e', stack, liftEnabled: false, error: null, shift: null }
  }
  if (state.entry.includes('e')) return state
  return { ...state, entry: state.entry + 'e' }
}

function backspace(state: InternalState): InternalState {
  if (state.entry === null) {
    return { ...state, stack: clearX(state.stack), error: null, liftEnabled: false }
  }
  const next = state.entry.slice(0, -1)
  return { ...state, entry: next.length === 0 ? null : next }
}

function withFin(state: InternalState, patch: Partial<FinancialRegisters>): InternalState {
  return { ...state, fin: { ...state.fin, ...patch } }
}

function storeFin(state: InternalState, key: FinKey): InternalState {
  const s = commit(state)
  return { ...withFin(s, { [key]: s.stack.x }), shift: null, liftEnabled: true }
}

function solveFin(state: InternalState, key: FinKey): InternalState {
  const s = commit(state)
  try {
    const f = s.fin
    let result: number
    switch (key) {
      case 'n':   result = solveN({ i: f.i, pv: f.pv, pmt: f.pmt, fv: f.fv, mode: f.begin }); break
      case 'i':   result = solveI({ n: f.n, pv: f.pv, pmt: f.pmt, fv: f.fv, mode: f.begin }); break
      case 'pv':  result = solvePV({ n: f.n, i: f.i, pmt: f.pmt, fv: f.fv, mode: f.begin }); break
      case 'pmt': result = solvePMT({ n: f.n, i: f.i, pv: f.pv, fv: f.fv, mode: f.begin }); break
      case 'fv':  result = solveFV({ n: f.n, i: f.i, pv: f.pv, pmt: f.pmt, mode: f.begin }); break
    }
    const next = withFin(s, { [key]: result })
    return {
      ...next,
      shift: null,
      stack: replaceX(next.stack, result),
      liftEnabled: true,
    }
  } catch (e) {
    return withError(s, e instanceof Error ? e.message.startsWith('TVM') ? 'Error 5' : e.message : 'Error 5')
  }
}

/** Action types that should leave `lastWasTvm` unchanged (purely modal,
 *  don't touch X or the registers). */
const NEUTRAL_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'SHIFT', 'FIX', 'SCI', 'BEGIN', 'END',
])
/** Action types that mark the next bare TVM key as a "compute" press. */
const TVM_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'STORE_FIN', 'STORE_FIN_SCALED', 'SOLVE_FIN', 'FIN',
])

export function reduce(state: InternalState, action: Action): InternalState {
  const next = reduceImpl(state, action)
  if (NEUTRAL_ACTIONS.has(action.type)) return next
  if (TVM_ACTIONS.has(action.type)) return { ...next, lastWasTvm: true }
  return { ...next, lastWasTvm: false }
}

function reduceImpl(state: InternalState, action: Action): InternalState {
  // Any keypress clears a sticky error.
  const s = state.error ? { ...state, error: null } : state

  switch (action.type) {
    case 'DIGIT': return appendDigit(s, action.d)
    case 'DOT':   return appendDigit(s, '.')
    case 'CHS':   return applyCHS(s)
    case 'EEX':   return applyEEX(s)
    case 'CLX': {
      // Discard any in-progress entry and zero X with lift disabled.
      return { ...s, stack: clearX(s.stack), entry: null, shift: null, liftEnabled: false }
    }
    case 'BACKSPACE': return backspace(s)

    case 'ENTER': {
      const c = commit(s)
      return { ...c, stack: enter(c.stack), entry: null, shift: null, liftEnabled: false }
    }
    case 'SWAP':       return { ...commit(s), stack: swapXY(commit(s).stack), shift: null, liftEnabled: true }
    case 'ROLL_DOWN':  return { ...commit(s), stack: rollDown(commit(s).stack), shift: null, liftEnabled: true }
    case 'LSTX': {
      const c = commit(s)
      const stack = c.liftEnabled ? lift(c.stack, c.stack.lastX) : { ...c.stack, x: c.stack.lastX }
      return { ...c, stack, shift: null, liftEnabled: true }
    }

    case 'ADD': return binary(s, (y, x) => y + x)
    case 'SUB': return binary(s, (y, x) => y - x)
    case 'MUL': return binary(s, (y, x) => y * x)
    case 'DIV': return binary(s, (y, x) => x === 0 ? NaN : y / x)

    case 'INV':  return unary(s, x => x === 0 ? NaN : 1 / x)
    case 'SQRT': return unary(s, x => x < 0 ? NaN : Math.sqrt(x))
    case 'YX':   return binary(s, (y, x) => Math.pow(y, x))
    case 'LN':   return unary(s, x => x <= 0 ? NaN : Math.log(x))
    case 'EXP':  return unary(s, x => Math.exp(x))
    case 'INT_PART':  return unary(s, x => Math.trunc(x))
    case 'FRAC_PART': return unary(s, x => x - Math.trunc(x))

    case 'PCT': {
      const c = commit(s)
      if (c.error) return c
      const result = (c.stack.y * c.stack.x) / 100
      return { ...c, stack: replaceX(c.stack, result), shift: null, liftEnabled: true }
    }
    case 'PCT_DELTA': {
      const c = commit(s)
      if (c.error) return c
      if (c.stack.y === 0) return withError(c, 'Error 0')
      const result = (100 * (c.stack.x - c.stack.y)) / c.stack.y
      return { ...c, stack: replaceX(c.stack, result), shift: null, liftEnabled: true }
    }
    case 'PCT_T': {
      const c = commit(s)
      if (c.error) return c
      if (c.stack.y === 0) return withError(c, 'Error 0')
      const result = (100 * c.stack.x) / c.stack.y
      return { ...c, stack: replaceX(c.stack, result), shift: null, liftEnabled: true }
    }

    case 'SHIFT': return { ...s, shift: action.shift }
    case 'FIX':   return { ...s, display: { kind: 'fix', digits: action.digits }, shift: null }
    case 'SCI':   return { ...s, display: { kind: 'sci', digits: action.digits }, shift: null }
    case 'BEGIN': return { ...withFin(s, { begin: 1 }), shift: null }
    case 'END':   return { ...withFin(s, { begin: 0 }), shift: null }

    case 'STO': {
      const c = commit(s)
      if (action.reg < 0 || action.reg >= c.mem.length) return withError(c, 'Error 3')
      const mem = c.mem.slice()
      mem[action.reg] = c.stack.x
      return { ...c, mem, shift: null, liftEnabled: true }
    }
    case 'RCL': {
      const c = commit(s)
      if (action.reg < 0 || action.reg >= c.mem.length) return withError(c, 'Error 3')
      const stack = c.liftEnabled ? lift(c.stack, c.mem[action.reg]) : { ...c.stack, x: c.mem[action.reg] }
      return { ...c, stack, shift: null, liftEnabled: true }
    }

    case 'STORE_FIN': return storeFin(s, action.key)
    case 'STORE_FIN_SCALED': {
      // Convenience operator (g-shift on `n` and `i`): multiply X by the
      // scale factor and store the result in the named register, leaving
      // the scaled value in X. The HP 12C uses this to convert years↔months
      // and APR↔periodic-rate without an explicit multiply step.
      const c = commit(s)
      if (c.error) return c
      const value = c.stack.x * action.factor
      if (!Number.isFinite(value)) return withError(c, 'Error 0')
      return {
        ...withFin(c, { [action.key]: value }),
        stack: replaceX(c.stack, value),
        shift: null,
        liftEnabled: true,
      }
    }
    case 'SOLVE_FIN': return solveFin(s, action.key)
    case 'FIN': {
      // Smart routing: if the user has a fresh value in X (no prior TVM
      // press, or an entry buffer in progress), treat this press as
      // STORE; otherwise compute the named register.
      if (s.lastWasTvm && s.entry === null) return solveFin(s, action.key)
      return storeFin(s, action.key)
    }
    case 'CLEAR_FIN': return { ...withFin(s, { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 }), shift: null }
    case 'CLEAR_REG': return { ...s, mem: new Array<number>(s.mem.length).fill(0), shift: null }
  }
}

/** What the display should show: either the live entry buffer or X. */
export function displayValue(state: InternalState): { entry: string | null; value: number; error: string | null } {
  return { entry: state.entry, value: state.stack.x, error: state.error }
}
