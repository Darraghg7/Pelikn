import React from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center gap-4">
      <p className="text-6xl">404</p>
      <p className="text-charcoal/50">Page not found</p>
      <Link to="/fridge"><Button variant="secondary">Go home</Button></Link>
    </div>
  )
}
