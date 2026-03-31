import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  Menu,
  Play,
  Shield,
  Star,
  Users,
  X
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import {
  enhancedFeatures,
  featureHighlights,
  navLinks,
  pricingPlans,
  stats,
  testimonials,
  videoDemos
} from '../data/landingContent'

interface LandingHeaderProps {
  onLinkClick: (sectionId: string) => void
  onLogin: () => void
  onAccess: () => void
  onAbout: () => void
}

const Landing = () => {
  const navigate = useNavigate()
  const { currentUser, loading } = useMySQLAuth()

  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true })
    }
  }, [currentUser, navigate])

  if (loading) {
    return <LoadingScreen />
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleLogin = () => navigate('/auth')
  const handleAccess = () => navigate('/super-admin-signup')
  const handleAbout = () => navigate('/about')

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-gray-900 dark:text-white">
      <LandingHeader
        onLinkClick={scrollToSection}
        onLogin={handleLogin}
        onAccess={handleAccess}
        onAbout={handleAbout}
      />
      <main className="relative">
        <HeroSection onPrimaryAction={handleAccess} onWatchDemo={() => scrollToSection('videos')} />
        <EnhancedFeaturesSection />
        <FeatureHighlightsSection />
        <VideosSection />
        <TestimonialsSection />
        <PricingSection onPlanSelect={handleAccess} />
        <CTASection onPrimaryAction={handleAccess} />
      </main>
      <LandingFooter />
    </div>
  )
}

export default Landing

const LoadingScreen = () => (
  <div className="min-h-screen grid place-items-center bg-white dark:bg-[#020617]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      <p className="text-gray-600 dark:text-gray-300">Loading...</p>
    </div>
  </div>
)

const LandingHeader = ({ onLinkClick, onAccess, onLogin, onAbout }: LandingHeaderProps) => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200/60 dark:border-gray-700/60">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
            alt="NexiFlow logo"
            className="h-10 w-auto"
          />
          <div>
            <p className="text-lg font-semibold tracking-tight">NexiFlow</p>
            <p className="text-xs text-gray-400">Powered by Nexistry Digital Solutions</p>
          </div>
        </div>
        <nav className="hidden lg:flex items-center gap-8 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-gray-600 dark:text-gray-300">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => onLinkClick(link.id)}
              className="transition-colors hover:text-blue-600"
            >
              {link.label}
            </button>
          ))}
          <button onClick={onAbout} className="transition-colors hover:text-blue-600">
            About
          </button>
        </nav>
        <div className="hidden sm:flex items-center gap-3">
          <button onClick={onLogin} className="text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:text-gray-900">
            Log In
          </button>
          <button
            onClick={onAccess}
            className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            Access NexiFlow
          </button>
        </div>
        <div className="lg:hidden flex items-center">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold tracking-[0.3em] uppercase text-gray-500">Menu</span>
            <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 pb-4 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  onLinkClick(link.id)
                  setMobileOpen(false)
                }}
                className="w-full text-left text-gray-700 dark:text-gray-200 font-semibold tracking-wide"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => {
                onAbout()
                setMobileOpen(false)
              }}
              className="w-full text-left text-gray-700 dark:text-gray-200 font-semibold tracking-wide"
            >
              About
            </button>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={onLogin} className="text-left text-gray-600 dark:text-gray-300 font-semibold">
                Log In
              </button>
              <button
                onClick={onAccess}
                className="px-4 py-2 rounded-full bg-blue-600 text-white font-semibold text-sm"
              >
                Access NexiFlow
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

