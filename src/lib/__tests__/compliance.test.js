import { describe, it, expect } from 'vitest'
import {
  computeComplianceScore,
  deriveComplianceIssues,
  getScoreTier,
  COMPLIANCE_CATEGORIES,
} from '../compliance'

/** A venue with nothing wrong and records in every category. */
const clean = {
  tempTotal: 100, tempFails: 0, tempPassRate: 100,
  deliveryTotal: 10, deliveryFails: 0,
  probeTotal: 5, probeFails: 0,
  caOpen: 0, caCritical: 0,
  expiredCerts: 0,
}

describe('computeComplianceScore', () => {
  it('gives a spotless venue 100%', () => {
    expect(computeComplianceScore(clean).score).toBe(100)
  })

  it('never exceeds 100 or drops below 0', () => {
    const worst = {
      tempTotal: 10, tempFails: 10, tempPassRate: 0,
      deliveryTotal: 10, deliveryFails: 99,
      probeTotal: 10, probeFails: 99,
      caOpen: 99, caCritical: 5,
      expiredCerts: 99,
    }
    const { score } = computeComplianceScore(worst)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('degrades proportionally — more failures cost more', () => {
    const one  = computeComplianceScore({ ...clean, deliveryFails: 1 }).score
    const two  = computeComplianceScore({ ...clean, deliveryFails: 2 }).score
    expect(one).toBeLessThan(100)
    expect(two).toBeLessThan(one)
  })

  it('collapses the actions category on any critical action', () => {
    const critical = computeComplianceScore({ ...clean, caOpen: 1, caCritical: 1 })
    const minor    = computeComplianceScore({ ...clean, caOpen: 1, caCritical: 0 })
    expect(critical.score).toBeLessThan(minor.score)
    expect(critical.breakdown.find(b => b.key === 'actions').earned).toBe(5)
  })

  // The bug this module exists to fix: resolving something must win points back.
  describe('only unresolved issues affect the score', () => {
    it('recovers fully when the last failure is resolved', () => {
      const withIssue = computeComplianceScore({ ...clean, deliveryFails: 2 }).score
      const resolved  = computeComplianceScore({ ...clean, deliveryFails: 0 }).score
      expect(withIssue).toBeLessThan(100)
      expect(resolved).toBe(100)
    })

    it('recovers partially when one of several is resolved', () => {
      const three = computeComplianceScore({ ...clean, expiredCerts: 3 }).score
      const two   = computeComplianceScore({ ...clean, expiredCerts: 2 }).score
      expect(two).toBeGreaterThan(three)
    })

    it('lifts the temperature category as readings are resolved', () => {
      const bad  = computeComplianceScore({ ...clean, tempFails: 20, tempPassRate: 80 }).score
      const good = computeComplianceScore({ ...clean, tempFails: 5, tempPassRate: 95 }).score
      expect(good).toBeGreaterThan(bad)
    })
  })

  // The 90-vs-100 discrepancy: no records must not be an unrecoverable penalty.
  describe('no data is not treated as failure', () => {
    it('does not zero a category that has no records', () => {
      const noDeliveries = computeComplianceScore({ ...clean, deliveryTotal: 0, deliveryFails: 0 })
      const earned = noDeliveries.breakdown.find(b => b.key === 'deliveries').earned
      expect(earned).toBe(COMPLIANCE_CATEGORIES.deliveries.noData)
      expect(earned).toBeGreaterThan(0)
    })

    it('scores an empty venue well above zero', () => {
      const empty = computeComplianceScore({
        tempTotal: 0, tempFails: 0, tempPassRate: 100,
        deliveryTotal: 0, deliveryFails: 0,
        probeTotal: 0, probeFails: 0,
        caOpen: 0, caCritical: 0, expiredCerts: 0,
      })
      expect(empty.score).toBeGreaterThanOrEqual(80)
    })

    it('never scores a no-data category worse than a failing one', () => {
      const noData  = computeComplianceScore({ ...clean, probeTotal: 0, probeFails: 0 }).score
      const failing = computeComplianceScore({ ...clean, probeTotal: 3, probeFails: 3 }).score
      expect(noData).toBeGreaterThan(failing)
    })
  })
})

describe('deriveComplianceIssues', () => {
  it('reports nothing for a clean venue', () => {
    expect(deriveComplianceIssues(clean)).toEqual([])
  })

  // Guards the "All checks on track next to 90%" contradiction: anything that
  // costs points must be listed, and anything listed must cost points.
  it('lists an issue whenever the score is below 100', () => {
    const cases = [
      { ...clean, deliveryFails: 1 },
      { ...clean, probeFails: 1 },
      { ...clean, expiredCerts: 1 },
      { ...clean, caOpen: 1 },
      { ...clean, caOpen: 1, caCritical: 1 },
      { ...clean, tempFails: 5, tempPassRate: 95 },
    ]
    for (const m of cases) {
      expect(computeComplianceScore(m).score).toBeLessThan(100)
      expect(deriveComplianceIssues(m).length).toBeGreaterThan(0)
    }
  })

  it('stays silent when a category simply has no records', () => {
    const m = { ...clean, deliveryTotal: 0, deliveryFails: 0, probeTotal: 0, probeFails: 0 }
    expect(deriveComplianceIssues(m)).toEqual([])
  })

  it('reports a critical action as bad, a plain one as a warning', () => {
    const crit = deriveComplianceIssues({ ...clean, caOpen: 2, caCritical: 1 })
    expect(crit.find(i => i.key === 'actions').severity).toBe('bad')
    const open = deriveComplianceIssues({ ...clean, caOpen: 2, caCritical: 0 })
    expect(open.find(i => i.key === 'actions').severity).toBe('warning')
  })
})

describe('getScoreTier', () => {
  it('maps scores to the expected bands', () => {
    expect(getScoreTier(100).status).toBe('good')
    expect(getScoreTier(90).status).toBe('good')
    expect(getScoreTier(80).status).toBe('good')
    expect(getScoreTier(65).status).toBe('warning')
    expect(getScoreTier(10).status).toBe('bad')
  })
})
