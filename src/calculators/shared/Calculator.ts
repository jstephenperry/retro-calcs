// Shared interface for HP-style calculators in this repo.
//
// Each calculator package (hp12c, future hp15c, hp35s, …) is expected to
// export a `CalculatorPackage` so the host application can register and
// route between them uniformly. Engines remain calculator-specific, but
// the public surface — initial state, reducer, key layout, display
// formatter — is the same shape.

export interface CalculatorPackage<State, Action, KeyDef> {
  readonly id: string
  readonly displayName: string
  readonly initialState: State
  readonly reduce: (state: State, action: Action) => State
  readonly rows: KeyDef[][]
}
