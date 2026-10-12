import { useSearchParams } from 'react-router-dom'

const MESSAGES: Record<string, { text: string; tone: 'ok' | 'warn' | 'error' }> = {
  stripe_success: { text: 'Payment received via Stripe. Your plan has been upgraded.', tone: 'ok' },
  stripe_pending: { text: 'Your Stripe payment is still processing. Your plan will upgrade automatically once it clears.', tone: 'warn' },
  stripe_cancelled: { text: 'Stripe checkout was cancelled. You have not been charged.', tone: 'warn' },
  stripe_error: { text: 'We could not confirm your Stripe payment. If you were charged, contact support.', tone: 'error' }
}

const TONES = {
  ok: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  warn: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
}

export default function StripeReturnBanner() {
  const [searchParams] = useSearchParams()
  const message = MESSAGES[searchParams.get('billing') || '']
  if (!message) return null
  return (
    <div role="status" className={`mb-6 px-4 py-3 rounded-lg border text-sm ${TONES[message.tone]}`}>
      {message.text}
    </div>
  )
}
