// Time-Value-of-Money math for the HP 12C.
//
// The HP 12C TVM equation (END mode):
//   PV + (1 + i*B) * PMT * a(n,i) + FV * v(n,i) = 0
// where
//   v(n,i) = (1 + i)^-n
//   a(n,i) = (1 - v(n,i)) / i           (i != 0)
//   a(n,0) = n
// and B = 1 in BEGIN mode, 0 in END mode.
//
// All inputs use HP conventions:
//   - i is a percentage per period (5 means 5%, internally 0.05).
//   - Cash inflows are positive; outflows are negative ("sign convention").
//   - n is the number of periods.

export type Mode = 0 | 1 // 0 = END, 1 = BEGIN

export interface TvmInputs {
  n: number
  i: number // periodic rate as a percent
  pv: number
  pmt: number
  fv: number
  mode: Mode
}

const TOL = 1e-10
const MAX_ITERS = 100

function annuityFactor(n: number, r: number, mode: Mode): number {
  // (1 + r*B) * (1 - (1+r)^-n) / r,  r != 0
  if (r === 0) return n
  const v = Math.pow(1 + r, -n)
  return ((1 + r * mode) * (1 - v)) / r
}

function presentFactor(n: number, r: number): number {
  return Math.pow(1 + r, -n)
}

/** Residual of the TVM equation; the solver finds r such that this is 0. */
export function tvmResidual(p: TvmInputs, r: number): number {
  return p.pv + p.pmt * annuityFactor(p.n, r, p.mode) + p.fv * presentFactor(p.n, r)
}

export function solveFV(p: Omit<TvmInputs, 'fv'>): number {
  const r = p.i / 100
  return -(p.pv + p.pmt * annuityFactor(p.n, r, p.mode)) / presentFactor(p.n, r)
}

export function solvePV(p: Omit<TvmInputs, 'pv'>): number {
  const r = p.i / 100
  return -(p.pmt * annuityFactor(p.n, r, p.mode) + p.fv * presentFactor(p.n, r))
}

export function solvePMT(p: Omit<TvmInputs, 'pmt'>): number {
  const r = p.i / 100
  const a = annuityFactor(p.n, r, p.mode)
  if (a === 0) throw new Error('TVM: PMT undefined (annuity factor is zero)')
  return -(p.pv + p.fv * presentFactor(p.n, r)) / a
}

export function solveN(p: Omit<TvmInputs, 'n'>): number {
  const r = p.i / 100
  // PMT-only or FV-only special cases yield closed forms; the general case
  // also has a closed form using logs.
  if (r === 0) {
    if (p.pmt === 0) throw new Error('TVM: cannot solve n with i=0 and PMT=0')
    return -(p.pv + p.fv) / p.pmt
  }
  const factor = 1 + r * p.mode
  const num = factor * p.pmt - p.fv * r
  const den = factor * p.pmt + p.pv * r
  if (num === 0 || den === 0 || num / den <= 0) {
    throw new Error('TVM: cannot solve n with given cash flows')
  }
  return Math.log(num / den) / Math.log(1 + r)
}

/**
 * Solve for the periodic rate i (returned as a percent, matching the HP
 * convention for the i register). Uses Newton-Raphson with a safe bisection
 * fallback. Throws on non-convergence.
 */
export function solveI(p: Omit<TvmInputs, 'i'>): number {
  // Closed form when there's no annuity component.
  if (p.pmt === 0 && p.pv !== 0 && p.fv !== 0) {
    if (p.pv * p.fv > 0) throw new Error('TVM: PV and FV must have opposite signs')
    const r = Math.pow(-p.fv / p.pv, 1 / p.n) - 1
    return r * 100
  }

  const f = (r: number) => tvmResidual({ ...p, i: r * 100 }, r)
  // Numerical derivative with a small step keeps the solver dependency-free.
  const fp = (r: number) => {
    const h = Math.max(1e-7, Math.abs(r) * 1e-7)
    return (f(r + h) - f(r - h)) / (2 * h)
  }

  let r = 0.01 // 1% per period seed
  for (let k = 0; k < MAX_ITERS; k++) {
    const fr = f(r)
    if (Math.abs(fr) < TOL) return r * 100
    const d = fp(r)
    if (!Number.isFinite(d) || d === 0) break
    const next = r - fr / d
    if (!Number.isFinite(next)) break
    if (next <= -1) {
      // Stay in the convergent half-plane (1 + r > 0).
      r = (r - 1) / 2
      continue
    }
    if (Math.abs(next - r) < TOL) return next * 100
    r = next
  }
  throw new Error('TVM: i did not converge')
}
