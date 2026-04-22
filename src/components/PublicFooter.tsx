import { Link } from 'react-router-dom'

const PublicFooter = () => {
  return (
    <footer className="bg-white py-14 text-gray-900 dark:bg-gray-900 dark:text-white sm:py-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img
              src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
              alt="NexiFlow logo"
              className="h-6 w-auto"
            />
            <span className="text-lg font-semibold">NexiFlow</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Trusted by teams who want better visibility into every billable minute.
          </p>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400 sm:text-sm sm:tracking-[0.4em]">
            Product
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>Pricing</li>
            <li>
              <Link to="/coming-soon" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Integrations
              </Link>
            </li>
            <li>
              <Link to="/coming-soon" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                API
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400 sm:text-sm sm:tracking-[0.4em]">
            Company
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>
              <Link to="/about" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/coming-soon" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Careers
              </Link>
            </li>
            <li>
              <a
                href="https://nexistrydigitalsolutions.com/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400 sm:text-sm sm:tracking-[0.4em]">
            Support
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>
              <Link to="/help-center" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Help Center
              </Link>
            </li>
            <li>
              <Link to="/documentation" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Documentation
              </Link>
            </li>
            <li>
              <Link to="/coming-soon" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Community
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 mt-10 pt-6 text-center text-xs text-gray-500 dark:border-white/10">
        &copy; {new Date().getFullYear()} NexiFlow. All rights reserved.
      </div>
    </footer>
  )
}

export default PublicFooter
