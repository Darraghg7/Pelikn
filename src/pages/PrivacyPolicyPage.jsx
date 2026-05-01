import React from 'react'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '1 May 2026'
const CONTACT_EMAIL  = 'hello@pelikn.app'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-charcoal mb-3">{title}</h2>
      <div className="text-sm text-charcoal/70 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/8 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-bold tracking-tight text-charcoal">
            Pelikn
          </Link>
          <span className="text-xs text-charcoal/40">Privacy Policy</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-charcoal mb-1">Privacy Policy</h1>
        <p className="text-xs text-charcoal/40 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <Section title="Who we are">
          <p>
            Pelikn is a hospitality compliance and team management platform operated by Pelikn
            ("we", "us", "our"). We are based in the United Kingdom and this policy is written
            in accordance with UK GDPR and the Data Protection Act 2018.
          </p>
          <p>
            Questions about this policy or your data can be sent to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section title="What data we collect">
          <p>We collect the following categories of data when you use Pelikn:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-charcoal font-semibold">Account data</strong> — name and email
              address of venue managers who sign up.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Staff data</strong> — first name, an
              optional profile photo, and a 4-digit PIN for venue staff members. These are entered
              by the venue manager.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Venue data</strong> — venue name,
              type, and operational settings configured by the manager.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Compliance logs</strong> — temperature
              readings, delivery records, cleaning completions, corrective actions, and other food
              safety records entered by staff during their shift.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Fitness declarations</strong> —
              pre-shift wellness declarations (e.g. whether a staff member has symptoms that could
              affect food safety). These are recorded for regulatory compliance only and are not
              used for any other purpose.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Attendance and scheduling data</strong>{' '}
              — clock-in/out times, shift assignments, rota entries, time-off requests, and
              timesheet records (Pro plan only).
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Training records</strong> — staff
              training completions and certifications (Pro plan only).
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Device tokens</strong> — push
              notification tokens (APNs) if you grant notification permission on your device.
            </li>
          </ul>
          <p>
            We do not collect payment card details directly. Subscription payments are handled by
            our payment processor and subject to their privacy policy.
          </p>
        </Section>

        <Section title="How we use your data">
          <p>We use the data collected solely to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide and operate the Pelikn platform and its features.</li>
            <li>Generate compliance reports and audit exports on your request.</li>
            <li>Send operational notifications (e.g. time-off approvals, rota updates).</li>
            <li>Improve reliability and performance of the service.</li>
            <li>Respond to support enquiries.</li>
          </ul>
          <p>
            We do not sell your data, use it for advertising, or share it with third parties for
            their own marketing purposes.
          </p>
        </Section>

        <Section title="Legal basis for processing">
          <p>
            We process your data under the following lawful bases (UK GDPR Article 6):
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-charcoal font-semibold">Contract</strong> — processing
              necessary to provide the service you have signed up for.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Legal obligation</strong> — food
              safety compliance logs are records your venue is legally required to keep under UK
              food hygiene law.
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Legitimate interests</strong> —
              service reliability, security monitoring, and fraud prevention.
            </li>
          </ul>
          <p>
            Fitness declarations may involve health-related data (special category data under
            UK GDPR Article 9). We process this solely for the purpose of food safety compliance,
            which is a legal obligation for food businesses.
          </p>
        </Section>

        <Section title="Data sharing">
          <p>We use the following sub-processors to operate the service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-charcoal font-semibold">Supabase</strong> — cloud database
              and authentication hosting (EU region).
            </li>
            <li>
              <strong className="text-charcoal font-semibold">Apple</strong> — push notification
              delivery via Apple Push Notification service (APNs).
            </li>
          </ul>
          <p>
            We may disclose data if required to do so by law, court order, or regulatory authority.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Compliance logs (temperature records, cleaning records, etc.) are retained for a
            minimum of 3 months by default, in line with EHO best practice guidance. Venue managers
            can export or delete records at any time from the app.
          </p>
          <p>
            Account and staff data is retained for as long as your account is active. When an
            account is closed, data is deleted within 30 days unless retention is required by law.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under UK GDPR you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data ("right to be forgotten").</li>
            <li>Object to or restrict certain processing.</li>
            <li>Receive your data in a portable format.</li>
            <li>Lodge a complaint with the ICO (ico.org.uk).</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Pelikn uses a single session cookie to keep you logged in as a venue manager. We do
            not use advertising cookies, tracking pixels, or third-party analytics cookies.
          </p>
        </Section>

        <Section title="Security">
          <p>
            All data is encrypted in transit (TLS) and at rest. Access to venue data is
            controlled by row-level security policies — each venue can only access its own records.
            Manager authentication uses industry-standard secure tokens via Supabase Auth.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. If we make material changes we will
            notify active users by email. The effective date at the top of this page will always
            reflect the latest version.
          </p>
        </Section>

        <div className="border-t border-charcoal/8 pt-8 mt-8">
          <p className="text-xs text-charcoal/40">
            Pelikn · <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
            {' '}· United Kingdom
          </p>
        </div>
      </main>
    </div>
  )
}
