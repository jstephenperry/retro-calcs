import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HP12C } from '../HP12C'

const press = async (user: ReturnType<typeof userEvent.setup>, ...ids: string[]) => {
  for (const id of ids) {
    await user.click(screen.getByTestId(`key-${id}`))
  }
}

const displayText = () => screen.getByTestId('hp12c-display-text').textContent

describe('HP 12C UI', () => {
  test('renders the calculator face with all 39 keys', () => {
    render(<HP12C />)
    // Critical structural keys.
    expect(screen.getByTestId('key-ENTER')).toBeInTheDocument()
    expect(screen.getByTestId('key-f')).toBeInTheDocument()
    expect(screen.getByTestId('key-g')).toBeInTheDocument()
    expect(screen.getByTestId('key-PMT')).toBeInTheDocument()
    // The HP 12C has 37 physical button positions (ENTER is double-wide).
    const keys = document.querySelectorAll('[data-key-id]')
    expect(keys.length).toBe(37)
  })

  test('initial display shows 0.00 in FIX 2', () => {
    render(<HP12C />)
    expect(displayText()).toBe('0.00')
  })

  test('typing 1 2 3 . 4 5 shows the live entry buffer', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D1', 'D2', 'D3', 'dot', 'D4', 'D5')
    expect(displayText()).toBe('123.45')
  })

  test('3 ENTER 5 + → 8.00', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'ENTER', 'D5', 'add')
    expect(displayText()).toBe('8.00')
  })

  test('CHS toggles the sign during entry', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D4', 'D2', 'CHS')
    expect(displayText()).toBe('-42')
  })

  test('CLx zeroes the display without affecting the rest of the stack', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    // 7 ENTER 9 puts X=9, Y=7. CLx should show 0.00 but keep Y=7.
    await press(user, 'D7', 'ENTER', 'D9', 'CLx')
    expect(displayText()).toBe('0.00')
    // x<>y should now bring Y (=7) to the display.
    await press(user, 'Rdown') // R↓ rotates: x->t, y->x
    expect(displayText()).toBe('7.00')
  })

  test('f-shift then a digit sets FIX precision', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    // Show 1.234567 in FIX 4.
    await press(user, 'f', 'D4')
    await press(user, 'D1', 'dot', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'ENTER')
    expect(displayText()).toBe('1.2346')
  })

  test('shift annunciator turns on after pressing f and back off after consuming', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    const annunciator = () => {
      const span = document.querySelector('.hp12c-display__annunciators span:nth-child(2)')
      if (!span) throw new Error('f annunciator not found')
      return span
    }
    await press(user, 'f')
    expect(annunciator()).toHaveClass('on')
    await press(user, 'D5') // f + 5 = FIX 5; consumes shift
    expect(annunciator()).not.toHaveClass('on')
  })

  test('STO 5 then RCL 5 round-trips a value', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D4', 'D2', 'STO', 'D5', 'CLx', 'RCL', 'D5')
    expect(displayText()).toBe('42.00')
  })

  test('full mortgage workflow computes PMT ≈ $1,199.10', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    // n = 360
    await press(user, 'D3', 'D6', 'D0', 'n')
    // i = 0.5 (half-percent per period)
    await press(user, 'dot', 'D5', 'i')
    // PV = -200000
    await press(user, 'D2', 'D0', 'D0', 'D0', 'D0', 'D0', 'CHS', 'PV')
    // Solve PMT via g + PMT
    await press(user, 'g', 'PMT')
    expect(displayText()).toBe('1,199.10')
  })

  test('"30 g 12×" produces 360.00 (years → months convenience)', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'D0', 'g', 'n')
    expect(displayText()).toBe('360.00')
  })

  test('"6 g 12÷" produces 0.50 (APR → periodic rate convenience)', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D6', 'g', 'i')
    expect(displayText()).toBe('0.50')
  })

  test('full mortgage via the keypad: 30 g 12× / 4.25 g 12÷ / 325000 PV / 0 FV / PMT', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'D0', 'g', 'n')           // n = 360
    await press(user, 'D4', 'dot', 'D2', 'D5', 'g', 'i') // i ≈ 0.354
    await press(user, 'D3', 'D2', 'D5', 'D0', 'D0', 'D0', 'PV') // PV = 325,000
    await press(user, 'D0', 'FV')                      // FV = 0
    await press(user, 'PMT')                           // solves PMT
    expect(displayText()).toBe('-1,598.80')
  })

  test('division by zero shows Error 0', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D1', 'ENTER', 'D0', 'div')
    expect(displayText()).toBe('Error 0')
  })
})

