import { HP12C } from './calculators/hp12c/HP12C'

export function App() {
  return (
    <div className="hp12c-stage">
      <h1>retro-calcs</h1>
      <HP12C />
      <p>
        A faithful HP 12C reference. RPN entry, four-level stack, full TVM
        solver. Press <kbd>f</kbd> or <kbd>g</kbd> for shifted functions.
      </p>
    </div>
  )
}

export default App
