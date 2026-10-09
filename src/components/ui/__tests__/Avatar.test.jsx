import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Avatar, { avatarBaseColour } from '../Avatar'
import { staffColour } from '../../../lib/utils'

const ID = '3f2a9c10-1111-4222-8333-944455556666'

describe('Avatar', () => {
  it('shows initials, labelled with the name', () => {
    render(<Avatar name="Eve Turbitt" id={ID} />)
    const el = screen.getByRole('img', { name: 'Eve Turbitt' })
    expect(el.textContent).toBe('ET')
  })

  it('is hidden from screen readers when decorative', () => {
    const { container } = render(<Avatar name="Eve Turbitt" id={ID} decorative />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows the photo, and falls back to initials if it fails to load', () => {
    const { container } = render(<Avatar name="Eve Turbitt" id={ID} photoUrl="https://example.test/eve.jpg" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('img', { name: 'Eve Turbitt' }).textContent).toBe('ET')
  })

  it('tries again when the photo changes', () => {
    const { container, rerender } = render(<Avatar name="Eve" photoUrl="https://example.test/a.jpg" />)
    fireEvent.error(container.querySelector('img'))
    rerender(<Avatar name="Eve" photoUrl="https://example.test/b.jpg" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.test/b.jpg')
  })

  it('handles a missing name', () => {
    render(<Avatar name={null} />)
    expect(screen.getByRole('img', { name: 'Unknown person' }).textContent).toBe('?')
  })
})

describe('avatarBaseColour', () => {
  it('uses the saved rota colour first', () => {
    expect(avatarBaseColour({ id: ID, colour: '#ec4899', name: 'Eve' })).toBe('#ec4899')
  })

  it('matches the rota colour for people with no saved colour', () => {
    expect(avatarBaseColour({ id: ID, colour: null, name: 'Eve' })).toBe(staffColour({ id: ID }))
  })

  it('is stable for a name when there is no id', () => {
    const a = avatarBaseColour({ name: 'Eve Turbitt' })
    expect(avatarBaseColour({ name: 'Eve Turbitt' })).toBe(a)
  })

  it('ignores a malformed saved colour', () => {
    expect(avatarBaseColour({ id: ID, colour: 'red', name: 'Eve' })).toBe(staffColour({ id: ID }))
  })
})