// Every entry-point a real HP 12C user actually reaches for, exercised
// end-to-end through the keypad. Each test mirrors a canonical scenario:
// loan PMT, savings goal, given-PMT solve-i, savings FV, max loan PV,
// BEGIN-mode lease, plus the supporting hot keys (CLEAR FIN, RCL TVM,
// CLEAR PREFIX, mode toggles).
describe('HP 12C TVM hot paths via the keypad', () => {
  test('A. solve PMT — 30-yr mortgage at $325k, 4.25% APR → -1,598.80', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'D0', 'g', 'n')                       // 30 g 12× → n=360
    await press(user, 'D4', 'dot', 'D2', 'D5', 'g', 'i')          // 4.25 g 12÷ → i
    await press(user, 'D3', 'D2', 'D5', 'D0', 'D0', 'D0', 'PV')   // 325000 PV
    await press(user, 'D0', 'FV')                                  // 0 FV
    await press(user, 'PMT')                                       // solve PMT
    expect(displayText()).toBe('-1,598.80')
  })

  test('B. solve N — months of $-100/period at 0.5% to reach $50k → 252', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D1', 'D0', 'D0', 'CHS', 'PMT')              // -100 PMT
    await press(user, 'dot', 'D5', 'i')                            // 0.5 i
    await press(user, 'D5', 'D0', 'D0', 'D0', 'D0', 'FV')          // 50000 FV
    await press(user, 'D0', 'PV')                                   // 0 PV
    await press(user, 'n')                                          // solve n
    // n is rounded UP on the real HP 12C since periods are integers.
    expect(displayText()).toBe('252.00')
  })

  test('C. solve i — $10k loan, 60 months of $-200 → 0.62% per period', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D6', 'D0', 'n')                              // 60 n
    await press(user, 'D1', 'D0', 'D0', 'D0', 'D0', 'PV')           // 10000 PV
    await press(user, 'D2', 'D0', 'D0', 'CHS', 'PMT')               // -200 PMT
    await press(user, 'D0', 'FV')                                   // 0 FV
    await press(user, 'i')                                          // solve i
    expect(displayText()).toBe('0.62')
  })

  test('D. solve FV — $-100/month for 360 months at 0.5% → $100,451.50', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'D6', 'D0', 'n')                        // 360 n
    await press(user, 'dot', 'D5', 'i')                             // 0.5 i
    await press(user, 'D0', 'PV')                                   // 0 PV
    await press(user, 'D1', 'D0', 'D0', 'CHS', 'PMT')               // -100 PMT
    await press(user, 'FV')                                         // solve FV
    expect(displayText()).toBe('100,451.50')
  })

  test('E. solve PV — 240 months of $1,500 PMT at 0.5% → -$209,371.16', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D2', 'D4', 'D0', 'n')                        // 240 n
    await press(user, 'dot', 'D5', 'i')                             // 0.5 i
    await press(user, 'D1', 'D5', 'D0', 'D0', 'PMT')                // 1500 PMT
    await press(user, 'D0', 'FV')                                    // 0 FV
    await press(user, 'PV')                                          // solve PV
    expect(displayText()).toBe('-209,371.16')
  })

  test('F. BEGIN-mode lease — $30k cap, 4% APR, $15k residual, 36mo → -$491.22', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'g', 'D7')                                     // g BEG
    await press(user, 'D3', 'D6', 'n')                               // 36 n
    await press(user, 'D4', 'g', 'i')                                // 4 g 12÷ → i
    await press(user, 'D3', 'D0', 'D0', 'D0', 'D0', 'PV')            // 30000 PV
    await press(user, 'D1', 'D5', 'D0', 'D0', 'D0', 'CHS', 'FV')     // -15000 FV
    await press(user, 'PMT')                                         // solve PMT
    expect(displayText()).toBe('-491.22')
  })

  test('g BEG turns the BEGIN annunciator on; g END turns it off', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    const beginAnnunciator = () => {
      const span = document.querySelector('.hp12c-display__annunciators span:first-child')
      if (!span) throw new Error('BEGIN annunciator not found')
      return span
    }
    expect(beginAnnunciator()).not.toHaveClass('on')
    await press(user, 'g', 'D7')
    expect(beginAnnunciator()).toHaveClass('on')
    await press(user, 'g', 'D8')
    expect(beginAnnunciator()).not.toHaveClass('on')
  })

  test('f CLEAR FIN (f x↔y) zeroes all five financial registers', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    // Set up arbitrary TVM values.
    await press(user, 'D3', 'D6', 'D0', 'n')
    await press(user, 'dot', 'D5', 'i')
    await press(user, 'D1', 'D0', 'D0', 'D0', 'D0', 'D0', 'PV')
    // Now wipe.
    await press(user, 'f', 'swap')
    // Recall each register; all should read 0.00.
    await press(user, 'RCL', 'n');   expect(displayText()).toBe('0.00')
    await press(user, 'RCL', 'i');   expect(displayText()).toBe('0.00')
    await press(user, 'RCL', 'PV');  expect(displayText()).toBe('0.00')
    await press(user, 'RCL', 'PMT'); expect(displayText()).toBe('0.00')
    await press(user, 'RCL', 'FV');  expect(displayText()).toBe('0.00')
  })

  test('RCL n, RCL i, RCL PV, RCL PMT, RCL FV inspect stored values without altering them', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D3', 'D6', 'D0', 'n')         // store 360 in n
    await press(user, 'dot', 'D5', 'i')              // store 0.5 in i
    await press(user, 'CLx')                          // wipe display
    await press(user, 'RCL', 'n')
    expect(displayText()).toBe('360.00')
    await press(user, 'RCL', 'i')
    expect(displayText()).toBe('0.50')
    // Pressing PMT after RCL must not solve — there's a fresh value in X.
    await press(user, 'D1', 'D0', 'D0', 'PMT')       // 100 PMT (store)
    await press(user, 'RCL', 'PMT')
    expect(displayText()).toBe('100.00')
  })

  test('f CLEAR PREFIX (f CLx) cancels a pending shift without zeroing X', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D4', 'D2')                    // X = 42
    await press(user, 'f')                            // shift = f
    await press(user, 'CLx')                          // f CLx → cancel prefix
    // X must still be 42, not 0.
    await press(user, 'ENTER')                        // commit
    expect(displayText()).toBe('42.00')
  })

  test('STO PMT stores X into the PMT register', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D5', 'D0', 'D0', 'STO', 'PMT')
    await press(user, 'CLx')
    await press(user, 'RCL', 'PMT')
    expect(displayText()).toBe('500.00')
  })
})
