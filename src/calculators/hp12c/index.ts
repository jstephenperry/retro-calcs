import type { CalculatorPackage } from '../shared/Calculator'
import { INITIAL_STATE, reduce, type Action, type InternalState } from './engine/engine'
import { ROWS, type LayoutCell } from './keys'

export const hp12c: CalculatorPackage<InternalState, Action, LayoutCell> = {
  id: 'hp12c',
  displayName: 'HP 12C',
  initialState: INITIAL_STATE,
  reduce,
  rows: ROWS,
}

export { HP12C } from './HP12C'
