/**
 * compliance — the single source of truth for the venue compliance score.
 *
 * This used to be computed twice, differently:
 *   • ComplianceScoreWidget started at 100 and subtracted fixed penalties over
 *     a hardcoded 30 days, and included cooling logs and pest control.
 *   • EHOAuditPage awarded weighted points out of 100 over a selectable range
 *     defaulting to 90 days, and ignored cooling and pest.
 * They disagreed by design — a real venue showed 90% on the dashboard and 100%
 * on the page you land on when you click it.
 *
 * The weighted model below is the one that survived, because it is the number
 * shown on the EHO-facing page and it degrades proportionally (three failed
 * deliveries should not cost the same as one).
 *
 * Two rules matter and are easy to break again:
 *
 *  1. ONLY UNRESOLVED ISSUES COUNT. Every caller must exclude records marked
 *     resolved before deriving these metrics — `is_resolved` on fridge logs,
 *     delivery checks, probe calibrations and training, and `status = 'open'`
 *     on corrective actions. Resolving something must move the score back up.
 *
 *  2. NO DATA IS NOT A FAILURE. A category with no records earns most of its
 *     points rather than losing them. A venue that took no deliveries this
 *     month is not non-compliant, and the old widget's silent −5 for "no
 *     deliveries logged" was unrecoverable: no manager action could win those
 *     points back, and it was never shown as an issue.
 */

/** Weight of each category, and what it scores when the venue has no records. */
export const COMPLIANCE_CATEGORIES = {
  temps:      { weight: 30, noData: 25, label: 'Temperature logs' },
  deliveries: { weight: 20, noData: 15, label: 'Delivery checks' },
  actions:    { weight: 20, noData: 20, label: 'Corrective actions' },
  training:   { weight: 15, noData: 15, label: 'Staff training' },
  probes:     { weight: 15, noData: 10, label: 'Probe calibration' },
}

/**
 * @param {object} m — metrics derived from UNRESOLVED records only.
 * @param {number} m.tempTotal      total temperature readings in range
 * @param {number} m.tempPassRate   0-100, share of readings within range
 * @param {number} m.deliveryTotal  total delivery checks in range
 * @param {number} m.deliveryFails  unresolved failed deliveries
 * @param {number} m.caOpen         open corrective actions
 * @param {number} m.caCritical     open corrective actions at critical severity
 * @param {number} m.expiredCerts   unresolved expired training certificates
 * @param {number} m.probeTotal     total probe calibrations in range
 * @param {number} m.probeFails     unresolved failed calibrations
 * @returns {{score:number, points:number, max:number, breakdown:object[]}}
 */
export function computeComplianceScore(m) {
  const C = COMPLIANCE_CATEGORIES
  const clamp = (n, hi) => Math.max(0, Math.min(hi, n))

  const earned = {
    temps: m.tempTotal > 0
      ? (m.tempPassRate / 100) * C.temps.weight
      : C.temps.noData,

    deliveries: m.deliveryTotal > 0
      ? clamp(C.deliveries.weight - m.deliveryFails * 4, C.deliveries.weight)
      : C.deliveries.noData,

    // Any critical action collapses this category regardless of the total —
    // one critical failure is not a proportional problem.
    actions: m.caCritical > 0
      ? 5
      : clamp(C.actions.weight - m.caOpen * 3, C.actions.weight),

    training: clamp(C.training.weight - m.expiredCerts * 3, C.training.weight),

    probes: m.probeTotal > 0
      ? clamp(C.probes.weight - m.probeFails * 4, C.probes.weight)
      : C.probes.noData,
  }

  const points = Object.values(earned).reduce((a, b) => a + b, 0)
  const max    = Object.values(C).reduce((a, c) => a + c.weight, 0)

  return {
    score: Math.round((points / max) * 100),
    points,
    max,
    breakdown: Object.entries(earned).map(([key, got]) => ({
      key,
      label:  C[key].label,
      earned: got,
      weight: C[key].weight,
    })),
  }
}

/**
 * The issues a manager can actually act on, derived from the same metrics as
 * the score. Kept here so the widget's list and the score can never drift:
 * anything listed here costs points, and anything costing points is listed.
 */
export function deriveComplianceIssues(m) {
  const issues = []
  if (m.tempTotal > 0 && m.tempPassRate < 100) {
    issues.push({
      key: 'temps', label: 'Temperature logs', section: 'temps',
      detail: `${m.tempFails} out-of-range`,
      severity: m.tempPassRate < 95 ? 'bad' : 'warning',
    })
  }
  if (m.deliveryFails > 0) {
    issues.push({
      key: 'deliveries', label: 'Delivery checks', section: 'deliveries',
      detail: `${m.deliveryFails} failed`, severity: 'warning',
    })
  }
  if (m.probeFails > 0) {
    issues.push({
      key: 'probes', label: 'Probe calibration', section: 'probes',
      detail: `${m.probeFails} failed`, severity: 'warning',
    })
  }
  if (m.caCritical > 0) {
    issues.push({
      key: 'actions', label: 'Corrective actions', section: 'actions',
      detail: `${m.caCritical} critical open`, severity: 'bad',
    })
  } else if (m.caOpen > 0) {
    issues.push({
      key: 'actions', label: 'Corrective actions', section: 'actions',
      detail: `${m.caOpen} open`, severity: 'warning',
    })
  }
  if (m.expiredCerts > 0) {
    issues.push({
      key: 'training', label: 'Staff training', section: 'training',
      detail: `${m.expiredCerts} expired cert${m.expiredCerts !== 1 ? 's' : ''}`,
      severity: 'warning',
    })
  }
  return issues
}

/**
 * Lookback window for the score, in days.
 *
 * The widget and the audit page MUST use the same window or they will disagree
 * again even with identical maths — a 30-day widget and a 90-day page was half
 * the reason the two numbers differed. This is the audit page's default range;
 * if a manager picks a different range there, that page intentionally shows a
 * different number, but the two agree on landing.
 */
export const COMPLIANCE_RANGE_DAYS = 90

export const SCORE_TIERS = [
  { min: 90, label: 'Excellent',         color: '#15803d', status: 'good'    },
  { min: 75, label: 'Good',              color: '#16a34a', status: 'good'    },
  { min: 60, label: 'Needs Improvement', color: '#d97706', status: 'warning' },
  { min: 0,  label: 'Poor',              color: '#dc2626', status: 'bad'     },
]

export function getScoreTier(score) {
  return SCORE_TIERS.find(t => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}
