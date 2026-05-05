// Core types for the HP 12C engine.
//
// The HP 12C is an RPN calculator with a four-level operational stack
// (X, Y, Z, T), a LASTX register, financial registers (n, i, PV, PMT, FV)
// and a bank of numbered storage registers (R0..R9 and R.0..R.9).

export type Shift = null | 'f' | 'g'

export interface Stack {
  x: number
  y: number
  z: number
  t: number
  lastX: number
}

export interface FinancialRegisters {
  n: number
  i: number // periodic rate as a percentage (HP convention: 5 means 5%)
  pv: number
  pmt: number
  fv: number
  /** 0 = END mode, 1 = BEGIN mode (annuity due) */
  begin: 0 | 1
}

export interface DisplayMode {
  kind: 'fix' | 'sci'
  digits: number // 0..9
}

export interface CalcState {
  stack: Stack
  fin: FinancialRegisters
  /** 20 numbered registers: indices 0-9 are R0-R9, 10-19 are R.0-R.9 */
  mem: number[]
  display: DisplayMode
  /** Current keypad shift, null when no shift is pending. */
  shift: Shift
  /**
   * The string the user is currently keying into X. When null, X is treated
   * as a finalized number (next digit press starts a new entry and lifts
   * the stack).
   */
  entry: string | null
  /** Last error message; cleared by any key press. */
  error: string | null
}

/** A canonical name for every primary HP 12C key on the face. */
export type KeyId =
  // top financial row
  | 'n' | 'i' | 'PV' | 'PMT' | 'FV' | 'CHS'
  // digits
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  // arithmetic
  | 'div' | 'mul' | 'sub' | 'add'
  // second row
  | 'yx' | 'recip' | 'pctT' | 'pctDelta' | 'pct' | 'EEX'
  // third row
  | 'Rdown' | 'swap' | 'CLx' | 'ENTER'
  // bottom row
  | 'ON' | 'f' | 'g' | 'STO' | 'RCL' | 'dot' | 'sigmaPlus'
