import { describe, expect, test } from 'vitest'
import { EMPTY_STACK, clearX, drop, enter, lift, replaceX, rollDown, swapXY } from '../stack'

const s = (x: number, y: number, z: number, t: number, lastX = 0) =>
  ({ x, y, z, t, lastX })

describe('RPN stack', () => {
  test('lift pushes prior X up the stack and drops T off the top', () => {
    expect(lift(s(1, 2, 3, 4), 9)).toEqual(s(9, 1, 2, 3))
  })

  test('enter copies X into Y', () => {
    expect(enter(s(5, 9, 0, 0))).toEqual(s(5, 5, 9, 0))
  })

  test('roll down rotates the four registers', () => {
    expect(rollDown(s(1, 2, 3, 4))).toEqual(s(2, 3, 4, 1))
  })

  test('swap exchanges X and Y only', () => {
    expect(swapXY(s(1, 2, 3, 4))).toEqual(s(2, 1, 3, 4))
  })

  test('replaceX preserves Y/Z/T and writes the prior X to LASTX', () => {
    expect(replaceX(s(7, 2, 3, 4, 0), 99)).toEqual(s(99, 2, 3, 4, 7))
  })

  test('drop pops Y and duplicates T downward, recording prior X in LASTX', () => {
    expect(drop(s(5, 3, 8, 11), 15)).toEqual(s(15, 8, 11, 11, 5))
  })

  test('clearX zeroes X without touching the rest of the stack', () => {
    expect(clearX(s(5, 1, 2, 3))).toEqual(s(0, 1, 2, 3))
  })

  test('EMPTY_STACK is all zeros', () => {
    expect(EMPTY_STACK).toEqual({ x: 0, y: 0, z: 0, t: 0, lastX: 0 })
  })
})
