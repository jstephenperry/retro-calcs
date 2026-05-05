# retro-calcs

Faithful, fully-functional reproductions of classic HP calculators in the
browser. Built with React + TypeScript + Vite.

This repository starts with the **HP 12C**, the iconic RPN financial
calculator. The 12C package is intended to serve as a structural reference
for the rest of the lineup (HP 15C, HP 35S, …): each calculator is a small
package consisting of a pure engine (state machine + math) and a React
component that renders the original face.

## HP 12C

The HP 12C package lives at `src/calculators/hp12c/` and is organized as:

```
hp12c/
  engine/
    stack.ts      - 4-level RPN stack helpers (lift, drop, swap, …)
    display.ts    - FIX/SCI formatting and entry-buffer parsing
    tvm.ts        - Time-value-of-money solver (n, i, PV, PMT, FV)
    engine.ts     - Reducer-shaped state machine for the whole calculator
    types.ts      - Shared types
  keys.ts         - Faithful key-layout description (rows, labels, actions)
  HP12C.tsx       - The React calculator face
  Display.tsx     - The LCD display + annunciators
  Key.tsx         - One physical key with f/g/primary labels
  HP12C.css       - Visual styling that matches the original face
```

The engine is pure, so tests drive it without rendering. The UI is purely
declarative on top of `keys.ts` + the engine reducer.

### Implemented

* RPN four-level stack with correct lift/drop discipline and LASTX
* Number entry with `.`, `CHS`, `EEX`
* `+ − × ÷`, `1/x`, `√x` (via `g`-shifted `y^x` mapping), `y^x`, `LN`, `e^x`
* `%`, `Δ%`, `%T`
* TVM solver for any of `n`, `i`, `PV`, `PMT`, `FV` (with BEGIN/END mode)
* `STO` / `RCL` against 20 numbered registers
* `FIX` / `SCI` display modes with thousands separators
* `f` and `g` shift keys with on-screen annunciators

## Getting started

```sh
npm install
npm run dev      # vite dev server on http://localhost:5173
npm test         # full test suite (engine + UI)
npm run build    # production build (tsc -b && vite build)
npm run lint     # eslint
```

## Tests

* **Engine** unit tests live next to each engine module under `__tests__/`:
  `stack.test.ts`, `display.test.ts`, `tvm.test.ts`, `engine.test.ts`.
* **UI** tests use Vitest + jsdom + React Testing Library:
  `src/calculators/hp12c/__tests__/HP12C.test.tsx` exercises rendering,
  key presses, the f/g shift state machine, and a full mortgage workflow.
