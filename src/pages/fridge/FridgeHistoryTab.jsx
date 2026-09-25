import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAppSettings } from '../../hooks/useSettings'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useFridgeMatrix } from '../../hooks/useFridgeLogs'
import { isTempOutOfRange } from '../../lib/utils'
import TempHistoryView, { historyDateFrom, buildClosedDateSet } from '../../components/temperature/TempHistoryView'
import FridgeBackfillModal from './FridgeBackfillModal'

const EXPLAINED = ['delivery', 'defrost', 'service_access']

function readingStatus(log, fridge) {
  if (!isTempOutOfRange(log.temperature, fridge.min_temp, fridge.max_temp)) return 'ok'
  return EXPLAINED.includes(log.exceedance_reason) ? 'explained' : 'bad'
}

export default function FridgeHistoryTab({ canLog }) {
  const [range, setRange] = useState(7)
  const [backfill, setBackfill] = useState(null)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const dateFrom = historyDateFrom(range)

  const { fridges, matrix, loading, reload } = useFridgeMatrix(dateFrom, todayStr)
  const { closedDays } = useAppSettings()
  const { closures }   = useVenueClosures()

  const closedSet = useMemo(
    () => buildClosedDateSet({ dateFrom, dateTo: todayStr, closedDays, closures }),
    [dateFrom, todayStr, closedDays, closures]
  )

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
