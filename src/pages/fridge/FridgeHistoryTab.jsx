import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useFridgeMatrix } from '../../hooks/useFridgeLogs'
import { readingOutOfRange } from '../../lib/utils'
import TempHistoryView, { historyDateFrom, buildClosedDateSet } from '../../components/temperature/TempHistoryView'
import FridgeBackfillModal from './FridgeBackfillModal'
import LoadError from '../../components/ui/LoadError'

const EXPLAINED = ['delivery', 'defrost', 'service_access']

function readingStatus(log, fridge) {
  if (!readingOutOfRange(log, fridge)) return 'ok'
  return EXPLAINED.includes(log.exceedance_reason) ? 'explained' : 'bad'
}

export default function FridgeHistoryTab({ canLog }) {
  const [range, setRange] = useState(7)
  const [backfill, setBackfill] = useState(null)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const dateFrom = historyDateFrom(range)

  const { fridges, matrix, loading, failed, reload } = useFridgeMatrix(dateFrom, todayStr)
  const { closedDays } = useAppSettings()
  const { closures }   = useVenueClosures()

  const closedSet = useMemo(
    () => buildClosedDateSet({ dateFrom, dateTo: todayStr, closedDays, closures }),
    [dateFrom, todayStr, closedDays, closures]
  )

  // A failed read would otherwise show "No fridges set up yet" (or a history
  // with every check missed).
  if (failed) return <LoadError what="the fridge history" onRetry={reload} />

  return (
    <>
      <TempHistoryView
        items={fridges}
        matrix={matrix}
        loading={loading}
        range={range}
        onRange={setRange}
        closedSet={closedSet}
        statusOf={readingStatus}
        emptyText="No fridges set up yet."
        renderMissed={canLog ? (fridge, dateStr, period, cls) => (
          <button
            type="button"
            onClick={() => setBackfill({ fridge, dateStr, period })}
            className={`${cls} hover:brightness-95 transition`}
            title="Missed — tap to record it"
          >
            + Add
          </button>
        ) : undefined}
      />

      <FridgeBackfillModal
        open={!!backfill}
        onClose={() => setBackfill(null)}
        fridge={backfill?.fridge}
        dateStr={backfill?.dateStr}
        period={backfill?.period}
        onSaved={reload}
      />
    </>
  )
}
