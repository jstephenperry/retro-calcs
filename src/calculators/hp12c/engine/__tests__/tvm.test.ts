import { describe, expect, test } from 'vitest'
import { solveFV, solveI, solveN, solvePMT, solvePV, tvmResidual } from '../tvm'

const close = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol)
}

describe('time value of money', () => {
  test('FV of a 30-year mortgage at the computed PMT is ~0', () => {
    // 200,000 loan @ 6% APR (0.5% per period) over 360 periods. Solving for
    // PMT first, then plugging it back in must return us to FV ≈ 0.
    const pmt = solvePMT({ n: 360, i: 0.5, pv: -200000, fv: 0, mode: 0 })
    close(pmt, 1199.10, 0.01)
    const fv = solveFV({ n: 360, i: 0.5, pv: -200000, pmt, mode: 0 })
    close(fv, 0, 1e-6)
  })

  test('PV of a $1000/year, 10-year, 5% annuity matches the HP 12C answer', () => {
    const pv = solvePV({ n: 10, i: 5, pmt: 1000, fv: 0, mode: 0 })
    close(pv, -7721.7349, 1e-3)
  })

  test('FV of $100/month at 6% APR for 30 years is ~$100,451.50', () => {
    const fv = solveFV({ n: 360, i: 0.5, pv: 0, pmt: -100, mode: 0 })
    close(fv, 100451.5042, 0.01)
  })

  test('solveI inverts solveFV for a lump-sum problem', () => {
    // 10,000 at 0.83333% per period for 60 periods grows to ~16,453.09.
    // Solving for the rate must round-trip to 0.83333%.
    const fv = solveFV({ n: 60, i: 0.83333333, pv: -10000, pmt: 0, mode: 0 })
    const i = solveI({ n: 60, pv: -10000, pmt: 0, fv, mode: 0 })
    close(i, 0.83333333, 1e-6)
  })

  test('solveI on an annuity has a (near) zero residual at the answer', () => {
    const inputs = { n: 60, pv: 10000, pmt: -200, fv: 0, mode: 0 as const }
    const i = solveI(inputs)
    // Residual at the converged rate must be tiny — that's the real test.
    const r = i / 100
    expect(Math.abs(tvmResidual({ ...inputs, i }, r))).toBeLessThan(1e-6)
    // Sanity-check: rate is positive and < 1% per period.
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(1)
  })

  test('solveN: time to a savings goal', () => {
    const n = solveN({ i: 0.5, pv: 0, pmt: -100, fv: 100451.5042, mode: 0 })
    close(n, 360, 1e-3)
  })

  test('BEGIN mode shifts the annuity by one period', () => {
    const end   = solveFV({ n: 12, i: 1, pv: 0, pmt: -100, mode: 0 })
    const begin = solveFV({ n: 12, i: 1, pv: 0, pmt: -100, mode: 1 })
    // BEGIN-mode FV is exactly END-mode FV * (1 + i).
    close(begin, end * 1.01, 1e-6)
  })

  test('zero-rate edge case: total = pv + n*pmt + fv', () => {
    expect(solveFV({ n: 10, i: 0, pv: -1000, pmt: -100, mode: 0 })).toBeCloseTo(2000, 6)
    expect(solvePV({ n: 10, i: 0, pmt: -100, fv: 2000, mode: 0 })).toBeCloseTo(-1000, 6)
  })
})
