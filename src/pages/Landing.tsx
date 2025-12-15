import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useTheme } from '../contexts/ThemeContext'
import {
  Clock,
  Users,
  BarChart3,
  Building2,
  Star,
  ArrowRight,
  Play,
  Shield,
  CheckCircle,
  Menu,
  X
} from 'lucide-react'

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  videoSrc: string;
}

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const [playingVideos, setPlayingVideos] = useState<Set<number>>(new Set())
  const testimonialSectionRef = useRef<HTMLDivElement>(null)
  const heroSectionRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { currentUser, loading } = useMySQLAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleLogin = () => {
    navigate('/auth')
  }

  // If user is already logged in, redirect to dashboard
  React.useEffect(() => {
    if (currentUser) {
      navigate('/')
    }
  }, [currentUser, navigate])

  // Set up intersection observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set(prev).add(entry.target.id))
          }
        })
      },
      { threshold: 0.1 }
    )

    // Observe all sections with animation
    const sections = document.querySelectorAll('[data-animate]')
    sections.forEach((section) => {
      observerRef.current?.observe(section)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  const products = [
    {
      icon: <Clock className="h-8 w-8 text-blue-600" />,
      title: "Time Tracking",
      description: "Track work hours with our intuitive timer and timesheet system. Perfect for freelancers, teams, and agencies.",
      features: [
        "One-click timer",
        "Manual time entry",
        "Calendar integration",
        "Mobile apps"
      ]
    },
    {
      icon: <Building2 className="h-8 w-8 text-green-600" />,
      title: "Project Management",
      description: "Organize projects, track progress, and manage client relationships with our comprehensive project management tools.",
      features: [
        "Project organization",
        "Client management",
        "Progress tracking",
        "Task management"
      ]
    },
    {
      icon: <Users className="h-8 w-8 text-purple-600" />,
      title: "Team Collaboration",
      description: "Manage team members, assign roles, and track productivity with comprehensive team analytics and reporting.",
      features: [
        "Team member roles",
        "Productivity tracking",
        "Team analytics",
        "Performance insights"
      ]
    }
  ]

  const stats = [
    { number: '10,000+', label: 'Hours Tracked' },
    { number: '500+', label: 'Active Users' },
    { number: '99.9%', label: 'Uptime' },
    { number: '4.8★', label: 'User Rating' }
  ]

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6 text-blue-600" />,
      title: 'Advanced Analytics',
      description: 'Get detailed insights with comprehensive reports and charts to make better business decisions.'
    },
    {
      icon: <Shield className="h-6 w-6 text-green-600" />,
      title: 'Enterprise Security',
      description: 'Enterprise-grade security with data encryption and compliance with industry standards.'
    },
    {
      icon: <Users className="h-6 w-6 text-purple-600" />,
      title: 'Team Management',
      description: 'Manage teams, assign roles, and track team productivity with comprehensive analytics.'
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-yellow-600" />,
      title: 'Billing & Invoicing',
      description: 'Generate professional invoices, track revenue, and manage client billing.'
    }
  ]

  const testimonials: Testimonial[] = [
    {
      name: 'Sarah Johnson',
      role: 'Project Manager',
      company: 'TechCorp',
      content: 'NexiFlow has revolutionized how we track time and manage projects. The team productivity insights are invaluable.',
      rating: 5,
      videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999cfd073a8495f38522.mp4'
    },
    {
      name: 'Mike Williams',
      role: 'Freelance Developer',
      company: 'Independent',
      content: 'The billing features are fantastic. I can easily generate invoices and track my revenue. Highly recommended!',
      rating: 5,
      videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999c73043a46935b1b48.mp4'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Agency Owner',
      company: 'Creative Agency',
      content: 'Perfect for managing multiple clients and teams. The reporting features help us stay profitable.',
      rating: 5,
      videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999c82f4c53a10b84a9c.mp4'
    }
  ]

  const pricingPlans = [
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
      popular: false
    },
    {
      name: 'Office',
      price: '$9',
      period: 'per user/month',
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
      popular: true
    },
    {
      name: 'Enterprise',
      price: '$12',
      period: 'per user/month',
      description: 'For large organizations',
      features: [
        'Everything in Office',
        'Multiple Currencies',
        'Email Support',
        'Database Backups: backup database every 1hr (optional)',
        'Force Timer',
        'System Logs'
      ],
      popular: false
    }
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-[#020617]">
    {/* Shared background for HEADER + HERO */}
    <div className="pointer-events-none absolute inset-0 -z-10">
      {/* top-right glow */}
      <div className="absolute -top-40 right-[-80px] w-[300px] h-[300px] bg-blue-500/20 dark:bg-blue-700/30 rounded-full blur-[110px] sm:-top-56 sm:right-[-120px] sm:w-[480px] sm:h-[480px] sm:blur-[150px]" />
      {/* bottom-left glow */}
      <div className="absolute bottom-[-160px] left-[-100px] w-[320px] h-[320px] bg-indigo-400/20 dark:bg-indigo-600/30 rounded-full blur-[120px] sm:bottom-[-220px] sm:left-[-160px] sm:w-[520px] sm:h-[520px] sm:blur-[170px]" />
      {/* center glow */}
      <div className="absolute top-1/3 left-1/4 w-[260px] h-[260px] bg-purple-400/15 dark:bg-purple-500/20 rounded-full blur-[120px] sm:w-[360px] sm:h-[360px] sm:blur-[180px]" />
      {/* Additional glow with requested color */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#091845] blur-[120px] opacity-25"></div>
    </div>
      {/* Header */}
      <header className="bg-transparent relative z-50 pt-6 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative backdrop-blur-lg bg-white/35 dark:bg-gray-900/45 rounded-xl overflow-hidden">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/40 to-blue-200/40 dark:from-gray-600/50 dark:to-blue-900/50 p-0.5"></div>
            <div className="absolute inset-0 rounded-xl bg-white/20 dark:bg-gray-900/30 shadow-inner"></div>
            <div className="relative z-10 flex justify-between items-center py-4 px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
                    alt="NexiFlow Logo"
                    className="h-10 w-auto"
                  />
                </div>
                <div className="ml-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NexiFlow</h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Powered by Nexistry Digital Solutions</p>
                </div>
              </div>
              <div className="hidden lg:flex items-center space-x-8">
                <a 
                  href="#features" 
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('features');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="relative z-10">Features</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
                <a 
                  href="#pricing" 
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('pricing');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="relative z-10">Pricing</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
                <a 
                  href="#testimonials" 
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('testimonials');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <span className="relative z-10">Reviews</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
                <a href="/about" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group">
                  <span className="relative z-10">About</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <button
                  onClick={handleLogin}
                  className="hidden sm:block text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group"
                >
                  <span className="relative z-10">Log In</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </button>
                <button
                  onClick={() => navigate('/super-admin-signup')}
                  className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg hidden sm:flex overflow-hidden relative group"
                >
                  <span className="relative z-10 flex items-center">
                    <span className="hidden sm:inline">Access NexiFlow</span>
                    <span className="sm:hidden">Sign In</span>
                    <ArrowRight className="ml-2 transition-transform duration-300 group-hover:translate-x-1 w-4 h-4" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </button>
              </div>
              <div className="-mr-2 flex items-center sm:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <span className="sr-only">Open main menu</span>
                  <Menu className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-0 inset-x-0 z-50 bg-white dark:bg-gray-900 shadow-lg">
            <div className="pt-5 pb-6 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <img
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
                    alt="NexiFlow Logo"
                    className="h-8 w-auto"
                  />
                </div>
                <div className="-mr-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="sr-only">Close main menu</span>
                    <X className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-6">
                <nav className="grid gap-y-8">
                  <a 
                    href="#features" 
                    className="-m-3 p-3 flex items-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 group" 
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileMenuOpen(false);
                      const element = document.getElementById('features');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <span className="ml-3 text-base font-medium text-gray-900 dark:text-white relative">
                      Features
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </span>
                  </a>
                  <a 
                    href="#pricing" 
                    className="-m-3 p-3 flex items-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 group" 
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileMenuOpen(false);
                      const element = document.getElementById('pricing');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <span className="ml-3 text-base font-medium text-gray-900 dark:text-white relative">
                      Pricing
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </span>
                  </a>
                  <a 
                    href="#testimonials" 
                    className="-m-3 p-3 flex items-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 group" 
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileMenuOpen(false);
                      const element = document.getElementById('testimonials');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <span className="ml-3 text-base font-medium text-gray-900 dark:text-white relative">
                      Reviews
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </span>
                  </a>
                  <a href="/about" className="-m-3 p-3 flex items-center rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 group" onClick={() => setMobileMenuOpen(false)}>
                    <span className="ml-3 text-base font-medium text-gray-900 dark:text-white relative">
                      About
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                    </span>
                  </a>
                </nav>
              </div>
            </div>
            <div className="py-6 px-5 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <button
                  onClick={handleLogin}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer transition-colors relative group"
                >
                  <span className="relative z-10">Log In</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </button>
                <button
                  onClick={() => navigate('/super-admin-signup')}
                  className="ml-4 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg overflow-hidden relative group"
                >
                  <span className="relative z-10 flex items-center">
                    Access NexiFlow
                    <ArrowRight className="ml-2 transition-transform duration-300 group-hover:translate-x-1 w-4 h-4" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section 
  ref={heroSectionRef}
  className="relative z-20 min-h-[70vh] flex items-center justify-center px-4 py-16 sm:py-20 overflow-hidden sm:h-[73vh]"
>
  {/* Glow orbs effect */}
  <div className="absolute inset-0 pointer-events-none">
    {/* Central orb */}
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#091845] blur-[120px] opacity-40"></div>
    {/* Secondary orbs */}
    <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-blue-500 blur-[100px] opacity-30"></div>
    <div className="absolute bottom-1/3 right-1/4 w-[250px] h-[250px] rounded-full bg-indigo-500 blur-[100px] opacity-25"></div>
  </div>
  
  {/* subtle UI card outlines - hidden on mobile for better performance */}
  <div className="absolute top-16 left-16 w-40 h-28 border border-gray-900/5 dark:border-white/5 rounded-xl backdrop-blur-sm hidden sm:block sm:w-80 sm:h-52 sm:rounded-2xl"></div>
  <div className="absolute bottom-16 right-16 w-36 h-24 border border-gray-900/5 dark:border-white/5 rounded-xl backdrop-blur-sm hidden sm:block sm:w-72 sm:h-48 sm:rounded-2xl"></div>

  {/* HERO CONTENT */}
  <div className="relative z-10 text-center max-w-3xl flex flex-col items-center justify-center w-full">
    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 sm:text-5xl sm:mb-6 md:text-6xl">
      Work Smarter, Not Harder
    </h1>
    <p className="text-base text-gray-600 dark:text-gray-300 mb-8 px-2 sm:text-lg sm:mb-10 md:text-xl">
      The all-in-one platform for time tracking, project management, and team collaboration.
    </p>
    <button 
      onClick={() => navigate('/super-admin-signup')}
      className="relative backdrop-blur-lg bg-white/35 dark:bg-gray-900/45 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:bg-white/45 dark:hover:bg-gray-900/55 flex items-center group overflow-hidden sm:px-8 sm:py-3 sm:text-lg sm:rounded-xl"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/40 to-blue-200/40 dark:from-gray-600/50 dark:to-blue-900/50 p-0.5"></div>
      <div className="absolute inset-0 rounded-xl bg-white/20 dark:bg-gray-900/30 shadow-inner"></div>
      <span className="relative z-10 flex items-center">
        Start Free
        <ArrowRight className="ml-2 transition-all duration-300 transform group-hover:translate-x-2 w-4 h-4 sm:w-5 sm:h-5" />
      </span>
    </button>
  </div>
</section>


      {/* Stats Section */}
      <section 
        id="stats-section" 
        data-animate="true"
        className={`py-12 bg-white dark:bg-[#020617] border-y border-gray-100 dark:border-gray-800 transition-all duration-700 ease-out ${
          visibleSections.has('stats-section') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center transition-all duration-500 delay-${index * 100} ease-out ${
                  visibleSections.has('stats-section') 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-5'
                }`}
              >
                <div className="text-3xl font-bold text-blue-600 mb-1">{stat.number}</div>
                <div className="text-gray-900 dark:text-gray-300 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Features Section - Added per user request */}
      <section 
        id="enhanced-features" 
        data-animate="true"
        className={`enhanced-features py-20 bg-gray-50 dark:bg-gray-800 transition-all duration-700 ease-out relative overflow-hidden ${
          visibleSections.has('enhanced-features') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        {/* Subtle background elements */}
        <div className="absolute top-[-100px] right-[-60px] w-[300px] h-[300px] bg-blue-500/10 dark:bg-blue-700/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-100px] left-[-60px] w-[280px] h-[280px] bg-indigo-400/10 dark:bg-indigo-600/15 rounded-full blur-[100px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            Everything you need in one place
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-center mb-16">
            Track time, manage projects, handle billing, and get insights—all seamlessly integrated
          </p>
          
          <div className="enhanced-features-grid space-y-12">
            {/* Feature 1 */}
            <div 
              className={`enhanced-feature-card bg-white dark:bg-gray-700 rounded-xl shadow-sm p-8 hover:shadow-lg transition-all duration-200 hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50 hover:-translate-y-1 flex flex-col lg:flex-row gap-8 transition-all duration-500 ease-out ${
                visibleSections.has('enhanced-features') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="feature-content lg:w-1/2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Track work hours easily</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Track work hours across projects with our intuitive timer and timesheet system. Start and stop timers with one click, or manually log hours. View detailed timesheets and export data for payroll and billing.</p>
                <p className="text-gray-600 dark:text-gray-300 mb-6">The platform is very visual so you can see at a glance where your team stands with their work. Plus, it's super flexible and can suit any workflow.</p>
                <a href="/about" className="feature-cta inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200">
                  See Time Tracking
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M8 0L6.59 1.41L12.17 7H0V9H12.17L6.59 14.59L8 16L16 8L8 0Z" fill="currentColor"></path>
                  </svg>
                </a>
              </div>
              <div className="feature-image-container lg:w-1/2">
                <img src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692962056c98c803f72c9ea6.png" alt="Track work hours easily" className="feature-image rounded-lg w-full" />
              </div>
            </div>
            
            {/* Feature 2 */}
            <div 
              className={`enhanced-feature-card bg-white dark:bg-gray-700 rounded-xl shadow-sm p-8 hover:shadow-lg transition-all duration-200 hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50 hover:-translate-y-1 flex flex-col lg:flex-row gap-8 transition-all duration-500 ease-out delay-100 ${
                visibleSections.has('enhanced-features') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="feature-content lg:w-1/2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Manage teams and projects</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Manage teams, assign roles, and track team productivity with comprehensive analytics. Organize projects, track progress, and manage client relationships effectively.</p>
                <p className="text-gray-600 dark:text-gray-300 mb-6">Get a complete view of your team's performance, project status, and client interactions all in one place.</p>
                <a href="/about" className="feature-cta inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200">
                  See Team Management
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M8 0L6.59 1.41L12.17 7H0V9H12.17L6.59 14.59L8 16L16 8L8 0Z" fill="currentColor"></path>
                  </svg>
                </a>
              </div>
              <div className="feature-image-container lg:w-1/2">
                <img src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205bc52feedbaf3cccd.png" alt="Manage teams and projects" className="feature-image rounded-lg w-full" />
              </div>
            </div>
            
            {/* Feature 3 */}
            <div 
              className={`enhanced-feature-card bg-white dark:bg-gray-700 rounded-xl shadow-sm p-8 hover:shadow-lg transition-all duration-200 hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50 hover:-translate-y-1 flex flex-col lg:flex-row gap-8 transition-all duration-500 ease-out delay-200 ${
                visibleSections.has('enhanced-features') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="feature-content lg:w-1/2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Billing and analytics</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Generate invoices, track revenue, and manage client billing with detailed reports. Get insights with detailed reports, charts, and analytics for better decision making.</p>
                <p className="text-gray-600 dark:text-gray-300 mb-6">Turn tracked time into invoices automatically, track payments, and analyze your business performance with comprehensive reporting tools.</p>
                <a href="/about" className="feature-cta inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200">
                  See Billing &amp; Analytics
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M8 0L6.59 1.41L12.17 7H0V9H12.17L6.59 14.59L8 16L16 8L8 0Z" fill="currentColor"></path>
                  </svg>
                </a>
              </div>
              <div className="feature-image-container lg:w-1/2">
                <img src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205974316c65856f1e1.png" alt="Billing and analytics" className="feature-image rounded-lg w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features" 
        data-animate="true"
        className={`py-20 bg-white dark:bg-gray-900 transition-all duration-700 ease-out ${
          visibleSections.has('features') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful features for every team
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              From time tracking to team management, billing to analytics - NexiFlow provides all the tools you need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`text-center bg-white dark:bg-gray-800 rounded-xl p-6 transition-all duration-700 ease-out ${
                  visibleSections.has('features') 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                <div className={`bg-blue-50 dark:bg-gray-800 w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto transition-all duration-500 ${visibleSections.has('features') ? 'scale-100' : 'scale-0'}`} 
                     style={{ transitionDelay: `${index * 200 + 100}ms` }}>
                  {feature.icon}
                </div>
                <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-all duration-500 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                    style={{ transitionDelay: `${index * 200 + 200}ms` }}>
                  {feature.title}
                </h3>
                <p className={`text-gray-600 dark:text-gray-400 text-sm transition-all duration-500 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                   style={{ transitionDelay: `${index * 200 + 300}ms` }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Videos Section */}
      <section 
        id="videos" 
        data-animate="true"
        className={`py-20 bg-white dark:bg-[#020617] border-y border-gray-100 dark:border-gray-800 transition-all duration-700 ease-out relative overflow-hidden ${
          visibleSections.has('videos') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        {/* Subtle background elements */}
        <div className="absolute top-[-120px] right-[-80px] w-[350px] h-[350px] bg-blue-500/10 dark:bg-blue-700/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-120px] left-[-80px] w-[330px] h-[330px] bg-indigo-400/10 dark:bg-indigo-600/15 rounded-full blur-[120px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              See NexiFlow in Action
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Watch our product demos and tutorials to learn how NexiFlow can transform your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Video 1 */}
            <div className={`bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden transition-all duration-500 ease-out hover:shadow-lg hover:-translate-y-1 group ${
              visibleSections.has('videos') 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-5'
            }`}>
              <div className="relative pb-[56.25%] h-0 rounded-t-xl overflow-hidden"> {/* 16:9 Aspect Ratio */}
                {playingVideos.has(1) ? (
                  <iframe
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f91080b5011fa1cb11c7f.mp4"
                    className="absolute inset-0 w-full h-full rounded-t-xl"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Client Navigation Demo"
                  ></iframe>
                ) : (
                  <>
                    <img 
                      src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692962056c98c803f72c9ea6.png" 
                      alt="Client Navigation Demo" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div 
                      className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center cursor-pointer"
                      onClick={() => setPlayingVideos(prev => new Set(prev).add(1))}
                    >
                      <div className="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center hover:bg-blue-700 transition-colors">
                        <Play className="text-white w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-6 relative">
                <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300 -z-10"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Client Navigation</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Learn how to efficiently navigate and manage your clients within NexiFlow.</p>
                <div 
                  onClick={() => navigate('/about')}
                  className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                >
                  <span>Watch Video</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* Video 2 */}
            <div className={`bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden transition-all duration-500 ease-out hover:shadow-lg hover:-translate-y-1 group delay-100 ${
              visibleSections.has('videos') 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-5'
            }`}>
              <div className="relative pb-[56.25%] h-0 rounded-t-xl overflow-hidden"> {/* 16:9 Aspect Ratio */}
                {playingVideos.has(2) ? (
                  <iframe
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f91082b865e73be752614.mp4"
                    className="absolute inset-0 w-full h-full rounded-t-xl"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Task Management Demo"
                  ></iframe>
                ) : (
                  <>
                    <img 
                      src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205bc52feedbaf3cccd.png" 
                      alt="Task Management Demo" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div 
                      className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center cursor-pointer"
                      onClick={() => setPlayingVideos(prev => new Set(prev).add(2))}
                    >
                      <div className="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center hover:bg-blue-700 transition-colors">
                        <Play className="text-white w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-6 relative">
                <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300 -z-10"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Task Management</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Master task creation, assignment, and tracking to boost team productivity.</p>
                <div 
                  onClick={() => navigate('/about')}
                  className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                >
                  <span>Watch Video</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* Video 3 */}
            <div className={`bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden transition-all duration-500 ease-out hover:shadow-lg hover:-translate-y-1 group delay-200 ${
              visibleSections.has('videos') 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-5'
            }`}>
              <div className="relative pb-[56.25%] h-0 rounded-t-xl overflow-hidden"> {/* 16:9 Aspect Ratio */}
                {playingVideos.has(3) ? (
                  <iframe
                    src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f9108fd073a8a8df243fd.mp4"
                    className="absolute inset-0 w-full h-full rounded-t-xl"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Teams Management Demo"
                  ></iframe>
                ) : (
                  <>
                    <img 
                      src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205974316c65856f1e1.png" 
                      alt="Teams Management Demo" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div 
                      className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center cursor-pointer"
                      onClick={() => setPlayingVideos(prev => new Set(prev).add(3))}
                    >
                      <div className="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center hover:bg-blue-700 transition-colors">
                        <Play className="text-white w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-6 relative">
                <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300 -z-10"></div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Teams Management</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Learn how to organize teams, assign roles, and track performance.</p>
                <div 
                  onClick={() => navigate('/about')}
                  className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                >
                  <span>Watch Video</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/about')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              View All Videos
              <ArrowRight className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section 
        id="testimonials" 
        data-animate="true"
        ref={testimonialSectionRef}
        className={`py-20 bg-gray-50 dark:bg-gray-900 transition-all duration-700 ease-out overflow-hidden relative ${
          visibleSections.has('testimonials') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        <style>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .flip-card {
            width: 100%;
            height: 100%;
          }
          .flip-card-inner {
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.8s;
            transform-style: preserve-3d;
          }
          .flip-card:hover .flip-card-inner {
            transform: rotateY(180deg);
          }
          .flip-card-front, .flip-card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }
          .flip-card-back {
            transform: rotateY(180deg);
          }
        `}</style>
        {/* Static glowing orbs in the background */}
        <div className="absolute w-64 h-64 rounded-full opacity-20 pointer-events-none" style={{ left: '20%', top: '30%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0) 70%)' }}></div>
        <div className="absolute w-64 h-64 rounded-full opacity-20 pointer-events-none" style={{ left: '80%', top: '70%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0) 70%)' }}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by teams worldwide
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              See what our users say about NexiFlow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className={`relative h-80 perspective-1000 ${
                  visibleSections.has('testimonials') 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-5'
                }`}
              >
                <div className="flip-card h-full transition-all duration-500 delay-${index * 100} ease-out">
                  <div className="flip-card-inner h-full transition-transform duration-700 ease-in-out rounded-xl">
                    {/* Front - Testimonial Content */}
                    <div className="flip-card-front bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm h-full flex flex-col justify-between group border-2 border-transparent">
                      <div>
                        <div className="flex items-center mb-4">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                          ))}
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 italic">"{testimonial.content}"</p>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm">{testimonial.role} at {testimonial.company}</div>
                      </div>
                      <div className="absolute inset-0 rounded-xl transition-all duration-300 group-hover:shadow-lg group-hover:border-blue-500 group-hover:shadow-blue-500/30"></div>
                    </div>
                    
                    {/* Back - Video Content */}
                    <div className="flip-card-back bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg h-full border-2 border-blue-500 shadow-blue-500/30">
                      <div className="relative h-full rounded-lg overflow-hidden">
                        {testimonial.videoSrc.endsWith('.mp4') ? (
                          <video 
                            src={testimonial.videoSrc}
                            className="absolute inset-0 w-full h-full rounded-lg object-contain bg-black"
                            controls
                            playsInline
                          />
                        ) : (
                          <img 
                            src={testimonial.videoSrc}
                            alt={`Testimonial from ${testimonial.name}`}
                            className="absolute inset-0 w-full h-full rounded-lg object-contain bg-black"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section 
        id="pricing" 
        data-animate="true"
        className={`py-20 bg-gray-100 dark:bg-gray-800 transition-all duration-700 ease-out ${
          visibleSections.has('pricing') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Choose the plan that's right for your team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-xl shadow-lg pt-10 p-8 transition-all duration-500 delay-${index * 100} ease-out backdrop-blur-lg bg-gradient-to-br from-white/40 to-blue-50/40 dark:from-gray-800/50 dark:to-gray-900/50 border border-white/30 dark:border-gray-700/50 hover:shadow-xl flex flex-col h-full ${
                  visibleSections.has('pricing') 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-5'
                }`}
              >
                {/* Inner glow effect */}
                <div className="absolute inset-0 rounded-xl pointer-events-none bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10"></div>
                <div className="relative z-10">

                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.price}
                    {plan.price !== 'Custom' && (
                      <span className="text-lg font-normal text-gray-600 dark:text-gray-400">/{plan.period}</span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">{plan.description}</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleLogin}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg overflow-hidden relative group mt-auto ${plan.popular
                      ? 'backdrop-blur-lg bg-blue-600/35 hover:bg-blue-700 text-white'
                      : 'backdrop-blur-lg bg-gray-100/35 dark:bg-gray-600/35 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-900 dark:text-white'
                    }`}
                >
                  <span className="relative z-10">
                    Get Started
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </button>
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        id="cta" 
        data-animate="true"
        className={`py-20 bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 transition-all duration-700 ease-out relative overflow-hidden ${
          visibleSections.has('cta') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10'
        }`}
      >
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/3 right-1/3 w-48 h-48 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to boost your productivity?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of teams already using NexiFlow to track time, manage projects, and grow their business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/super-admin-signup')}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 rounded-lg text-base font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center group"
            >
              Start Free
              <ArrowRight className="ml-2 transition-all duration-300 transform group-hover:translate-x-1 w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                <Clock className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">NexiFlow</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                The most popular time tracker for teams. Track time, manage projects, and grow your business with powerful insights.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Twitter</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Facebook</a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="/about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 NexiFlow. All rights reserved. Powered by Nexistry Digital Solutions</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing