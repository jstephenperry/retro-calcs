// Faithful HP 12C key layout.
//
// Each key carries up to three labels:
//   - primary (white text on the key face)
//   - fLabel  (gold text printed above the key, activated by `f`)
//   - gLabel  (blue text printed on the lower half of the key face, by `g`)
//
// The layout is a 4-row × 10-column grid; ENTER occupies two columns on
// row 3. Keys whose `g` or `f` shift are not implemented in this reference
// engine still render the original label so the face stays accurate.

import type { Action, Digit, FinKey } from './engine/engine'

export type KeyId =
  | 'n' | 'i' | 'PV' | 'PMT' | 'FV' | 'CHS'
  | 'D7' | 'D8' | 'D9' | 'div'
  | 'yx' | 'recip' | 'pctT' | 'pctDelta' | 'pct' | 'EEX'
  | 'D4' | 'D5' | 'D6' | 'mul'
  | 'Rdown' | 'swap' | 'CLx' | 'ENTER'
  | 'D1' | 'D2' | 'D3' | 'sub'
  | 'ON' | 'f' | 'g' | 'STO' | 'RCL'
  | 'D0' | 'dot' | 'sigmaPlus' | 'add'

export interface KeyDef {
  id: KeyId
  primary: string
  fLabel?: string
  gLabel?: string
  /** Span 2 grid columns (only ENTER on the HP 12C). */
  wide?: boolean
  /** Action emitted when no shift is pending. */
  action?: Action
  /** Action emitted after `f` shift. */
  fAction?: Action
  /** Action emitted after `g` shift. */
  gAction?: Action
  /** Color hint for the UI. */
  color?: 'gold' | 'blue' | 'orange'
}

const digit = (n: Digit): Action => ({ type: 'DIGIT', d: n })

// Bare TVM key actions use `FIN` so the engine can disambiguate "store the
// fresh X" from "solve for this register". The g-shift on PV/PMT/FV is
// kept as an explicit SOLVE so users can force a compute even after a
// digit entry.
const finKey = (key: FinKey): { bare: Action; solve: Action } => ({
  bare:  { type: 'FIN', key },
  solve: { type: 'SOLVE_FIN', key },
})

