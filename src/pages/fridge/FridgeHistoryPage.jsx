import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFridges, useFridgeHistory } from '../../hooks/useFridgeLogs'
import { isTempOutOfRange, formatTemp, formatDateTime } from '../../lib/utils'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

export default function FridgeHistoryPage() {
  const { fridges } = useFridges()
  const [fridgeId, setFridgeId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const { logs, loading } = useFridgeHistory(fridgeId || null, dateFrom || null, dateTo || null)

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center gap-4">
        <Link to="/fridge" className="text-charcoal/40 hover:text-charcoal transition-colors text-lg">←</Link>
        <h1 className="font-serif text-3xl text-charcoal">Temperature History</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Filters</SectionLabel>
        <div className="flex flex-wrap gap-3">
          <select
            value={fridgeId}
            onChange={(e) => setFridgeId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          >
            <option value="">All fridges</option>
            {fridges.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        <div className="px-5 pt-5">
          <SectionLabel>Readings</SectionLabel>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-charcoal/35 italic py-10 pb-8">
            No readings found. Try adjusting your filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-charcoal/8">
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Fridge</th>
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Temp</th>
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium hidden sm:table-cell">Logged by</th>
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-widest uppercase text-charcoal/40 font-medium">Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const min = log.fridges?.min_temp ?? 0
                  const max = log.fridges?.max_temp ?? 5
                  const oor = isTempOutOfRange(log.temperature, min, max)
                  return (
                    <tr key={log.id} className={['border-t border-charcoal/6', oor ? 'bg-danger/4' : ''].join(' ')}>
                      <td className="px-5 py-3 text-charcoal">{log.fridge_name}</td>
                      <td className={`px-5 py-3 font-mono font-semibold ${oor ? 'text-danger' : 'text-charcoal'}`}>
                        {formatTemp(log.temperature)}
                      </td>
                      <td className="px-5 py-3 text-charcoal/60 hidden sm:table-cell">{log.logged_by_name ?? '—'}</td>
                      <td className="px-5 py-3 text-charcoal/50 whitespace-nowrap">{formatDateTime(log.logged_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
