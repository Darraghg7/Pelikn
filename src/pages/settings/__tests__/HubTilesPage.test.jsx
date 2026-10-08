import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { ToastProvider } from '../../../components/ui/Toast'
import HubTilesPage from '../HubTilesPage'

// A failed save must show an error — the toggle flips back on its own, and
// without a message it just looks like the switch "didn't take".

const setExtra = vi.fn()

vi.mock('../../../contexts/VenueContext', () => ({
  useVenue: () => ({ venueId: 'v1', venueSlug: 'v', venuePlan: 'pro' }),
}))
vi.mock('../../../hooks/useSettings', () => ({
  useAppSettings: () => ({
    hiddenCheckTiles: [], hiddenTeamTiles: [], complianceNavOrder: [],
    saveHiddenCheckTiles: vi.fn(), saveHiddenTeamTiles: vi.fn(), saveComplianceNavOrder: vi.fn(),
  }),
}))
vi.mock('../../../hooks/useVenueFeatures', () => ({
  FEATURE_GROUPS: [], ALL_FEATURE_IDS: [], PRO_ONLY_FEATURE_IDS: [],
  useVenueFeatures: () => ({
    config: { mode: 'all', enabled: [] },
    save: vi.fn(() => Promise.resolve(null)),
    setExtra,
    isEnabled: () => true,
    isSwitchedOn: () => false,
    isPlanLocked: () => false,
  }),
}))
vi.mock('../NavOrderSection', () => ({ default: () => null }))
vi.mock('../VenueTypeIndicator', () => ({ default: () => null }))

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <HubTilesPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function toggleFor(label) {
  const row = screen.getByText(label, { selector: 'div.text-sm' }).closest('div.flex.items-center.gap-3')
  return row.querySelector('button[aria-pressed]')
}

describe('HubTilesPage — optional extras', () => {
  beforeEach(() => setExtra.mockReset())

  it('shows an error toast when switching an extra on fails to save', async () => {
    setExtra.mockResolvedValue(new Error('network down'))
    renderPage()
    fireEvent.click(toggleFor('Recall & Withdrawal'))
    expect(setExtra).toHaveBeenCalledWith('recall', true)
    expect(await screen.findByText(/Couldn't save that change/)).toBeInTheDocument()
  })

  it('stays quiet when the save works', async () => {
    setExtra.mockResolvedValue(null)
    renderPage()
    fireEvent.click(toggleFor('Recall & Withdrawal'))
    await waitFor(() => expect(setExtra).toHaveBeenCalled())
    expect(screen.queryByText(/Couldn't save that change/)).not.toBeInTheDocument()
  })
})
