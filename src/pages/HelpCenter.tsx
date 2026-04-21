import { Link } from 'react-router-dom'

const HelpCenter = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-gray-900 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600 dark:text-blue-300">
          Support
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Help Center</h1>
        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
          Need help with NexiFlow? Email our support team and we’ll get back to you as soon as possible.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Support email</p>
          <a
            href="mailto:assist@nexistrydigitalsolutions.com"
            className="mt-2 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            assist@nexistrydigitalsolutions.com
          </a>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Include your account email, a short description of the issue, and screenshots if possible.
          </p>
        </div>

        <div className="mt-10">
          <Link to="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default HelpCenter

