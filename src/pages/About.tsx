import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { 
  Clock, 
  Users, 
  BarChart3, 
  DollarSign, 
  Shield, 
  Zap, 
  Target, 
  Award,
  Globe,
  Heart,
  Code,
  Lightbulb,
  Play,
  Square,
  Calendar,
  FolderOpen,
  MessageSquare,
  Settings,
  CheckSquare,
  Building2,
  UserCheck,
  FileText,
  Download,
  Filter,
  Search,
  Bell,
  Sun,
  Moon,
  ArrowRight,
  Menu,
  X
} from 'lucide-react'

const About = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set())
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])
  const navigate = useNavigate()
  const { currentUser, loading } = useMySQLAuth()
  const { isDarkMode, toggleDarkMode } = useTheme()

  const handleLogin = () => {
    navigate('/auth')
  }

  // Handle scroll animations for step containers
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute('data-step-index'))
          if (entry.isIntersecting) {
            setVisibleSteps(prev => new Set(prev).add(index))
          } else {
            setVisibleSteps(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              return newSet
            })
          }
        })
      },
      { threshold: 0.1 }
    )

    stepRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => {
      stepRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref)
      })
    }
  }, [])

  const howItWorks = [
    {
      step: "01",
      icon: <Play className="h-8 w-8 text-blue-600" />,
      title: "Start Tracking Time",
      description: "Click the play button to start tracking time for any project. The timer runs in real-time and automatically saves your work.",
      details: [
        "Select a project from your list",
        "Add a description of what you're working on",
        "Mark as billable if applicable",
        "Add tags for better organization",
        "Click play to start the timer"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692962056c98c803f72c9ea6.png" // Replace with your actual image URL
    },
    {
      step: "02",
      icon: <FolderOpen className="h-8 w-8 text-green-600" />,
      title: "Manage Projects & Clients",
      description: "Create and organize projects with clients, set priorities, and track progress through different status stages.",
      details: [
        "Create new projects with descriptions",
        "Assign projects to specific clients",
        "Set project priorities and deadlines",
        "Track project status and progress",
        "Organize with color coding"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692e6d5cfd073afb90c2989c.png" // Replace with your actual image URL
    },
    {
      step: "03",
      icon: <Calendar className="h-8 w-8 text-purple-600" />,
      title: "View Your Calendar",
      description: "See all your time entries in a beautiful calendar view with month, week, and day perspectives.",
      details: [
        "Switch between month, week, and day views",
        "See time entries color-coded by project",
        "Click on any day to view detailed entries",
        "Filter by projects or billable status",
        "Track daily and weekly totals"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692fcf2004f2634739ce0b66.png" // Replace with your actual image URL
    },
    {
      step: "04",
      icon: <CheckSquare className="h-8 w-8 text-orange-600" />,
      title: "Manage Tasks",
      description: "Create and organize tasks using our Kanban board system. Assign tasks to team members and track progress.",
      details: [
        "Create tasks with descriptions and due dates",
        "Organize tasks in columns by status",
        "Assign tasks to team members",
        "Add comments and file attachments",
        "Use @mentions to notify team members"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692fcf2004f263fc0ece0b67.png" // Replace with your actual image URL
    },
    {
      step: "05",
      icon: <Users className="h-8 w-8 text-indigo-600" />,
      title: "Collaborate with Teams",
      description: "Invite team members, assign roles, and work together on projects with real-time messaging and notifications.",
      details: [
        "Create teams and invite members",
        "Set different permission levels",
        "Chat with team members in real-time",
        "Share files and documents",
        "Get notified of important updates"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205bc52feedbaf3cccd.png" // Replace with your actual image URL
    },
    {
      step: "06",
      icon: <BarChart3 className="h-8 w-8 text-red-600" />,
      title: "Analyze & Report",
      description: "Generate detailed reports, view analytics, and export data to understand productivity and billing.",
      details: [
        "View time summaries and productivity insights",
        "Generate detailed reports for clients",
        "Export data to PDF or CSV",
        "Track earnings and billable hours",
        "Analyze team performance"
      ],
      imageUrl: "https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205974316c65856f1e1.png" // Replace with your actual image URL
    }
  ]

  const keyFeatures = [
    {
      icon: <Clock className="h-6 w-6 text-blue-600" />,
      title: "Real-Time Timer",
      description: "Start and stop timers with one click. Time continues even if you close the browser."
    },
    {
      icon: <Calendar className="h-6 w-6 text-green-600" />,
      title: "Visual Calendar",
      description: "See all your time entries in an intuitive calendar with month, week, and day views."
    },
    {
      icon: <CheckSquare className="h-6 w-6 text-purple-600" />,
      title: "Task Management",
      description: "Organize work with Kanban boards, assign tasks, and track progress with due dates."
    },
    {
      icon: <MessageSquare className="h-6 w-6 text-orange-600" />,
      title: "Team Chat",
      description: "Communicate with your team through real-time messaging and file sharing."
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-red-600" />,
      title: "Analytics & Reports",
      description: "Get insights into productivity, time distribution, and team performance with detailed reports."
    },
    {
      icon: <Bell className="h-6 w-6 text-indigo-600" />,
      title: "Smart Notifications",
      description: "Stay updated with real-time notifications for mentions, task assignments, and deadlines."
    },
    {
      icon: <Download className="h-6 w-6 text-gray-600" />,
      title: "Export & Backup",
      description: "Export your data to PDF or CSV formats for external use and backup purposes."
    }
  ]

  const userRoles = [
    {
      role: "Employee",
      icon: <UserCheck className="h-6 w-6 text-blue-600" />,
      permissions: [
        "Track time on assigned projects",
        "View and update own tasks",
        "Access team chat and messaging",
        "View personal reports and analytics",
        "Update profile and preferences"
      ]
    },
    {
      role: "HR Manager",
      icon: <Users className="h-6 w-6 text-green-600" />,
      permissions: [
        "All employee permissions",
        "View team time entries and reports",
        "Manage team members and assignments",
        "Access team performance analytics",
        "Create and manage teams"
      ]
    },
    {
      role: "Admin",
      icon: <Settings className="h-6 w-6 text-purple-600" />,
      permissions: [
        "All HR permissions",
        "Create and manage projects",
        "Manage clients",
        "Generate company-wide reports",
        "Configure system settings"
      ]
    },
    {
      role: "Super Admin",
      icon: <Shield className="h-6 w-6 text-red-600" />,
      permissions: [
        "All admin permissions",
        "Create new companies",
        "Manage billing and subscriptions",
        "Access system logs and analytics",
        "Configure global system settings"
      ]
    }
  ]

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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img 
                  src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                  alt="NexiFlow Logo" 
                  className="h-8 w-auto"
                />
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">NexiFlow</span>
              </div>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                <a href="#features" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Features
                </a>
                <a href="#how-it-works" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  How It Works
                </a>
                <a href="#pricing" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Pricing
                </a>
              </div>
            </div>
            <div className="flex items-center">
              {currentUser ? (
                <button
                  onClick={() => navigate('/')}
                  className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/auth?signup=super_admin')}
                    className="ml-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                  >
                    Get Started
                  </button>
                </>
              )}
              <button
                onClick={toggleDarkMode}
                className="ml-4 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
              >
                {isDarkMode ? (
                  <Sun className="h-6 w-6" />
                ) : (
                  <Moon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl dark:text-white">
              Time Tracking Made Simple
            </h1>
            <p className="mt-6 max-w-lg mx-auto text-xl text-gray-600 dark:text-gray-300">
              Streamline your workflow, boost productivity, and gain insights with our intuitive time tracking solution designed for teams of all sizes.
            </p>
            <div className="mt-10 flex justify-center gap-3">
              {!currentUser && (
                <>
                  <button
                    onClick={() => navigate('/auth?signup=super_admin')}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
                  >
                    Get Started Free
                  </button>
                  <button
                    onClick={handleLogin}
                    className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                  >
                    Sign In
                  </button>
                </>
              )}
              {currentUser && (
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-12 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">10,000+</div>
              <div className="mt-1 text-base font-medium text-gray-600 dark:text-gray-400">Hours Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">500+</div>
              <div className="mt-1 text-base font-medium text-gray-600 dark:text-gray-400">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">99.9%</div>
              <div className="mt-1 text-base font-medium text-gray-600 dark:text-gray-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">4.8★</div>
              <div className="mt-1 text-base font-medium text-gray-600 dark:text-gray-400">User Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div id="features" className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              Powerful Features
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 dark:text-gray-300 mx-auto">
              Everything you need to track time, manage projects, and collaborate with your team.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {keyFeatures.map((feature, index) => (
                <div 
                  key={index} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
                  data-step-index={index}
                  ref={el => stepRefs.current[index] = el}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{feature.title}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 dark:text-gray-300 mx-auto">
              Get started with NexiFlow in just a few simple steps.
            </p>
          </div>

          <div className="mt-16">
            <div className="space-y-16">
              {howItWorks.map((step, index) => (
                <div 
                  key={index} 
                  className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-8`}
                  data-step-index={index + 10}
                  ref={el => stepRefs.current[index + 10] = el}
                >
                  <div className="lg:w-1/2">
                    <div className="text-4xl font-bold text-gray-200 dark:text-gray-700 mb-2">{step.step}</div>
                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0">
                        {step.icon}
                      </div>
                      <h3 className="ml-3 text-2xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
                    </div>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                      {step.description}
                    </p>
                    <ul className="space-y-2">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
                              <CheckSquare className="h-3 w-3" />
                            </div>
                          </div>
                          <p className="ml-3 text-gray-600 dark:text-gray-400">{detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:w-1/2">
                    <div className="relative rounded-lg overflow-hidden shadow-lg">
                      <img 
                        src={step.imageUrl} 
                        alt={step.title} 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Roles Section */}
      <div className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
              Role-Based Access Control
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 dark:text-gray-300 mx-auto">
              Different permissions for different roles to ensure security and proper access.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {userRoles.map((role, index) => (
                <div 
                  key={index} 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
                  data-step-index={index + 20}
                  ref={el => stepRefs.current[index + 20] = el}
                >
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      {role.icon}
                    </div>
                    <h3 className="ml-3 text-lg font-medium text-gray-900 dark:text-white">{role.role}</h3>
                  </div>
                  <ul className="space-y-2">
                    {role.permissions.map((permission, permIndex) => (
                      <li key={permIndex} className="flex items-start">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
                            <CheckSquare className="h-3 w-3" />
                          </div>
                        </div>
                        <p className="ml-3 text-sm text-gray-600 dark:text-gray-400">{permission}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-700">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block text-primary-200">Start your free trial today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <button
                onClick={() => navigate('/auth?signup=super_admin')}
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50"
              >
                Get started
              </button>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <button
                onClick={handleLogin}
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-500 bg-opacity-60 hover:bg-opacity-50"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center">
                <img 
                  src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg" 
                  alt="NexiFlow Logo" 
                  className="h-8 w-auto"
                />
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">NexiFlow</span>
              </div>
              <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
                Time tracking made simple. Boost productivity and gain insights with our intuitive platform.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wider uppercase">
                Product
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wider uppercase">
                Support
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="text-base text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8 md:flex md:items-center md:justify-between">
            <div className="flex space-x-6 md:order-2">
              <a href="#" className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300">
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
            <p className="mt-8 text-base text-gray-600 dark:text-gray-400 md:mt-0 md:order-1">
              &copy; 2024 NexiFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default About