import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import PublicNavbar from '../components/PublicNavbar'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'

const EFFECTIVE_DATE = 'April 22, 2026'
const CONTACT_EMAIL = 'assist@nexistrydigitalsolutions.com'
const OPERATOR_NAME = 'Nexistry Digital Solutions'
const BUSINESS_ADDRESS = '1149 Bambi St., Tañada Subd., Gen. T. De Leon, Valenzuela City, Philippines'
const MINIMUM_AGE = 18

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

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Operator and contact</h2>
        <p>
          The Service is operated by {OPERATOR_NAME}. Contact us at{' '}
          <a className="text-blue-600 hover:underline dark:text-blue-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{' '}
          or by mail at {BUSINESS_ADDRESS}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">1) Acceptance of these Terms</h2>
        <p>
          By accessing or using NexiFlow (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If
          you do not agree, do not use the Service.
        </p>
        <p>
          If you are using the Service on behalf of an organization, you represent that you have authority to bind that
          organization, and "you" refers to the organization.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">2) Eligibility</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>You must be at least {MINIMUM_AGE} years old to use the Service.</li>
          <li>You must comply with applicable laws and these Terms.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">3) Accounts and administrators</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You are responsible for activity that occurs under your account.</li>
          <li>You must provide accurate information and keep it up to date.</li>
          <li>If you are an organization, you may designate administrators to manage users, permissions, and billing.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">4) The Service</h2>
        <p>
          The Service may include time tracking, project/client management, reporting, invoicing, subscriptions/billing,
          notifications, and AI-assisted functionality, depending on plan and configuration.
        </p>
        <p>We may modify, add, or remove features over time and do not guarantee uninterrupted availability.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">5) Acceptable use</h2>
        <p>You agree not to misuse the Service. For example, you must not:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Access, probe, or test the vulnerability of any system without authorization.</li>
          <li>Interfere with or disrupt the Service or its infrastructure.</li>
          <li>Upload or transmit malicious code.</li>
          <li>Use the Service to violate applicable laws or third-party rights.</li>
          <li>Reverse engineer or attempt to extract source code except to the extent permitted by law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">6) Customer content</h2>
        <p>
          You (or your organization) retain ownership of content you submit to the Service ("Customer Content"). You grant
          us a limited license to host, process, transmit, and display Customer Content solely to provide, maintain, and
          improve the Service and to comply with law.
        </p>
        <p>You are responsible for Customer Content and for ensuring you have the rights to submit it.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">7) Paid plans, billing, and refunds</h2>
        <p>
          Some features may require a paid subscription. Pricing, billing cycles, and seat counts may be shown in the
          Service. Payments may be processed by third-party payment providers depending on configuration (including
          PayMongo and/or PayPal). You authorize us and our payment providers to charge applicable fees and applicable
          taxes.
        </p>
        <p>Fees are non-refundable except where required by law or expressly agreed in writing.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">8) Third-party services</h2>
        <p>
          The Service may integrate with third-party services. Your use of third-party services is subject to their terms
          and policies. We are not responsible for third-party products, outages, or actions. Examples may include payment
          providers (PayMongo/PayPal) and AI providers (OpenAI), depending on configuration.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">9) AI-assisted features (if enabled)</h2>
        <p>
          If you use AI-assisted features, you are responsible for the content you submit and for reviewing outputs
          before relying on them. AI outputs may be inaccurate and should not be treated as professional advice.
        </p>
        <p>You must not input information you are not authorized to share.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">10) Intellectual property</h2>
        <p>
          We and our licensors own the Service and its content (excluding content you submit). You retain rights to your
          content, and you grant us a limited license to host, process, and display it to provide the Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">11) Disclaimer and limitation of liability</h2>
        <p>
          The Service is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, we
          disclaim warranties and limit liability for indirect, incidental, special, consequential, or punitive damages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">12) Termination</h2>
        <p>
          We may suspend or terminate access to the Service if you violate these Terms or if required for security or
          legal reasons. You may stop using the Service at any time.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">13) Governing law</h2>
        <p>
          These Terms are governed by the laws of the Philippines, without regard to conflict of law principles, except
          where prohibited by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">14) Contact</h2>
        <p>
          For questions about these Terms, contact{' '}
          <a className="text-blue-600 hover:underline dark:text-blue-300" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          , or by mail at {BUSINESS_ADDRESS}.
        </p>
      </section>
    </LegalPageLayout>
  )
}
