import { describe, expect, test } from 'vitest'
import { INITIAL_STATE, displayValue, reduce, type Action } from '../engine'

const run = (...actions: Action[]) => actions.reduce(reduce, INITIAL_STATE)

const digits = (s: string): Action[] =>
  s.split('').map(c => c === '.' ? { type: 'DOT' } as const :
    ({ type: 'DIGIT', d: c as '0' } as Action))

describe('HP 12C engine: number entry', () => {
  test('typing digits builds the entry buffer without lifting until commit', () => {
    const s = run(...digits('123'))
    expect(s.entry).toBe('123')
    expect(displayValue(s).value).toBe(0) // X is not yet committed
  })

  test('ENTER commits and lifts; subsequent digits overwrite X', () => {
    // 3 ENTER 5 leaves X=5, Y=3
    const s = run(...digits('3'), { type: 'ENTER' }, ...digits('5'))
    expect(s.entry).toBe('5')
    expect(s.stack.y).toBe(3)
  })

  test('decimal point is honored at most once', () => {
    const s = run(...digits('1.5.2'))
    expect(s.entry).toBe('1.52') // the second dot is rejected
  })

  test('CHS during entry toggles the leading sign', () => {
    const s = run(...digits('42'), { type: 'CHS' }, { type: 'CHS' })
    expect(s.entry).toBe('42')
    const s2 = run(...digits('42'), { type: 'CHS' })
    expect(s2.entry).toBe('-42')
  })

  test('CHS on a finalized X negates it without re-entering edit mode', () => {
    const s = run(...digits('42'), { type: 'ENTER' }, { type: 'CHS' })
    expect(s.entry).toBeNull()
    expect(s.stack.x).toBe(-42)
  })

  test('EEX on an empty entry yields a leading 1', () => {
    const s = run({ type: 'EEX' }, ...digits('3'))
    expect(s.entry).toBe('1e3')
  })
})

describe('HP 12C engine: arithmetic', () => {
  test('3 ENTER 5 + = 8 with stack drop', () => {
    const s = run(...digits('3'), { type: 'ENTER' }, ...digits('5'), { type: 'ADD' })
    expect(s.stack.x).toBe(8)
    expect(s.stack.y).toBe(0)
  })

  test('chain calculation: (4 + 5) * (6 - 2) = 36', () => {
    const s = run(
      ...digits('4'), { type: 'ENTER' }, ...digits('5'), { type: 'ADD' },
      ...digits('6'), { type: 'ENTER' }, ...digits('2'), { type: 'SUB' },
      { type: 'MUL' },
    )
    expect(s.stack.x).toBe(36)
  })

  test('division by zero produces Error 0', () => {
    const s = run(...digits('1'), { type: 'ENTER' }, ...digits('0'), { type: 'DIV' })
    expect(s.error).toBe('Error 0')
  })

  test('1/x preserves Y/Z/T', () => {
    const s = run(
      ...digits('9'), { type: 'ENTER' }, ...digits('8'), { type: 'ENTER' },
      ...digits('5'), { type: 'INV' },
    )
    expect(s.stack.x).toBe(0.2)
    expect(s.stack.y).toBe(8)
  })

  test('y^x: 2 ENTER 10 y^x = 1024', () => {
    const s = run(...digits('2'), { type: 'ENTER' }, ...digits('10'), { type: 'YX' })
    expect(s.stack.x).toBe(1024)
  })

  test('LASTX recovers the X consumed by the previous binary op', () => {
    const s = run(
      ...digits('7'), { type: 'ENTER' }, ...digits('3'), { type: 'ADD' },
      { type: 'LSTX' },
    )
    expect(s.stack.x).toBe(3)
    expect(s.stack.y).toBe(10)
  })

  test('CLx zeroes X but keeps the rest of the stack and disables lift', () => {
    const s = run(
      ...digits('7'), { type: 'ENTER' }, ...digits('3'), { type: 'CLX' },
      ...digits('9'),
    )
    // CLx then 9 should overwrite X (stack does not lift), so Y stays 7.
    expect(s.entry).toBe('9')
    expect(s.stack.y).toBe(7)
  })
})

describe('HP 12C engine: percentages', () => {
  test('% returns x% of y but does not drop the stack', () => {
    const s = run(...digits('200'), { type: 'ENTER' }, ...digits('15'), { type: 'PCT' })
    expect(s.stack.x).toBe(30)
    expect(s.stack.y).toBe(200)
  })

  test('Δ% is 100*(x-y)/y', () => {
    const s = run(...digits('80'), { type: 'ENTER' }, ...digits('100'), { type: 'PCT_DELTA' })
    expect(s.stack.x).toBe(25)
  })

  test('%T is 100*x/y', () => {
    const s = run(...digits('200'), { type: 'ENTER' }, ...digits('50'), { type: 'PCT_T' })
    expect(s.stack.x).toBe(25)
  })
})

