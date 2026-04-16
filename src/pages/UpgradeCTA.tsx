import React, { useState } from 'react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { 
  Crown, 
  Users, 
  FileText, 
  MessageSquare, 
  BarChart3, 
  Calendar,
  Kanban,
  UserCheck,
  DollarSign,
  CheckCircle,
  ArrowRight,
  Loader2,
  CreditCard
} from 'lucide-react'

export default function UpgradeCTA() {
  const { currentCompany } = useMySQLAuth()
  const [loading, setLoading] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'paymongo' | 'paypal'>('paymongo')

  const OFFICE_PRICE_USD = 9
  const ENTERPRISE_PRICE_USD = 12
  const OFFICE_INCLUDED_SEATS = 10
  const ENTERPRISE_INCLUDED_SEATS = 100

  // Features comparison data
  const features = [
    {
      name: 'Time Tracking',
      solo: true,
      office: true,
      enterprise: true
    },
    {
      name: 'Calendar Integration',
      solo: true,
      office: true,
      enterprise: true
    },
    {
      name: 'Unlimited Clients',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Unlimited Projects',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Task Management',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Team Collaboration',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Teams Management',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Advanced Reporting',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'PDF Customization',
      solo: false,
      office: true,
      enterprise: true
    },
    {
      name: 'Multiple Currencies',
      solo: false,
      office: false,
      enterprise: true
    },
    {
      name: 'Email Support',
      solo: false,
      office: false,
      enterprise: true
    },
    {
      name: 'Database Backups',
      solo: false,
      office: false,
      enterprise: true
    },
    {
      name: 'API Access',
      solo: false,
      office: false,
      enterprise: true
    }
  ]

  // Plans data
  const plans = [
    {
      name: 'Solo',
      price: '$0',
      period: 'forever',
      description: 'Perfect for individuals and small teams',
      features: [
        'Unlimited Time Tracker',
        'Calendar',
        '1 Project',
        '1 Client'
      ],
      popular: false,
      current: currentCompany?.pricingLevel === 'solo'
    },
    {
      name: 'Office',
      price: '$9',
      period: 'per user/month',
      includedSeats: 10,
      description: 'Ideal for growing businesses',
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
      ],
      popular: true,
      current: currentCompany?.pricingLevel === 'office'
    },
    {
      name: 'Enterprise',
      price: '$12',
      period: 'per user/month',
      includedSeats: 100,
      description: 'For large organizations',
      features: [
        'Everything in Office',
        'Multiple Currencies',
        'Email Support',
        'Database Backups: backup database every 1hr (optional)',
        'Force Timer',
        'System Logs',
        'API Access'
      ],
      popular: false,
      current: currentCompany?.pricingLevel === 'enterprise'
    }
  ]

  const handleUpgrade = async (plan: 'office' | 'enterprise') => {
    if (!currentCompany) {
      alert('You must belong to a company to upgrade')
      return
    }
    
    setLoading(true)
    try {
      const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'
      
      if (selectedPaymentMethod === 'paypal') {
        // PayPal flow
        const response = await fetch(`${API_BASE_URL}/billing/create-paypal-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            plan,
            successUrl: `${window.location.origin}/billing/paypal-success`,
            cancelUrl: `${window.location.origin}/billing/paypal-cancel`
          })
        })
        
        const data = await response.json()
        
        if (data.success && data.approvalUrl) {
          // Redirect to PayPal checkout
          window.location.href = data.approvalUrl
        } else {
          alert('Failed to initiate PayPal checkout. Please try again.')
        }
      } else {
        // PayMongo flow
        const response = await fetch(`${API_BASE_URL}/billing/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            plan,
            successUrl: `${window.location.origin}/billing/success`,
            cancelUrl: `${window.location.origin}/billing/cancel`
          })
        })
        
        const data = await response.json()
        
        if (data.success && data.checkoutUrl) {
          // Redirect to Paymongo checkout
          window.location.href = data.checkoutUrl
        } else {
          alert('Failed to initiate upgrade. Please try again.')
        }
      }
    } catch (error) {
      console.error('Upgrade error:', error)
      alert('Failed to initiate upgrade. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Unlock More Features
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Upgrade your plan to access advanced features and unlock the full potential of NexiFlow. 
          Your current Solo plan is great for getting started, but there's so much more to explore!
        </p>
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Feature
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Solo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Office
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {features.map((feature, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {feature.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    {feature.solo ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    {feature.office ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    {feature.enterprise ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
          Choose Your Plan
        </h2>

        {/* Payment Method Selector */}
        <div className="max-w-md mx-auto mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedPaymentMethod('paymongo')}
              className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === 'paymongo'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <CreditCard className={`h-5 w-5 mr-2 ${
                selectedPaymentMethod === 'paymongo' ? 'text-primary-600' : 'text-gray-500'
              }`} />
              <span className={`font-medium ${
                selectedPaymentMethod === 'paymongo'
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                Credit/Debit Card
              </span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('paypal')}
              className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === 'paypal'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.63l-1.496 9.478h2.79c.457 0 .85-.334.922-.788l.04-.19.73-4.627.047-.255a.933.933 0 0 1 .922-.788h.58c3.76 0 6.704-1.528 7.565-5.946.33-1.69.171-3.094-.507-4.179z" />
              </svg>
              <span className={`font-medium ${
                selectedPaymentMethod === 'paypal'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                PayPal
              </span>
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            {selectedPaymentMethod === 'paypal'
              ? 'You will be redirected to PayPal to complete your payment'
              : 'Secure payment via credit/debit card'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl ${
                plan.popular
                  ? 'ring-2 ring-primary-500 border-primary-500'
                  : 'border border-gray-200 dark:border-gray-700'
              } ${plan.current ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              {plan.current && (
                <div className="absolute top-4 right-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium px-2 py-1 rounded-full">
                  Current Plan
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{plan.name}</h3>
                <div className="mb-2">
                  {plan.name === 'Solo' ? (
                    <>
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{plan.price}</span>
                      <span className="text-gray-600 dark:text-gray-400">/{plan.period}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        ${plan.name === 'Office' ? OFFICE_PRICE_USD : ENTERPRISE_PRICE_USD}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">/user/month</span>
                      <p className="text-sm text-gray-500 mt-1">
                        Includes {plan.name === 'Office' ? OFFICE_INCLUDED_SEATS : ENTERPRISE_INCLUDED_SEATS} seats
                      </p>
                    </>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{plan.description}</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              {plan.current ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : plan.name === 'Solo' ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                >
                  Free Plan
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.name.toLowerCase() as 'office' | 'enterprise')}
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
                    plan.popular
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>Upgrade to {plan.name}</>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key Benefits */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900 dark:to-blue-900 rounded-lg border border-primary-200 dark:border-primary-700 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Why Upgrade to Office or Enterprise?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="mx-auto bg-white dark:bg-gray-800 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Team Collaboration</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Work seamlessly with your team members, assign tasks, and track progress together.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto bg-white dark:bg-gray-800 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Advanced Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Gain deeper insights with comprehensive reports and charts to make better business decisions.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto bg-white dark:bg-gray-800 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Premium Features</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Access exclusive features like PDF customization, multiple currencies, and priority support.
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Ready to unlock the full potential?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
          Join thousands of teams already using NexiFlow Office and Enterprise plans to boost their productivity.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition-colors flex items-center justify-center">
            <span>Upgrade Now</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
          <button className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold transition-colors">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  )
}