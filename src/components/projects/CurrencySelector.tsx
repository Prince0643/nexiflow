import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface CurrencyOption {
  value: string
  label: string
  flag: string
  country: string
}

const currencyOptions: CurrencyOption[] = [
  { value: 'USD', label: 'USD - US Dollar', flag: '🇺🇸', country: 'United States' },
  { value: 'EUR', label: 'EUR - Euro', flag: '🇪🇺', country: 'European Union' },
  { value: 'GBP', label: 'GBP - British Pound', flag: '🇬🇧', country: 'United Kingdom' },
  { value: 'JPY', label: 'JPY - Japanese Yen', flag: '🇯🇵', country: 'Japan' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', flag: '🇨🇦', country: 'Canada' },
  { value: 'AUD', label: 'AUD - Australian Dollar', flag: '🇦🇺', country: 'Australia' },
  { value: 'PHP', label: 'PHP - Philippine Peso', flag: '🇵🇭', country: 'Philippines' },
  { value: 'SGD', label: 'SGD - Singapore Dollar', flag: '🇸🇬', country: 'Singapore' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit', flag: '🇲🇾', country: 'Malaysia' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah', flag: '🇮🇩', country: 'Indonesia' },
  { value: 'THB', label: 'THB - Thai Baht', flag: '🇹🇭', country: 'Thailand' },
  { value: 'VND', label: 'VND - Vietnamese Dong', flag: '🇻🇳', country: 'Vietnam' },
  { value: 'INR', label: 'INR - Indian Rupee', flag: '🇮🇳', country: 'India' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', flag: '🇨🇳', country: 'China' },
  { value: 'KRW', label: 'KRW - South Korean Won', flag: '🇰🇷', country: 'South Korea' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar', flag: '🇳🇿', country: 'New Zealand' },
  { value: 'CHF', label: 'CHF - Swiss Franc', flag: '🇨🇭', country: 'Switzerland' },
  { value: 'SEK', label: 'SEK - Swedish Krona', flag: '🇸🇪', country: 'Sweden' },
  { value: 'NOK', label: 'NOK - Norwegian Krone', flag: '🇳🇴', country: 'Norway' },
  { value: 'DKK', label: 'DKK - Danish Krone', flag: '🇩🇰', country: 'Denmark' },
  { value: 'PLN', label: 'PLN - Polish Zloty', flag: '🇵🇱', country: 'Poland' },
  { value: 'CZK', label: 'CZK - Czech Koruna', flag: '🇨🇿', country: 'Czech Republic' },
  { value: 'HUF', label: 'HUF - Hungarian Forint', flag: '🇭🇺', country: 'Hungary' },
  { value: 'TRY', label: 'TRY - Turkish Lira', flag: '🇹🇷', country: 'Turkey' },
  { value: 'ZAR', label: 'ZAR - South African Rand', flag: '🇿🇦', country: 'South Africa' },
  { value: 'BRL', label: 'BRL - Brazilian Real', flag: '🇧🇷', country: 'Brazil' },
  { value: 'MXN', label: 'MXN - Mexican Peso', flag: '🇲🇽', country: 'Mexico' },
  { value: 'ARS', label: 'ARS - Argentine Peso', flag: '🇦🇷', country: 'Argentina' },
]

interface CurrencySelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function CurrencySelector({ value, onChange, disabled }: CurrencySelectorProps) {
  const { isDarkMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const selectedCurrency = currencyOptions.find(option => option.value === value) || currencyOptions[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (currencyValue: string) => {
    onChange(currencyValue)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between ${
          disabled 
            ? (isDarkMode ? 'bg-gray-700 cursor-not-allowed' : 'bg-gray-100 cursor-not-allowed') 
            : (isDarkMode ? 'bg-gray-700 border border-gray-600 text-white hover:bg-gray-600' : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50')
        }`}
        disabled={disabled}
      >
        <div className="flex items-center">
          <span className="text-lg mr-2">{selectedCurrency.flag}</span>
          <span>{selectedCurrency.label}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg max-h-60 overflow-auto ${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className="py-1">
            {currencyOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full px-4 py-2 text-left flex items-center ${
                  option.value === value
                    ? (isDarkMode ? 'bg-blue-900 text-white' : 'bg-blue-100 text-blue-900')
                    : (isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-900')
                }`}
              >
                <span className="text-lg mr-3">{option.flag}</span>
                <div>
                  <div>{option.label}</div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {option.country}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}