describe('HP 12C engine: financial', () => {
  test('g-shifted 12× on n multiplies X by 12 and stores in n', () => {
    // "30 g 12×" — convert 30 years to 360 months and store as n.
    const s = run(
      ...digits('30'),
      { type: 'STORE_FIN_SCALED', key: 'n', factor: 12 },
    )
    expect(s.error).toBeNull()
    expect(s.fin.n).toBe(360)
    expect(s.stack.x).toBe(360)
  })

  test('g-shifted 12÷ on i divides X by 12 and stores in i', () => {
    // "6 g 12÷" — convert 6% APR to 0.5% per period and store as i.
    const s = run(
      ...digits('6'),
      { type: 'STORE_FIN_SCALED', key: 'i', factor: 1 / 12 },
    )
    expect(s.error).toBeNull()
    expect(s.fin.i).toBeCloseTo(0.5, 12)
    expect(s.stack.x).toBeCloseTo(0.5, 12)
  })

  test('bare PMT after a TVM setup chain solves; bare PMT after a digit stores', () => {
    // Reproduces the user-reported workflow: 30 g 12× / 4.25 g 12÷ /
    // 325000 PV / 0 FV / PMT. The final PMT press has no fresh entry,
    // so it must compute, not store.
    const s = run(
      ...digits('30'),     { type: 'STORE_FIN_SCALED', key: 'n', factor: 12 },
      ...digits('4.25'),   { type: 'STORE_FIN_SCALED', key: 'i', factor: 1 / 12 },
      ...digits('325000'), { type: 'FIN', key: 'pv' },
      ...digits('0'),      { type: 'FIN', key: 'fv' },
      { type: 'FIN', key: 'pmt' },
    )
    expect(s.error).toBeNull()
    // 325k at 4.25% APR over 30 years; sign is negative because PV was
    // entered positive (the user pays, the lender receives).
    expect(s.stack.x).toBeCloseTo(-1598.80, 2)
    expect(s.fin.pmt).toBeCloseTo(-1598.80, 2)
  })

  test('bare PMT immediately after a digit stores X into PMT', () => {
    const s = run(
      ...digits('123'),
      { type: 'FIN', key: 'pmt' },
    )
    expect(s.fin.pmt).toBe(123)
    expect(s.error).toBeNull()
  })

  test('mortgage payment via STORE_FIN/SOLVE_FIN', () => {
    const s = run(
      ...digits('360'), { type: 'STORE_FIN', key: 'n' },
      { type: 'DIGIT', d: '0' }, { type: 'DOT' }, { type: 'DIGIT', d: '5' }, { type: 'STORE_FIN', key: 'i' },
      ...digits('200000'), { type: 'CHS' }, { type: 'STORE_FIN', key: 'pv' },
      { type: 'SOLVE_FIN', key: 'pmt' },
    )
    expect(s.stack.x).toBeCloseTo(1199.10, 2)
    expect(s.fin.pmt).toBeCloseTo(1199.10, 2)
  })

  test('solving for a missing financial register stores both the answer and X', () => {
    const s = run(
      ...digits('10'),   { type: 'STORE_FIN', key: 'n' },
      ...digits('5'),    { type: 'STORE_FIN', key: 'i' },
      ...digits('1000'), { type: 'STORE_FIN', key: 'pmt' },
      { type: 'SOLVE_FIN', key: 'pv' },
    )
    expect(s.fin.pv).toBeCloseTo(-7721.73, 2)
    expect(s.stack.x).toBeCloseTo(-7721.73, 2)
  })
})

describe('HP 12C engine: memory and modes', () => {
  test('STO/RCL round-trip', () => {
    let s = run(...digits('42'), { type: 'STO', reg: 5 })
    s = reduce(s, { type: 'CLX' })
    s = reduce(s, { type: 'RCL', reg: 5 })
    expect(s.stack.x).toBe(42)
  })

  test('FIX changes display digits', () => {
    const s = reduce(INITIAL_STATE, { type: 'FIX', digits: 4 })
    expect(s.display).toEqual({ kind: 'fix', digits: 4 })
  })

  test('BEGIN/END toggle the annuity mode', () => {
    let s = reduce(INITIAL_STATE, { type: 'BEGIN' })
    expect(s.fin.begin).toBe(1)
    s = reduce(s, { type: 'END' })
    expect(s.fin.begin).toBe(0)
  })
})
