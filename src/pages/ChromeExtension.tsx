import { Chrome, CheckCircle2, ArrowRight, Camera, Clock } from 'lucide-react'

const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/nexiflow-time-tracker/ajebmcddconkbpafckcnkcpidcnjnfmd'

export default function ChromeExtension() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm">
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <Chrome className="h-6 w-6 text-primary-600 dark:text-primary-300" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">NexiFlow Chrome Extension</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-300 max-w-2xl">
                  Track time faster, keep work logs consistent, and optionally capture screenshots for proof-of-work while tracking.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={CHROME_WEB_STORE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm font-medium"
                  >
                    Install from Chrome Web Store
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                  <Clock className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  Faster time tracking
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Start and stop tracking without switching tabs—log time directly to NexiFlow.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                  <Camera className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  Optional screenshots
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Enable screenshot capture only when needed for proof-of-work.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                  Consistent logs
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Standardize descriptions and project selection for clean reporting.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">How to use it</h2>
              <ol className="mt-4 space-y-3 text-gray-700 dark:text-gray-200">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
                    1
                  </span>
                  <div>
                    <div className="font-medium">Install and sign in</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Install the extension, open it from the Chrome toolbar, then log in with your NexiFlow account.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
                    2
                  </span>
                  <div>
                    <div className="font-medium">Select client/project and add a description</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Choose the client and project, then add a clear description of what you’re working on.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
                    3
                  </span>
                  <div>
                    <div className="font-medium">Start tracking</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Click Start to begin tracking. You can keep working while the timer runs in the background.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
                    4
                  </span>
                  <div>
                    <div className="font-medium">Optional: enable screenshots</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Turn on the screenshot toggle only if your company requires proof-of-work. Screenshots are captured only while tracking is active.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold">
                    5
                  </span>
                  <div>
                    <div className="font-medium">Stop and review your logs</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Click Stop when you’re done. Your time entry will appear in NexiFlow reports and client/project views.
                    </div>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
