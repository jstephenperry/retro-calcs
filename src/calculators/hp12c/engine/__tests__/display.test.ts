import { describe, expect, test } from 'vitest'
import { formatNumber, parseEntry } from '../display'

describe('display formatting', () => {
  test('FIX 2 renders typical values with thousands separators', () => {
    expect(formatNumber(1234.5, { kind: 'fix', digits: 2 })).toBe('1,234.50')
    expect(formatNumber(-0.1, { kind: 'fix', digits: 2 })).toBe('-0.10')
    expect(formatNumber(0, { kind: 'fix', digits: 2 })).toBe('0.00')
  })

  test('FIX 0 hides the decimal point', () => {
    expect(formatNumber(42, { kind: 'fix', digits: 0 })).toBe('42')
    expect(formatNumber(-1000000, { kind: 'fix', digits: 0 })).toBe('-1,000,000')
  })

  test('falls back to SCI when the magnitude exceeds the FIX range', () => {
    expect(formatNumber(1e12, { kind: 'fix', digits: 2 })).toMatch(/^1\.00 e\+12$/)
    expect(formatNumber(1e-9, { kind: 'fix', digits: 2 })).toMatch(/e-09$/)
  })

  test('SCI mode formats with a signed two-digit exponent', () => {
    expect(formatNumber(12345, { kind: 'sci', digits: 4 })).toBe('1.2345 e+04')
    expect(formatNumber(-0.0042, { kind: 'sci', digits: 2 })).toBe('-4.20 e-03')
  })

  test('handles Infinity / NaN with an Error message', () => {
    expect(formatNumber(Infinity, { kind: 'fix', digits: 2 })).toBe('Error 0')
    expect(formatNumber(NaN, { kind: 'fix', digits: 2 })).toBe('Error 0')
  })

  test('parseEntry handles partial buffers', () => {
    expect(parseEntry('')).toBe(0)
    expect(parseEntry('-')).toBe(0)
    expect(parseEntry('.')).toBe(0)
    expect(parseEntry('12.5')).toBe(12.5)
    expect(parseEntry('1.5e3')).toBe(1500)
    expect(parseEntry('1.5e-2')).toBe(0.015)
    expect(Number.isNaN(parseEntry('abc'))).toBe(true)
  })
})
