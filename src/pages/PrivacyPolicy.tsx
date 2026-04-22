import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import PublicNavbar from '../components/PublicNavbar'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

const EFFECTIVE_DATE = 'April 22, 2026'
const CONTACT_EMAIL = 'assist@nexistrydigitalsolutions.com'
const OPERATOR_NAME = 'Nexistry Digital Solutions'
const BUSINESS_ADDRESS = '1149 Bambi St., Tañada Subd., Gen. T. De Leon, Valenzuela City, Philippines'

function LegalPageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  const { currentUser } = useMySQLAuth()

  const publicLinks = useMemo(() => [], [])

  const content = (
    <main className="flex-1 bg-white dark:bg-[#020617] text-gray-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.45em] text-blue-700/90 dark:text-blue-200/90">
            NexiFlow Legal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-gray-700 dark:text-gray-200">{children}</div>
      </div>
    </main>
  )

  if (currentUser) return content

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#020617] text-gray-900 dark:text-white">
      <PublicNavbar
        links={publicLinks}
        onLinkClick={() => {}}
        onLogin={() => navigate('/auth')}
        onAccess={() => navigate('/super-admin-signup')}
        extraLink={{ label: 'About', onClick: () => navigate('/about') }}
      />
      {content}
      <PublicFooter />
    </div>
  )
}

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Operator and contact</h2>
        <p>
          The Service is operated by {OPERATOR_NAME} ("NexiFlow", "we", "us", "our"). Contact us at{' '}
          <a className="text-blue-600 hover:underline dark:text-blue-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{' '}
          or by mail at {BUSINESS_ADDRESS}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">1) Overview</h2>
        <p>
          This Privacy Policy describes how NexiFlow ("we", "us") collects, uses, shares, and protects information when
          you use our website and application (the "Service").
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">2) Scope and definitions</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Personal Data</span> means information that identifies you or can reasonably be
            used to identify you (directly or indirectly).
          </li>
          <li>
            <span className="font-medium">Customer</span> means the organization (or individual) that creates an account
            and uses the Service.
          </li>
          <li>
            <span className="font-medium">End User</span> means an individual authorized by a Customer to use the Service.
          </li>
        </ul>
        <p>
          If you use the Service through an organization, your organization may control certain account settings and data
          access.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">3) Information we collect</h2>
        <p>We may collect the following categories of information:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Account and organization data:</span> name, email address, company/team details,
            role and permissions.
          </li>
          <li>
            <span className="font-medium">Work and usage data:</span> projects, clients, tasks, time entries, notes, and
            other content you add to the Service.
          </li>
          <li>
            <span className="font-medium">Billing and transaction data:</span> subscription plan, seat counts, payment
            status, and payment transaction references from payment providers.
          </li>
          <li>
            <span className="font-medium">Device and log data:</span> basic technical data such as IP address, browser
            type, timestamps, and diagnostic logs.
          </li>
          <li>
            <span className="font-medium">AI feature inputs (if enabled):</span> text you submit to AI-assisted features.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">4) How we use information</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide, operate, and maintain the Service.</li>
          <li>Authenticate users and protect accounts.</li>
          <li>Process subscriptions, upgrades, and payment-related events.</li>
          <li>Improve performance, reliability, and user experience.</li>
          <li>Provide customer support and respond to requests.</li>
          <li>Comply with legal obligations and enforce our Terms.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">5) Legal bases (where applicable)</h2>
        <p>
          Depending on your location and applicable law, we may process Personal Data on one or more of the following
          bases: (a) to perform a contract (provide the Service), (b) legitimate interests (operate, secure, and improve
          the Service), (c) consent (where required), and (d) compliance with legal obligations.
        </p>
        <p>
          For users in the Philippines, we aim to process Personal Data consistent with the Data Privacy Act of 2012
          (Republic Act No. 10173) and implementing rules, where applicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">6) Sharing and disclosure</h2>
        <p>
          We do not sell your personal information. We may share information with service providers that help us operate
          the Service, such as hosting providers, monitoring providers, AI providers (if enabled), and payment providers.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Payment providers:</span> PayMongo and/or PayPal (to process payments and confirm
            payment status).
          </li>
          <li>
            <span className="font-medium">AI providers (if enabled):</span> OpenAI (to power AI-assisted features, subject
            to configuration).
          </li>
          <li>
            <span className="font-medium">Infrastructure providers:</span> hosting, storage, email delivery, monitoring,
            and customer support tooling providers.
          </li>
        </ul>
        <p>
          We may also disclose information if required by law, to protect rights and safety, or in connection with a
          business transfer (e.g., merger or acquisition).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">7) Cookies and local storage</h2>
        <p>
          The Service may use cookies or browser local storage for essential features (such as session state and UI
          preferences). You can manage cookies through your browser settings, but disabling them may affect functionality.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">8) International transfers</h2>
        <p>
          The Service may be accessed from anywhere in the world. Information may be processed in the Philippines and in
          other countries where we or our service providers operate. Where required, we use reasonable safeguards designed
          to help protect transferred information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">9) Data retention</h2>
        <p>
          We retain information for as long as needed to provide the Service, meet legal/accounting obligations, resolve
          disputes, and enforce agreements. You may request deletion of your account and associated data, subject to legal
          requirements.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">10) Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational safeguards designed to protect information.
          However, no system is completely secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">11) Your rights and choices</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Access or update certain account information via the Service.</li>
          <li>Request a copy, correction, or deletion of your information.</li>
          <li>Opt out of non-essential communications where applicable.</li>
        </ul>
        <p>
          If you use the Service through a Customer (your employer/organization), please direct requests to your Customer
          administrator first, as they may control your account and content.
        </p>
        <p>
          If you are located in the EEA/UK (or similar jurisdictions), you may also have the right to lodge a complaint
          with a supervisory authority.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">12) Children’s privacy</h2>
        <p>The Service is not intended for use by individuals under 18 years old.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">13) Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version on this page and update
          the effective date above.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">14) Contact</h2>
        <p>
          For privacy questions or requests, contact us at{' '}
          <a className="text-blue-600 hover:underline dark:text-blue-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          , or by mail at {BUSINESS_ADDRESS}.
        </p>
      </section>
    </LegalPageLayout>
  )
}
