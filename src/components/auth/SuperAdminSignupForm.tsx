import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle, Crown, Eye, EyeOff, Users } from 'lucide-react'
import { useMySQLAuth } from '../../contexts/MySQLAuthContext'

interface SuperAdminSignupFormProps {
  onSwitchToLogin: () => void
}

type Step = 1 | 2 | 3

type PlanId = 'solo' | 'office' | 'enterprise'

const plans: Array<{
  id: PlanId
  name: string
  price: string
  period: string
  description: string
  icon: typeof Building2
  popular?: boolean
  features: string[]
}> = [
  {
    id: 'solo',
    name: 'Solo',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individuals and small teams',
    icon: Building2,
    features: ['Unlimited Time Tracker', 'Calendar', '1 Project', '1 Client']
  },
  {
    id: 'office',
    name: 'Office',
    price: '$9',
    period: 'per user/month',
    description: 'Ideal for growing businesses',
    icon: Users,
    popular: true,
    features: [
      'Everything in Solo',
      'Time Off',
      'Client Invoice',
      'Time reminder',
      'Project Management',
      'Customize your PDF',
      'Task Management',
      'Teams Management',
      'Tags',
      'Customize billable time (optional)',
      'Manage Roles',
      'Set Idle Feature (optional)'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$12',
    period: 'per user/month',
    description: 'For large organizations',
    icon: Crown,
    features: [
      'Everything in Office',
      'Multiple Currencies',
      'Email Support',
      'Database Backups: backup database every 1hr (optional)',
      'Force Timer',
      'System Logs'
    ]
  }
]

export default function SuperAdminSignupForm({ onSwitchToLogin }: SuperAdminSignupFormProps) {
  const { signup } = useMySQLAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyName: '',
    plan: 'solo' as PlanId,
    password: '',
    confirmPassword: ''
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordStrength = useMemo(() => {
    const value = formData.password
    return {
      length: value.length >= 8,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
      number: /\d/.test(value),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    }
  }, [formData.password])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.companyName) {
      return 'Please fill in all fields'
    }
    if (!formData.email.includes('@')) {
      return 'Please enter a valid email address'
    }
    return ''
  }

  const validatePasswords = () => {
    if (!formData.password || !formData.confirmPassword) {
      return 'Please enter and confirm your password'
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    return ''
  }

  const handleNext = () => {
    if (step === 1) {
      const msg = validateStep1()
      if (msg) {
        setError(msg)
        return
      }
    }

    if (step === 2) {
      const msg = validatePasswords()
      if (msg) {
        setError(msg)
        return
      }
    }

    setError('')
    setStep(prev => (prev === 3 ? 3 : ((prev + 1) as Step)))
  }

  const handleBack = () => {
    setError('')
    setStep(prev => (prev === 1 ? 1 : ((prev - 1) as Step)))
  }

  const handlePlanSelect = (planId: PlanId) => {
    setFormData(prev => ({ ...prev, plan: planId }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const pwdMsg = validatePasswords()
    if (pwdMsg) {
      setError(pwdMsg)
      return
    }

    setLoading(true)
    try {
      const result = await signup(
        {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: 'super_admin'
        },
        formData.companyName
      )

      if (result.success) {
        if (formData.plan === 'office' || formData.plan === 'enterprise') {
          const token = localStorage.getItem('authToken')
          if (!token) {
            setError('Session expired. Please sign in again and try upgrading.')
            return
          }

          const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
          const response = await fetch(`${API_BASE_URL}/billing/create-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              plan: formData.plan,
              successUrl: `${window.location.origin}/billing/success`,
              cancelUrl: `${window.location.origin}/billing/cancel`
            })
          })

          const data = await response.json().catch(() => null)
          if (response.ok && data?.success && data?.checkoutUrl) {
            window.location.href = data.checkoutUrl
            return
          }

          setError(data?.error || 'Failed to initiate payment. Please try again.')
          return
        }

        navigate('/')
      } else {
        setError(result.error || 'Failed to create account. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-green-500/20 border border-green-400/30 rounded-3xl p-6 backdrop-blur-xl">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Account Created Successfully!</h2>
            <p className="text-white/70 mb-4">
              Your account has been created successfully. You can now sign in to your account.
            </p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="bg-white hover:bg-white/90 text-blue-900 py-3 px-6 rounded-2xl font-semibold shadow-lg active:scale-[0.98] transition-all duration-300"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/70">Step {step} of 3</span>
          <span className="text-sm font-medium text-white/80">
            {step === 1 ? 'Your Info' : step === 2 ? 'Set Password' : 'Select Plan'}
          </span>
        </div>
        <div className="w-full bg-white/10 border border-white/15 rounded-full h-2 backdrop-blur-sm">
          <div
            className="bg-white/80 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">Let's get started</h2>
            <p className="text-white/70">First, tell us about yourself</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2 ml-1">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all text-lg"
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2 ml-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all text-lg"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-white/80 mb-2 ml-1">
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              value={formData.companyName}
              onChange={handleInputChange}
              className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all text-lg"
              placeholder="Acme Inc."
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center space-x-3 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl backdrop-blur-sm">
              <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
              <div className="text-sm text-red-100 font-medium">
                <p>{error}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-white hover:bg-white/90 text-blue-900 py-4 px-4 rounded-2xl font-semibold shadow-lg active:scale-[0.98] transition-all duration-300 flex items-center justify-center group"
          >
            Continue
            <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">Create your password</h2>
            <p className="text-white/70">Secure your account with a strong password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all pr-12 text-lg"
                  placeholder="Create a strong password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                  )}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`text-xs ${passwordStrength.length ? 'text-green-300' : 'text-white/40'}`}>8+ characters</div>
                <div className={`text-xs ${passwordStrength.uppercase ? 'text-green-300' : 'text-white/40'}`}>Uppercase</div>
                <div className={`text-xs ${passwordStrength.lowercase ? 'text-green-300' : 'text-white/40'}`}>Lowercase</div>
                <div className={`text-xs ${passwordStrength.number ? 'text-green-300' : 'text-white/40'}`}>Number</div>
                <div className={`text-xs col-span-2 ${passwordStrength.special ? 'text-green-300' : 'text-white/40'}`}>
                  Special character (!@#$%^&*)
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-white/80 mb-2 ml-1"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm transition-all pr-12 text-lg"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-white/50 hover:text-white/80 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-3 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
                <div className="text-sm text-red-100 font-medium">
                  <p>{error}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 text-white py-4 px-4 rounded-2xl font-semibold backdrop-blur-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 bg-white hover:bg-white/90 text-blue-900 py-4 px-4 rounded-2xl font-semibold shadow-lg active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
              >
                Continue
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-sm">Choose your plan</h2>
            <p className="text-white/70">Select the plan that works best for you</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {plans.map((plan) => {
                const Icon = plan.icon
                const isSelected = formData.plan === plan.id

                return (
                  <div
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`relative rounded-xl p-6 cursor-pointer transition-all duration-300 border-2 ${
                      isSelected
                        ? 'border-white/40 bg-white/15 backdrop-blur-xl'
                        : 'border-white/15 hover:border-white/30 bg-white/10 backdrop-blur-xl'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 right-4 bg-white text-blue-900 text-xs font-semibold px-3 py-1 rounded-full shadow">
                        Most Popular
                      </div>
                    )}

                    <div className="flex items-start space-x-4">
                      <div
                        className={`p-3 rounded-lg ${
                          isSelected
                            ? 'bg-white text-blue-900'
                            : 'bg-white/15 text-white/80'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-white">{plan.price}</span>
                            <span className="text-sm text-white/50 ml-1">/{plan.period}</span>
                          </div>
                        </div>

                        <p className="text-sm text-white/70 mb-3">{plan.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {plan.features.slice(0, 4).map((feature, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-white/10 border border-white/15 text-white/70 px-2 py-1 rounded"
                            >
                              {feature}
                            </span>
                          ))}
                          {plan.features.length > 4 && (
                            <span className="text-xs text-white/50 px-2 py-1">
                              +{plan.features.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-white bg-white' : 'border-white/30'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-4 h-4 text-blue-900" />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="flex items-center space-x-3 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
                <div className="text-sm text-red-100 font-medium">
                  <p>{error}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 text-white py-4 px-4 rounded-2xl font-semibold backdrop-blur-sm active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
              >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white hover:bg-white/90 text-blue-900 py-4 px-4 rounded-2xl font-semibold shadow-lg active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}