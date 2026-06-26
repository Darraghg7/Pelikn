/**
 * EmployeeRecordPage.jsx — Full-page employee record for direct URL access (/hr/:staffId).
 * Thin wrapper around EmployeeRecordPanel; handles back-navigation and tab state.
 */
import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import EmployeeRecordPanel from './EmployeeRecordPanel'

export default function EmployeeRecordPage() {
  const { staffId }            = useParams()
  const { venueId, venueSlug } = useVenue()
  const [tab, setTab]          = useState('Profile')

  return (
    <div className="pb-24">
      <EmployeeRecordPanel
        staffId={staffId}
        venueId={venueId}
        venueSlug={venueSlug}
        onBack={null}
        tab={tab}
        setTab={setTab}
      />
    </div>
  )
}
