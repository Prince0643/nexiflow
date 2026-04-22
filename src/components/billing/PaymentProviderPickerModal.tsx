import { useEffect } from 'react'
import { X, CreditCard } from 'lucide-react'

export type PaymentProvider = 'paymongo' | 'paypal'
export type UpgradePlan = 'office' | 'enterprise'

interface PaymentProviderPickerModalProps {
  isOpen: boolean
  plan: UpgradePlan | null
  selectedProvider: PaymentProvider | null
  loading?: boolean
  onClose: () => void
  onSelectProvider: (provider: PaymentProvider) => void
  onConfirm: () => void
}

export default function PaymentProviderPickerModal({
  isOpen,
  plan,
  selectedProvider,
  loading = false,
  onClose,
  onSelectProvider,
  onConfirm
}: PaymentProviderPickerModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !plan) return null

  const planLabel = plan === 'office' ? 'Office' : 'Enterprise'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Choose payment provider
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            You are upgrading to <span className="font-semibold">{planLabel}</span>. Select how you want to pay.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <button
            onClick={() => onSelectProvider('paymongo')}
            className={`flex flex-col items-center justify-center px-4 py-4 rounded-lg border-2 transition-all ${
              selectedProvider === 'paymongo'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
            type="button"
          >
            <CreditCard
              className={`h-6 w-6 mb-2 ${
                selectedProvider === 'paymongo' ? 'text-primary-600' : 'text-gray-500'
              }`}
            />
            <span
              className={`font-semibold ${
                selectedProvider === 'paymongo'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              PayMongo
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              Credit/debit card
            </span>
          </button>

          <button
            onClick={() => onSelectProvider('paypal')}
            className={`flex flex-col items-center justify-center px-4 py-4 rounded-lg border-2 transition-all ${
              selectedProvider === 'paypal'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
            type="button"
          >
            <svg className="h-6 w-6 mb-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.63l-1.496 9.478h2.79c.457 0 .85-.334.922-.788l.04-.19.73-4.627.047-.255a.933.933 0 0 1 .922-.788h.58c3.76 0 6.704-1.528 7.565-5.946.33-1.69.171-3.094-.507-4.179z" />
            </svg>
            <span
              className={`font-semibold ${
                selectedProvider === 'paypal'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              PayPal
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              Redirect to PayPal
            </span>
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-5">
          {selectedProvider === 'paypal'
            ? 'You will be redirected to PayPal to complete your payment.'
            : selectedProvider === 'paymongo'
              ? 'Secure payment via credit/debit card.'
              : 'Select a provider to continue.'}
        </p>

        <button
          onClick={onConfirm}
          disabled={!selectedProvider || loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
            !selectedProvider || loading
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
          type="button"
        >
          {loading ? 'Processing...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

