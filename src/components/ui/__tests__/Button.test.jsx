import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Button from '../Button'

describe('Button', () => {
  it('is type="button" by default, so it never submits a form by accident', () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    render(<form onSubmit={onSubmit}><Button>Add row</Button></form>)
    const btn = screen.getByRole('button', { name: 'Add row' })
    expect(btn.getAttribute('type')).toBe('button')
    fireEvent.click(btn)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits when asked to', () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    render(<form onSubmit={onSubmit}><Button type="submit">Save</Button></form>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('loading disables the button and marks it busy, so a second tap does nothing', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Clock in</Button>)
    const btn = /** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Clock in' }))
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('passes disabled and click handlers through', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<Button onClick={onClick} disabled>Go</Button>)
    expect(/** @type {HTMLButtonElement} */ (screen.getByRole('button', { name: 'Go' })).disabled).toBe(true)
  })

  it('icon-only buttons are named by aria-label', () => {
    render(<Button iconOnly aria-label="Close"><svg /></Button>)
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('renders a router link with `to` and a plain link with `href`', () => {
    render(
      <MemoryRouter>
        <Button to="/settings">Settings</Button>
        <Button href="https://example.test" variant="link">Help</Button>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings')
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe('https://example.test')
  })
})
