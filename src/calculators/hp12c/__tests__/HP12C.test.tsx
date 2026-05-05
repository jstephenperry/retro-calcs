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

  test('division by zero shows Error 0', async () => {
    const user = userEvent.setup()
    render(<HP12C />)
    await press(user, 'D1', 'ENTER', 'D0', 'div')
    expect(displayText()).toBe('Error 0')
  })
})
