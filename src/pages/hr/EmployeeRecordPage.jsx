/**
 * EmployeeRecordPage.jsx — Full-page employee record for direct URL access (/hr/:staffId).
 * Thin wrapper around EmployeeRecordPanel; handles back-navigation and tab state.
 */
import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import EmployeeRecordPanel, { MF } from './EmployeeRecordPanel'

export default function EmployeeRecordPage() {
  const { staffId }            = useParams()
  const navigate               = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const [tab, setTab]          = useState('Profile')

  const back = () => navigate(`/v/${venueSlug}/hr`)

  return (
    <div style={{ fontFamily: MF, padding: '0 0 96px' }}>
      <EmployeeRecordPanel
        staffId={staffId}
        venueId={venueId}
        venueSlug={venueSlug}
        onBack={back}
        tab={tab}
        setTab={setTab}
      />
    </div>
  )
}
