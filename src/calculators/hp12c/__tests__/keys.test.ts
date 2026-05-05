import { describe, expect, test } from 'vitest'
import { ROWS } from '../keys'

/** The visual column of a key on the calculator face. ENTER occupies two
 *  columns, gap cells (null) occupy one. Returns -1 if the id is unknown. */
function visualColumn(id: string): number {
  for (const row of ROWS) {
    let col = 0
    for (const cell of row) {
      if (cell && cell.id === id) return col
      col += cell?.wide ? 2 : 1
    }
  }
  return -1
}

describe('HP 12C key layout', () => {
  test('every row spans exactly 10 visual columns', () => {
    for (const row of ROWS) {
      const span = row.reduce((c, cell) => c + (cell?.wide ? 2 : 1), 0)
      expect(span).toBe(10)
    }
  })

  test('digit columns line up vertically: 7 / 4 / 1 / 0 in column 7', () => {
    // The HP 12C keeps the digit grid aligned: 7-4-1-0 in one column,
    // 8-5-2-· in the next, 9-6-3-Σ+ in the next, ÷-×-−-+ on the right.
    expect(visualColumn('D7')).toBe(6)
    expect(visualColumn('D4')).toBe(6)
    expect(visualColumn('D1')).toBe(6)
    expect(visualColumn('D0')).toBe(6)

    expect(visualColumn('D8')).toBe(7)
    expect(visualColumn('D5')).toBe(7)
    expect(visualColumn('D2')).toBe(7)
    expect(visualColumn('dot')).toBe(7)

    expect(visualColumn('D9')).toBe(8)
    expect(visualColumn('D6')).toBe(8)
    expect(visualColumn('D3')).toBe(8)
    expect(visualColumn('sigmaPlus')).toBe(8)

    expect(visualColumn('div')).toBe(9)
    expect(visualColumn('mul')).toBe(9)
    expect(visualColumn('sub')).toBe(9)
    expect(visualColumn('add')).toBe(9)
  })

  test('ENTER sits at column 4 and is two columns wide', () => {
    expect(visualColumn('ENTER')).toBe(3) // zero-indexed col 4
    const enter = ROWS.flat().find((c) => c && c.id === 'ENTER')
    expect(enter?.wide).toBe(true)
  })
})
