import React from 'react'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '5 October 2026'
const CONTACT_EMAIL  = 'darraghguy@yahoo.com'
const CONTROLLER     = 'Darragh Guy, trading as Pelikn'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <h2 className="text-base font-bold text-charcoal dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-charcoal/70 dark:text-white/60 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function Term({ children }) {
  return <strong className="text-charcoal dark:text-white font-semibold">{children}</strong>
}

function Email() {
  return <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline break-words">{CONTACT_EMAIL}</a>
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/8 dark:border-white/8 bg-white dark:bg-paperDark">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-bold tracking-tight text-charcoal dark:text-white">
            Pelikn
          </Link>
          <span className="text-xs text-charcoal/40 dark:text-white/35">Privacy Policy</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-charcoal dark:text-white mb-1">Privacy Policy</h1>
        <p className="text-xs text-charcoal/40 dark:text-white/35 mb-6">Effective date: {EFFECTIVE_DATE}</p>

        <p className="text-xs text-charcoal/60 dark:text-white/50 leading-relaxed border border-charcoal/10 dark:border-white/10 rounded-lg px-4 py-3 mb-10">
          This policy has not yet been reviewed by a solicitor. It is not legal advice and should
          not be relied on as such until it has been.
        </p>

        <Section id="who-we-are" title="Who we are">
          <p>
            Pelikn is a compliance and team management app for hospitality venues. It is run
            by {CONTROLLER} ("we", "us", "our"), a sole trader based in the United Kingdom. This
            policy is written under UK GDPR and the Data Protection Act 2018.
          </p>
          <p>
            Questions about this policy or your data: <Email />. Our postal address is available
            on request.
          </p>
        </Section>

        <Section id="roles" title="Who is responsible for your data">
          <p>It depends on whose data it is:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Term>Data a venue puts into Pelikn</Term> (its staff, its records, its customers) — the
              venue is the <em>controller</em>. It decides what to record and why. We are
              its <em>processor</em>: we store and handle that data only to run the service for the
              venue, on its instructions. If you work at a venue, your employer is responsible
              for your data in Pelikn.
            </li>
            <li>
              <Term>Account data for the people who sign venues up</Term> (owners and managers with
              an email login) — we are the controller.
            </li>
          </ul>
          <p>
            Venues can ask us for a data processing agreement setting out these terms. Our{' '}
            <Link to="/terms" className="text-brand underline">Terms of Service</Link> also cover
            how we act as a processor.
          </p>
        </Section>

        <Section id="what-we-collect" title="What data Pelikn holds">
          <p>Depending on which features a venue uses, Pelikn may hold:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Term>Manager accounts</Term> — name, email address and login details for owners and
              managers.
            </li>
            <li>
              <Term>Staff profiles</Term> — name, email address, optional profile photo, job title
              and department, employment type, start date, contracted hours, hourly pay rate,
              emergency contact name and phone number, and a 4-digit PIN (stored scrambled, never
              in plain text).
            </li>
            <li>
              <Term>Hours and pay</Term> — clock-in and clock-out times, breaks, edits to recorded
              hours, rotas and shift swaps, availability, timesheets and tip shares.
            </li>
            <li>
              <Term>Leave</Term> — holiday allowances and time-off requests, including any reason
              the staff member gives and the manager's reply.
            </li>
            <li>
              <Term>HR records</Term> — uploaded documents such as contracts and certificates,
              formal warnings and dismissals, and automatic records of late clock-ins and long
              breaks ("strikes").
            </li>
            <li>
              <Term>Training</Term> — training completions, certificates and signatures drawn on
              screen to confirm training.
            </li>
            <li>
              <Term>Health information</Term> — fitness-to-work declarations, injury details in
              incident reports, and anything health-related written in a leave reason or HR
              document. See "Health information" below.
            </li>
            <li>
              <Term>Customers and members of the public</Term> — if a venue records a complaint,
              incident or product recall, Pelikn may hold the person's name and contact details,
              what happened, and (for complaints about illness or allergic reactions) health
              details.
            </li>
            <li>
              <Term>Food safety and venue records</Term> — temperature checks, cleaning, deliveries,
              waste, suppliers, opening and closing checks, corrective actions and the name of the
              staff member who recorded each one.
            </li>
            <li>
              <Term>Device and session data</Term> — which devices are signed in and when, a
              scrambled (hashed) form of your IP address to block repeated failed sign-ins, and
              push notification tokens if you allow notifications.
            </li>
          </ul>
          <p>
            We do not collect or store payment card details.
          </p>
        </Section>

        <Section id="health" title="Health information">
          <p>
            Health information is "special category" data under UK GDPR Article 9 and needs extra
            care. In Pelikn it can appear in fitness-to-work declarations, incident and injury
            reports, customer complaints about illness or allergic reactions, leave reasons, and
            HR documents.
          </p>
          <p>
            Venues record this to meet their legal duties: food hygiene law (keeping unwell staff
            away from food), health and safety and RIDDOR reporting, and employment law. Only
            managers can see it. Staff can see their own leave reasons but not other people's.
            We never use it for any other purpose.
          </p>
        </Section>

        <Section id="how-we-use" title="How we use data">
          <ul className="list-disc pl-5 space-y-2">
            <li>To run Pelikn and its features for the venue.</li>
            <li>To produce reports and exports the venue asks for.</li>
            <li>To send emails and notifications, such as rotas, leave requests and weekly reports.</li>
            <li>To keep the service secure and to find and fix errors.</li>
            <li>To answer support requests.</li>
          </ul>
          <p>
            We do not sell data, use it for advertising, or share it with anyone for their own
            marketing.
          </p>
        </Section>

        <Section id="legal-basis" title="Legal basis">
          <p>
            For data a venue puts into Pelikn, the venue decides its own legal basis (usually its
            employment contracts and its legal duties as a food business and employer). We
            process that data on the venue's behalf.
          </p>
          <p>For data where we are the controller, we rely on:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Term>Contract</Term> — running the account you signed up for.
            </li>
            <li>
              <Term>Legitimate interests</Term> — keeping the service secure and reliable, and
              fixing errors.
            </li>
            <li>
              <Term>Legal obligation</Term> — where the law requires us to keep or disclose data.
            </li>
          </ul>
        </Section>

        <Section id="sharing" title="Companies we use">
          <p>
            We use these companies (sub-processors) to run Pelikn. Each only gets the data it needs
            to do its job:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Term>Supabase</Term> — database, file storage and logins. All data held in Pelikn
              lives here (EU region).
            </li>
            <li>
              <Term>Vercel</Term> — hosts the website and app. Handles your connection to Pelikn,
              including your IP address.
            </li>
            <li>
              <Term>Resend</Term> — sends Pelikn's emails. Sees the recipient's email address and
              the email content, which can include rotas, weekly venue reports, and leave requests
              with the reason given.
            </li>
            <li>
              <Term>Sentry</Term> — error monitoring (EU region). When something breaks, it receives
              technical details about the error, your browser and the page. We do not attach
              names or email addresses to these reports.
            </li>
            <li>
              <Term>Apple</Term> — delivers push notifications to iPhones and iPads.
            </li>
            <li>
              <Term>Browser push services</Term> (Google, Mozilla, Apple, depending on your browser)
              — deliver push notifications in web browsers.
            </li>
            <li>
              <Term>Google Fonts</Term> — supplies the app's typeface. Your browser fetches it from
              Google, which sees your IP address.
            </li>
          </ul>
          <p>
            We may also disclose data if required by law, a court order or a regulator.
          </p>
        </Section>

        <Section id="transfers" title="Data outside the UK">
          <p>
            Our main database is in the EU, which the UK recognises as giving adequate protection.
            Some of the companies above are based in the United States or may handle data there
            (for example Vercel, Resend, Google and Apple). Where that happens, we rely on
            the safeguards UK law allows: the UK–US data bridge where the company is certified
            under it, or contract terms approved for UK transfers (the UK International Data
            Transfer Agreement or Addendum).
          </p>
        </Section>

        <Section id="retention" title="How long we keep data">
          <p>
            Venues control their records and can export or delete them in the app. As a guide, we
            recommend and work to these periods:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Food safety records: 2 years.</li>
            <li>Complaints and product recalls: 2 years.</li>
            <li>Incidents and accidents: 3 years.</li>
            <li>HR, disciplinary, pay and hours records: 6 years after the staff member leaves.</li>
            <li>Sessions and device data: until you sign out or the session expires.</li>
            <li>Manager account data: while the account is open.</li>
          </ul>
          <p>
            Pelikn does not yet delete records automatically when these periods end. Venues can
            delete them, or ask us to.
          </p>
          <p>
            When a venue closes its account, it can export its data first. We then delete it
            within 30 days, and it is cleared from backups within 90 days, unless the law
            requires us to keep it.
          </p>
        </Section>

        <Section id="rights" title="Your rights">
          <p>Under UK GDPR you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Get a copy of the personal data held about you.</li>
            <li>Have inaccurate data corrected.</li>
            <li>Have your data deleted, where there is no reason to keep it.</li>
            <li>Object to or limit how your data is used.</li>
            <li>Get your data in a format you can take elsewhere.</li>
          </ul>
          <p>
            If you work at a venue, or you are a customer of one, the venue is responsible for your
            data, so please contact the venue first. If you contact us instead, we will pass your
            request to the venue and help it respond.
          </p>
          <p>
            For anything else, email <Email />. We will reply within one month.
          </p>
          <p>
            If you are unhappy with how your data is handled, you can complain to the Information
            Commissioner's Office (ICO) at{' '}
            <a href="https://ico.org.uk/make-a-complaint/" className="text-brand underline" target="_blank" rel="noopener noreferrer">ico.org.uk/make-a-complaint</a>{' '}
            or on 0303 123 1113.
          </p>
        </Section>

        <Section id="cookies" title="Cookies and device storage">
          <p>
            Pelikn does not use advertising or tracking cookies, or third-party analytics. To keep
            you signed in and make the app load quickly, it saves some information in your
            browser or phone's own storage: your sign-in session, which venue you last used, your
            permissions, your light or dark mode setting, and cached copies of app files.
            Signing out clears your session.
          </p>
        </Section>

        <Section id="security" title="Security">
          <p>
            Data is encrypted in transit and at rest. Each venue can only access its own records,
            and within a venue, sensitive details such as pay, PINs, HR files and leave reasons
            are limited to managers. HR and training documents are stored privately and opened
            through short-lived links.
          </p>
        </Section>

        <Section id="changes" title="Changes to this policy">
          <p>
            We may update this policy. If we make important changes, we will tell account holders
            by email. The date at the top always shows the current version.
          </p>
        </Section>

        <div className="border-t border-charcoal/8 dark:border-white/8 pt-8 mt-8">
          <p className="text-xs text-charcoal/40 dark:text-white/35">
            {CONTROLLER} · <a href={`mailto:${CONTACT_EMAIL}`} className="underline break-words">{CONTACT_EMAIL}</a>
            {' '}· United Kingdom
          </p>
        </div>
      </main>
    </div>
  )
}
