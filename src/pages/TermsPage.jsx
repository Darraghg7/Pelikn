import React from 'react'
import Logo from '../components/ui/Logo'
import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '21 October 2026'
const CONTACT_EMAIL  = 'darraghguy@yahoo.com'
const PROVIDER       = 'Darragh Guy, trading as Pelikn'

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

function Email() {
  return <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline break-words">{CONTACT_EMAIL}</a>
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-charcoal/8 dark:border-white/8 bg-white dark:bg-paperDark">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" aria-label="Pelikn home">
            <Logo height={28} />
          </Link>
          <span className="text-xs text-charcoal/40 dark:text-white/35">Terms of Service</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-charcoal dark:text-white mb-1">Terms of Service</h1>
        <p className="text-xs text-charcoal/40 dark:text-white/35 mb-6">Effective date: {EFFECTIVE_DATE}</p>

        <p className="text-xs text-charcoal/60 dark:text-white/50 leading-relaxed border border-charcoal/10 dark:border-white/10 rounded-control px-4 py-3 mb-10">
          These terms have not yet been reviewed by a solicitor. They are not legal advice and
          should not be relied on as such until they have been.
        </p>

        <Section id="who" title="Who we are">
          <p>
            Pelikn is a compliance and team management app for hospitality venues. It is run by{' '}
            {PROVIDER} ("we", "us", "our"), a sole trader based in the United Kingdom. "You" means
            the business that signs up to Pelikn (the "venue"), and the person who signs it up on
            its behalf.
          </p>
        </Section>

        <Section id="acceptance" title="Accepting these terms">
          <p>
            By creating an account or using Pelikn you agree to these terms and to our{' '}
            <Link to="/privacy" className="text-brand underline">Privacy Policy</Link>. If you are
            signing up for a business, you confirm you are allowed to accept these terms for it.
            If you do not agree, please do not use Pelikn.
          </p>
        </Section>

        <Section id="service" title="What Pelikn does">
          <p>
            Pelikn lets venues keep food safety records, run rotas, track hours and manage their
            team. Features depend on your plan (Starter or Pro), as shown on our pricing page.
            We may improve, change or retire features over time. If we make a change that
            removes something you rely on, we will tell you by email first.
          </p>
          <p>
            Pelikn is a tool to help you keep records. It does not replace your own legal
            responsibility to comply with food safety, health and safety, employment and other
            laws. You are responsible for the checks you carry out, and for the accuracy and
            completeness of what you and your staff enter.
          </p>
        </Section>

        <Section id="accounts" title="Accounts and access">
          <ul className="list-disc pl-5 space-y-2">
            <li>The owner signs in with an email and password. Staff and managers sign in with a PIN.</li>
            <li>You are responsible for everything done through your venue's account, including by staff you give access to. Keep PINs and passwords private, and tell us at once if you think one has been shared or stolen.</li>
            <li>Give us accurate details and keep them up to date, including the email address we use to contact you.</li>
            <li>Only add people who work for your venue. You are responsible for telling your staff how their data is used in Pelikn, including the clock-in features you switch on.</li>
          </ul>
        </Section>

        <Section id="billing" title="Free trial, plans and payment">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Free trial.</strong> New venues get a 7-day free trial with no card needed. When
              it ends, you need to add a card and choose a plan to keep using Pelikn. Until you do,
              your venue is paused: your data is kept, but you cannot use the app.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Prices.</strong> The current prices are on our pricing page. They are in pounds
              sterling and do not include VAT. If we are required to charge VAT, it will be added
              and shown at checkout. Starter covers one venue, and is limited to five staff in
              addition to the owner. Pro has no staff limit, and extra venues are charged
              separately.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Billing.</strong> You pay monthly or annually in advance, by card, through our
              payment provider Stripe. Your subscription renews automatically at the end of each
              period until you cancel. Card details are handled by Stripe, not by us.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Changing plan.</strong> You can upgrade, downgrade or add venues in Plan &amp;
              Billing. Charges update to match.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Cancelling.</strong> You can cancel at any time from Plan &amp; Billing. There are
              no contracts or cancellation fees. You keep access until the end of the period you
              have already paid for, and it then ends without renewing.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Refunds.</strong> We do not refund part-used billing periods. If you think you have
              been charged in error, email <Email /> and we will put it right. This does not affect
              any rights you have under the law.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Price changes.</strong> We will give you at least 30 days' notice by email before a
              price change takes effect on your subscription. If you do not want the new price,
              you can cancel before it starts.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Failed payments.</strong> If a payment fails, Stripe will retry it. If it still
              cannot be taken, we may cancel the subscription and pause your venue.
            </li>
            <li>
              <strong className="text-charcoal dark:text-white font-semibold">Existing arrangements.</strong> Venues that agreed different billing terms with us
              before these terms took effect keep those terms for as long as they apply.
            </li>
          </ul>
        </Section>

        <Section id="use" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>use Pelikn for anything unlawful, or to enter false or misleading records;</li>
            <li>try to get into another venue's data, or to bypass the limits of your plan or the security of the service;</li>
            <li>copy, reverse engineer or resell Pelikn, or use it to build a competing service;</li>
            <li>overload or interfere with the service, or introduce harmful code.</li>
          </ul>
          <p>
            If you break these rules we may pause or close your account. Where we reasonably can,
            we will tell you why first.
          </p>
        </Section>

        <Section id="data" title="Your data">
          <p>
            The records you and your staff put into Pelikn belong to you. We use them only to run
            the service for you, as described in our{' '}
            <Link to="/privacy" className="text-brand underline">Privacy Policy</Link>. For data you
            put into Pelikn about your staff and customers, you are the controller and we are your
            processor. On request we will sign a data processing agreement setting this out.
          </p>
          <p>
            You can export your records from the app at any time. We back up the service, but you
            should keep your own copies of records you are legally required to keep.
          </p>
          <p>
            You give us permission to use your data as needed to provide, secure and support
            Pelikn, including passing it to the companies listed in our Privacy Policy.
          </p>
        </Section>

        <Section id="ownership" title="Our software">
          <p>
            Pelikn, its design and its code belong to us. While you have an active subscription,
            we give you a limited, non-exclusive right to use it for your venue's own operations.
            Nothing in these terms transfers any ownership of it to you.
          </p>
        </Section>

        <Section id="availability" title="Availability and support">
          <p>
            We work to keep Pelikn available and your data safe, but we cannot promise it will
            always be uninterrupted or error-free. We may take it offline briefly for maintenance
            or fixes. Pelikn can keep some actions on a device when there is no signal, but
            records are only safe once they have reached our servers. For help, email <Email />.
          </p>
        </Section>

        <Section id="liability" title="Our responsibility to you">
          <p>
            Nothing in these terms limits or excludes our liability for death or personal injury
            caused by our negligence, for fraud, or for anything else the law does not allow us to
            limit.
          </p>
          <p>
            Subject to that, and to the extent the law allows:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>we are not liable for lost profits or revenue, loss of business, or indirect or consequential loss;</li>
            <li>we are not liable for fines, enforcement action or losses that result from your own record-keeping, or from information you entered incorrectly or did not enter;</li>
            <li>our total liability to you for everything arising from your use of Pelikn in any 12 months is limited to the amount you paid us in that period.</li>
          </ul>
          <p>
            Pelikn is provided as a tool to help you keep records. We do not guarantee that using
            it will make you compliant with any law or pass any inspection.
          </p>
        </Section>

        <Section id="ending" title="Ending your account">
          <p>
            You can cancel at any time, as set out above. We may end your account if you break these
            terms, or if we stop offering Pelikn, in which case we will give you at least 30 days'
            notice and refund any amount you have paid for time after the end date.
          </p>
          <p>
            When an account closes, you can export your data first. We then delete it as described
            in the retention section of our{' '}
            <Link to="/privacy#retention" className="text-brand underline">Privacy Policy</Link>,
            unless the law requires us to keep something.
          </p>
        </Section>

        <Section id="law" title="Governing law">
          <p>
            These terms are governed by the laws of England and Wales. If we cannot settle a
            disagreement between us, the courts of England and Wales have the final say. Northern
            Ireland and Scotland venues keep any rights they have under local law.
          </p>
        </Section>

        <Section id="changes" title="Changes to these terms">
          <p>
            We may update these terms. If we make important changes, we will tell account holders
            by email at least 30 days before they take effect. The date at the top always shows the
            current version. If you keep using Pelikn after a change takes effect, you accept the
            new terms.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Questions about these terms: <Email />.
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