// Layout rows, each row is a list of keys left-to-right.
export const ROWS: KeyDef[][] = [
  [
    { id: 'n',   primary: 'n',   fLabel: 'AMORT', gLabel: '12×',  action: finKey('n').bare,   gAction: { type: 'STORE_FIN_SCALED', key: 'n', factor: 12 } },
    { id: 'i',   primary: 'i',   fLabel: 'INT',   gLabel: '12÷',  action: finKey('i').bare,   gAction: { type: 'STORE_FIN_SCALED', key: 'i', factor: 1 / 12 } },
    { id: 'PV',  primary: 'PV',  fLabel: 'NPV',   gLabel: 'CFo',  action: finKey('pv').bare,  gAction: finKey('pv').solve },
    { id: 'PMT', primary: 'PMT', fLabel: 'RND',   gLabel: 'CFj',  action: finKey('pmt').bare, gAction: finKey('pmt').solve },
    { id: 'FV',  primary: 'FV',  fLabel: 'IRR',   gLabel: 'Nj',   action: finKey('fv').bare,  gAction: finKey('fv').solve },
    { id: 'CHS', primary: 'CHS', fLabel: 'RPN',   gLabel: 'DATE', action: { type: 'CHS' } },
    { id: 'D7',  primary: '7',   fLabel: 'BEG',   gLabel: 'D.MY', action: digit('7'), fAction: { type: 'BEGIN' } },
    { id: 'D8',  primary: '8',   fLabel: 'END',   gLabel: 'M.DY', action: digit('8'), fAction: { type: 'END' } },
    { id: 'D9',  primary: '9',   fLabel: 'MEM',   gLabel: 'CFLO', action: digit('9') },
    { id: 'div', primary: '÷',   fLabel: '',      gLabel: '',     action: { type: 'DIV' } },
  ],
  [
    { id: 'yx',       primary: 'yˣ',  fLabel: 'PRICE', gLabel: 'σ',    action: { type: 'YX' } },
    { id: 'recip',    primary: '1/x', fLabel: 'YTM',   gLabel: 'x̄',    action: { type: 'INV' } },
    { id: 'pctT',     primary: '%T',  fLabel: '',      gLabel: 'σx',   action: { type: 'PCT_T' } },
    { id: 'pctDelta', primary: 'Δ%',  fLabel: '',      gLabel: 'x̂,r',  action: { type: 'PCT_DELTA' } },
    { id: 'pct',      primary: '%',   fLabel: '',      gLabel: 'x̂y,r', action: { type: 'PCT' } },
    { id: 'EEX',      primary: 'EEX', fLabel: '',      gLabel: '',     action: { type: 'EEX' } },
    { id: 'D4',       primary: '4',   fLabel: 'D.MY',  gLabel: '',     action: digit('4') },
    { id: 'D5',       primary: '5',   fLabel: 'M.DY',  gLabel: 'DYS',  action: digit('5') },
    { id: 'D6',       primary: '6',   fLabel: '',      gLabel: '',     action: digit('6') },
    { id: 'mul',      primary: '×',   fLabel: '',      gLabel: 'x²',   action: { type: 'MUL' } },
  ],
  [
    { id: 'Rdown', primary: 'R↓',    fLabel: 'PRGM',  gLabel: 'PR',    action: { type: 'ROLL_DOWN' } },
    { id: 'swap',  primary: 'x↔y',   fLabel: 'FIN',   gLabel: 'REG',   action: { type: 'SWAP' } },
    { id: 'CLx',   primary: 'CLx',   fLabel: 'PREFIX',gLabel: 'CLΣ',   action: { type: 'CLX' } },
    { id: 'ENTER', primary: 'ENTER', fLabel: '',      gLabel: 'LSTx',  wide: true, action: { type: 'ENTER' }, gAction: { type: 'LSTX' } },
    { id: 'D1',    primary: '1',     fLabel: '',      gLabel: 'x≤y',   action: digit('1') },
    { id: 'D2',    primary: '2',     fLabel: '',      gLabel: 'x=0',   action: digit('2') },
    { id: 'D3',    primary: '3',     fLabel: '',      gLabel: '',      action: digit('3') },
    { id: 'sub',   primary: '−',     fLabel: '',      gLabel: '',      action: { type: 'SUB' } },
  ],
  [
    { id: 'ON',  primary: 'ON',  action: { type: 'CLEAR_FIN' } },
    { id: 'f',   primary: 'f',   color: 'gold',   action: { type: 'SHIFT', shift: 'f' } },
    { id: 'g',   primary: 'g',   color: 'blue',   action: { type: 'SHIFT', shift: 'g' } },
    { id: 'STO', primary: 'STO', fLabel: '',      gLabel: '',     /* action fills in via UI register prompt */ },
    { id: 'RCL', primary: 'RCL', fLabel: '',      gLabel: '',     /* action fills in via UI register prompt */ },
    { id: 'D0',        primary: '0',  fLabel: '',     gLabel: '',     action: digit('0') },
    { id: 'dot',       primary: '·',  fLabel: '',     gLabel: '',     action: { type: 'DOT' } },
    { id: 'sigmaPlus', primary: 'Σ+', fLabel: '',     gLabel: 'Σ−',   /* not implemented */ },
    { id: 'add',       primary: '+',  fLabel: '',     gLabel: '',     action: { type: 'ADD' } },
  ],
]

/** Look up the key definition by id. Useful for keyboard bindings & tests. */
export function findKey(id: KeyId): KeyDef | undefined {
  for (const row of ROWS) {
    const k = row.find(k => k.id === id)
    if (k) return k
  }
  return undefined
}