const HeroSection = ({ onPrimaryAction, onWatchDemo }: { onPrimaryAction: () => void; onWatchDemo: () => void }) => {
  const { ref, visible } = useRevealOnScroll({ threshold: 0.3 })

  return (
    <section
      ref={ref}
      className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900 via-[#060b1d] to-black opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]/30" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,_transparent_1px)] bg-[length:120px_120px]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 right-10 w-56 h-56 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-80px] left-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>
      <div
        className={`relative z-10 max-w-4xl text-center space-y-6 -mt-10 sm:-mt-12 lg:-mt-16 transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <p className="text-sm uppercase tracking-[0.6em] text-blue-300">NEXIFLOW</p>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
          Work smarter, not harder
        </h1>
        <p className="text-base md:text-lg text-blue-200 max-w-2xl mx-auto">
          An all-in-one workspace for time tracking, project management, billing, and AI-powered assistant guidance.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-blue-900 font-semibold shadow-lg hover:bg-blue-50 transition"
          >
            Start Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onWatchDemo}
            className="px-6 py-3 rounded-full border border-white/60 text-white/80 text-sm font-semibold hover:border-white"
          >
            Watch Demo
          </button>
        </div>
      </div>
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <div
          className={`flex flex-wrap justify-center gap-4 px-4 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex-shrink-0 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-white/85 backdrop-blur shadow"
            >
              <span className="block text-lg font-bold">{stat.number}</span>
              <span className="text-blue-200">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const EnhancedFeaturesSection = () => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      ref={ref}
      className={`py-16 px-4 sm:px-6 lg:px-8 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Capabilities</p>
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need in one place</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Track time, manage clients, handle billing, and get insights—without switching apps.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {enhancedFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg overflow-hidden border border-gray-100/80 dark:border-gray-800/70 flex flex-col"
            >
              <img src={feature.image} alt={feature.title} className="w-full h-48 object-cover" />
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-300 flex-1">{feature.description}</p>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {feature.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FeatureHighlightsSection = () => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      id="features"
      ref={ref}
      className="py-20 bg-gray-50 dark:bg-gray-900 border-y border-gray-200/60 dark:border-gray-800/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold">Powerful tools for every team</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            From AI-assisted insights to full billing workflows, NexiFlow keeps every workflow on track.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featureHighlights.map((feature) => (
            <div
              key={feature.title}
              className={`rounded-3xl bg-white dark:bg-gray-900 p-6 shadow transition-transform duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-gray-800/60 mb-4">
                <FeatureIcon iconKey={feature.iconKey} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const VideosSection = () => {
  const { ref, visible } = useRevealOnScroll()
  const [playing, setPlaying] = useState<number | null>(null)

  return (
    <section
      id="videos"
      ref={ref}
      className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#020617]"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Videos</p>
          <h2 className="text-3xl md:text-4xl font-bold">See NexiFlow in action</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Product demos and walkthroughs so you can ramp up fast.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {videoDemos.map((demo, index) => (
            <div
              key={demo.title}
              className={`bg-white dark:bg-gray-900 rounded-3xl shadow-lg overflow-hidden border border-gray-100/80 dark:border-gray-800/70 transition-transform duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="relative h-52">
                {playing === index ? (
                  <video
                    src={demo.videoSrc}
                    controls
                    autoPlay
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <img src={demo.image} alt={demo.title} className="absolute inset-0 w-full h-full object-cover" />
                    <div
                      className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer"
                      onClick={() => setPlaying(index)}
                    >
                      <div className="bg-blue-600 rounded-full p-4">
                        <Play className="text-white w-5 h-5" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-xl font-semibold">{demo.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">{demo.description}</p>
                <button className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm">
                  Watch Video
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const TestimonialsSection = () => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      id="testimonials"
      ref={ref}
      className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-300">Testimonials</p>
          <h2 className="text-3xl md:text-4xl font-bold">Trusted by teams worldwide</h2>
          <p className="text-blue-200 max-w-3xl mx-auto">
            Feedback from real users who rely on NexiFlow every day.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className={`rounded-3xl bg-white/10 border border-white/10 p-6 flex flex-col gap-4 transition duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="flex items-center gap-2">
                {[...Array(testimonial.rating)].map((_, index) => (
                  <Star key={index} className="text-yellow-400 w-4 h-4" />
                ))}
              </div>
              <p className="text-sm italic leading-relaxed text-white/80">"{testimonial.content}"</p>
              <div>
                <p className="font-semibold">{testimonial.name}</p>
                <p className="text-xs text-white/60">
                  {testimonial.role} · {testimonial.company}
                </p>
              </div>
              <video
                src={testimonial.videoSrc}
                controls
                className="w-full rounded-2xl border border-white/20 bg-black"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const PricingSection = ({ onPlanSelect }: { onPlanSelect: () => void }) => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      id="pricing"
      ref={ref}
      className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-100 dark:bg-gray-900"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold">Simple, transparent plans</h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Start free or upgrade when you need more controls, security, and analytics.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-6 flex flex-col gap-6 shadow-lg bg-white dark:bg-gray-900 transition duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              } ${plan.popular ? 'border-blue-500/30 shadow-blue-500/30' : 'border-gray-200/70 dark:border-gray-800/70'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 right-4 rounded-full bg-blue-600 text-white text-xs px-3 py-1 uppercase">
                  Popular
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-gray-500 uppercase tracking-[0.4em]">{plan.name}</p>
                <div className="text-4xl font-bold">
                  {plan.price}
                  <span className="text-base font-medium text-gray-500 ml-1">/{plan.period}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{plan.description}</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-auto py-3 rounded-full font-semibold transition ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-white/80'
                }`}
                onClick={onPlanSelect}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const CTASection = ({ onPrimaryAction }: { onPrimaryAction: () => void }) => (
  <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
    <div className="max-w-6xl mx-auto text-center space-y-6">
      <h2 className="text-3xl md:text-4xl font-bold">Ready to boost your productivity?</h2>
      <p className="text-lg text-blue-100">
        Join thousands of teams powering their workflows with NexiFlow.
      </p>
      <button
        onClick={onPrimaryAction}
        className="inline-flex items-center gap-3 px-8 py-3 rounded-full bg-white text-blue-900 font-semibold shadow-lg hover:bg-gray-100 transition"
      >
        Start Free
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  </section>
)

const LandingFooter = () => (
  <footer className="bg-gray-900 text-white py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <img
            src="https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/68df3ae78db305b0e463f363.svg"
            alt="NexiFlow logo"
            className="h-6 w-auto"
          />
          <span className="text-lg font-semibold">NexiFlow</span>
        </div>
        <p className="text-sm text-gray-400">
          Trusted by teams who want better visibility into every billable minute.
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.4em] mb-3 text-gray-400">Product</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>Features</li>
          <li>Pricing</li>
          <li>Integrations</li>
          <li>API</li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.4em] mb-3 text-gray-400">Company</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>About</li>
          <li>Blog</li>
          <li>Careers</li>
          <li>Contact</li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.4em] mb-3 text-gray-400">Support</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>Help Center</li>
          <li>Documentation</li>
          <li>Community</li>
          <li>Status</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-gray-500">
      &copy; {new Date().getFullYear()} NexiFlow. All rights reserved.
    </div>
  </footer>
)

const FeatureIcon = ({ iconKey }: { iconKey: string }) => {
  switch (iconKey) {
    case 'analytics':
      return <BarChart3 className="h-5 w-5 text-blue-600" />
    case 'security':
      return <Shield className="h-5 w-5 text-green-500" />
    case 'team':
      return <Users className="h-5 w-5 text-purple-500" />
    case 'billing':
      return <CheckCircle className="h-5 w-5 text-yellow-500" />
    default:
      return <Building2 className="h-5 w-5 text-gray-500" />
  }
}
