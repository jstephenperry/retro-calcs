// Display formatting for the HP 12C.
//
// The HP 12C shows up to 10 digits and switches to scientific notation when
// a number is too large or too small to display in the chosen FIX precision.
// We render here using ASCII; the UI layer styles it as a 7-segment LCD.

import type { DisplayMode } from './types'

const MAX_FIX = 1e10

/** Format a number for display using the calculator's FIX/SCI mode. */
export function formatNumber(value: number, mode: DisplayMode): string {
  if (!Number.isFinite(value)) return 'Error 0'
  if (Object.is(value, -0)) value = 0

  const digits = clampDigits(mode.digits)

  if (mode.kind === 'sci') return formatSci(value, digits)

  const abs = Math.abs(value)
  // Switch to SCI when a fixed representation would overflow 10 digits.
  if (abs !== 0 && (abs >= MAX_FIX || abs < Math.pow(10, -digits) / 10)) {
    return formatSci(value, digits)
  }

  return formatFix(value, digits)
}

function clampDigits(d: number): number {
  if (!Number.isFinite(d)) return 2
  return Math.min(9, Math.max(0, Math.trunc(d)))
}

function formatFix(value: number, digits: number): string {
  const sign = value < 0 ? '-' : ''
  const fixed = Math.abs(value).toFixed(digits)
  const [intPart, fracPart] = fixed.split('.')
  const grouped = withThousands(intPart)
  return fracPart ? `${sign}${grouped}.${fracPart}` : `${sign}${grouped}`
}

function formatSci(value: number, digits: number): string {
  // HP 12C SCI shows mantissa with `digits` digits after the decimal and a
  // signed two-digit exponent. We render the exponent as e.g. "1.2345 e-03".
  const sign = value < 0 ? '-' : ''
  if (value === 0) return `${sign}0.${'0'.repeat(digits)} e+00`
  const exp = Math.floor(Math.log10(Math.abs(value)))
  const mantissa = Math.abs(value) / Math.pow(10, exp)
  // Guard against floating point edge case where mantissa rounds to 10.
  let m = mantissa
  let e = exp
  const rounded = Number(m.toFixed(digits))
  if (rounded >= 10) {
    m = rounded / 10
    e = e + 1
  }
  const expSign = e < 0 ? '-' : '+'
  const expStr = String(Math.abs(e)).padStart(2, '0')
  return `${sign}${m.toFixed(digits)} e${expSign}${expStr}`
}

function withThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Parse a string the user has been keying in. Returns NaN when the buffer
 * is empty, '-' alone, or otherwise unparseable.
 */
export function parseEntry(entry: string): number {
  if (entry === '' || entry === '-' || entry === '.') return 0
  // Support EEX entries written as "1.5e3" or "1.5e-3".
  const n = Number(entry)
  return Number.isFinite(n) ? n : NaN
}
