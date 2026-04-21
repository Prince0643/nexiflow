import { Link } from 'react-router-dom'

const Documentation = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600 dark:text-blue-300">
          Resources
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Documentation</h1>
        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
          Practical guides to help you set up NexiFlow, track time confidently, and keep your team aligned.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-base font-semibold">Getting Started</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>1) Create your workspace and confirm your email</li>
              <li>2) Add projects and (optional) clients</li>
              <li>3) Invite your team and set roles</li>
              <li>4) Start tracking time and add notes/tags</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-base font-semibold">FAQ</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><span className="font-medium text-gray-900 dark:text-white">Can I edit a time entry?</span> Yes—open the entry and update time, project, and notes.</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Do I need a client?</span> No—clients are optional, projects work without them.</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Where are reports?</span> Use the Reports page to review summaries and exports.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-base font-semibold">Common Workflows</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><span className="font-medium text-gray-900 dark:text-white">Daily tracking:</span> start timer → pick project → add note → stop timer</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Week review:</span> open Calendar → verify entries → fix overlaps/missing notes</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Reporting:</span> filter by date/project → export for billing/payroll</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-base font-semibold">Troubleshooting</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><span className="font-medium text-gray-900 dark:text-white">Timer won’t start:</span> refresh the page and try again.</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Can’t log in:</span> verify email address and reset password from the login page.</li>
              <li><span className="font-medium text-gray-900 dark:text-white">Page not updating:</span> hard refresh (Cmd/Ctrl+Shift+R) to clear cached assets.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="text-base font-semibold">Need help?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            If you’re stuck, visit the Help Center or email support. Include your account email, steps to reproduce, and screenshots if possible.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/help-center"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Visit Help Center
            </Link>
            <a
              href="mailto:assist@nexistrydigitalsolutions.com"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 px-5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-white/10"
            >
              Email support
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Documentation
