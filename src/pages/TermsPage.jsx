import React from 'react'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '[PLACEHOLDER — set before launch]'
const CONTACT_EMAIL  = 'hello@get-pelikn.com'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-charcoal dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-charcoal/70 dark:text-white/60 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/8 dark:border-white/8 bg-white dark:bg-paperDark">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-bold tracking-tight text-charcoal dark:text-white">
            Pelikn
          </Link>
          <span className="text-xs text-charcoal/40 dark:text-white/35">Terms of Service</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-charcoal dark:text-white mb-1">Terms of Service</h1>
        <p className="text-xs text-charcoal/40 dark:text-white/35 mb-6">Effective date: {EFFECTIVE_DATE}</p>

        <div className="bg-warning/10 border border-warning/25 rounded-xl px-4 py-3 mb-10">
          <p className="text-xs text-warning font-semibold leading-relaxed">
            Placeholder — this page is a structural draft, not reviewed legal copy.
            Replace the sections below with terms drafted or approved by a solicitor
            before this link goes live for real customers.
          </p>
        </div>

        <Section title="Acceptance of terms">
          <p>
            [PLACEHOLDER] By creating an account or using Pelikn, you agree to these
            Terms of Service and our Privacy Policy. If you do not agree, do not use
            the service.
          </p>
        </Section>

        <Section title="The service">
          <p>
            [PLACEHOLDER] Describe what Pelikn provides (compliance logging, rota and
            staff management for hospitality venues), who it's for (venue managers and
            their staff), and that features vary by plan (Starter / Pro).
          </p>
        </Section>

        <Section title="Accounts and access">
          <p>
            [PLACEHOLDER] Venue managers are responsible for the accuracy of data
            entered, for staff PIN confidentiality, and for keeping venue and billing
            details up to date.
          </p>
        </Section>

        <Section title="Subscriptions and billing">
          <p>
            [PLACEHOLDER] Cover plan pricing, billing cycle, the free trial, what
            happens on cancellation, refund policy (if any), and how price changes are
            communicated. Cross-check against the actual pricing shown on the
            marketing page before publishing.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            [PLACEHOLDER] Standard prohibited-use clause — no unlawful use, no
            attempting to breach venue data isolation, no reverse engineering, etc.
          </p>
        </Section>

        <Section title="Data and compliance records">
          <p>
            [PLACEHOLDER] Clarify that compliance logs (temperature checks, cleaning
            records, etc.) are the venue's own records; Pelikn is a processor. Cross
            reference the <Link to="/privacy" className="text-brand underline">Privacy Policy</Link> for
            how data is handled.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            [PLACEHOLDER] Standard SaaS liability cap and disclaimer language — get
            this reviewed by a solicitor rather than drafted by hand. Pelikn is a tool
            to support compliance record-keeping; it does not replace a venue's legal
            responsibility to comply with food safety and employment law.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            [PLACEHOLDER] Cover cancellation by either party, what happens to data on
            account closure (align with the retention terms in the Privacy Policy).
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            [PLACEHOLDER] These terms are governed by the laws of England and Wales.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms from time to time. If we make material changes
            we will notify active users by email. The effective date at the top of
            this page will always reflect the latest version.
          </p>
        </Section>

        <div className="border-t border-charcoal/8 dark:border-white/8 pt-8 mt-8">
          <p className="text-xs text-charcoal/40 dark:text-white/35">
            Pelikn · <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
            {' '}· United Kingdom
          </p>
        </div>
      </main>
    </div>
  )
}
