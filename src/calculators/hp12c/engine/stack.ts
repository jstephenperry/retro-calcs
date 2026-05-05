// RPN stack operations for the HP 12C.
//
// The HP 12C maintains a 4-level stack (X, Y, Z, T). Three behaviors must
// be implemented faithfully:
//
//   - Stack lift:    new entry pushes X up, duplicating T at the top.
//                    [t z y x] -> [z y x x'] when x' is the new value
//   - Stack drop:    a binary op pops Y and replaces X with the result,
//                    duplicating T downward.
//                    [t z y x] -> [t t z f(y,x)]
//   - LASTX:         every operation that consumes X first stores the
//                    consumed X into the LASTX register.
//
// Pure functions only — they take a stack and return a new stack so the
// engine reducer stays free of mutation.

import type { Stack } from './types'

export const EMPTY_STACK: Stack = { x: 0, y: 0, z: 0, t: 0, lastX: 0 }

export function lift(s: Stack, newX: number): Stack {
  return { x: newX, y: s.x, z: s.y, t: s.z, lastX: s.lastX }
}

/** ENTER: copies X into Y, leaves X unchanged but disables stack lift. */
export function enter(s: Stack): Stack {
  return { x: s.x, y: s.x, z: s.y, t: s.z, lastX: s.lastX }
}

/** Roll down: x->lastY (rotated), y->x, z->y, t->z, x->t. */
export function rollDown(s: Stack): Stack {
  return { x: s.y, y: s.z, z: s.t, t: s.x, lastX: s.lastX }
}

/** X<>Y: swap the two bottom registers. */
export function swapXY(s: Stack): Stack {
  return { x: s.y, y: s.x, z: s.z, t: s.t, lastX: s.lastX }
}

/** Replace X without changing the rest of the stack. Used by unary ops. */
export function replaceX(s: Stack, value: number): Stack {
  return { x: value, y: s.y, z: s.z, t: s.t, lastX: s.x }
}

/** Pop Y into X with the binary result; T duplicates downward. */
export function drop(s: Stack, result: number): Stack {
  return { x: result, y: s.z, z: s.t, t: s.t, lastX: s.x }
}

/** Clear X (does not lift on next entry). */
export function clearX(s: Stack): Stack {
  return { x: 0, y: s.y, z: s.z, t: s.t, lastX: s.lastX }
}
