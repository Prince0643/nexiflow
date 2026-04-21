import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  Play,
  Shield,
  Star,
  Users,
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import PublicNavbar from '../components/PublicNavbar'
import PublicFooter from '../components/PublicFooter'
import {
  enhancedFeatures,
  featureHighlights,
  navLinks,
  pricingPlans,
  stats,
  testimonials,
  videoDemos
} from '../data/landingContent'

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
      <PublicNavbar
        links={navLinks}
        onLinkClick={scrollToSection}
        onLogin={handleLogin}
        onAccess={handleAccess}
        extraLink={{ label: 'About', onClick: handleAbout }}
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
      <PublicFooter />
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

const HeroSection = ({ onPrimaryAction, onWatchDemo }: { onPrimaryAction: () => void; onWatchDemo: () => void }) => {
  const { ref, visible } = useRevealOnScroll({ threshold: 0.3 })

  return (
    <section
      ref={ref}
      className="relative overflow-hidden px-4 py-16 sm:py-20 lg:min-h-[90vh] lg:flex lg:items-center lg:justify-center"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white dark:from-blue-900 dark:via-[#060b1d] dark:to-black opacity-100 dark:opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_55%)]/60 dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]/30" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,_transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,_transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.07)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,_transparent_1px)] bg-[length:72px_72px] sm:bg-[length:120px_120px]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 right-2 h-44 w-44 rounded-full bg-blue-500/30 blur-3xl sm:right-10 sm:h-56 sm:w-56" />
        <div className="absolute bottom-[-80px] left-0 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl sm:left-10 sm:h-72 sm:w-72" />
      </div>
      <div
        className={`relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center transition-all duration-700 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <p className="text-[11px] uppercase tracking-[0.45em] text-blue-700 dark:text-blue-300 sm:text-sm sm:tracking-[0.6em]">NEXIFLOW</p>
        <h1 className="mt-5 max-w-[12ch] text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:mt-6 sm:max-w-none sm:text-5xl lg:text-6xl">
          Work smarter, not harder
        </h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-slate-700 dark:text-blue-100 sm:text-base md:max-w-2xl md:text-lg">
          An all-in-one workspace for time tracking, project management, billing, and AI-powered assistant guidance.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
          <button
            onClick={onPrimaryAction}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-blue-700 dark:bg-white dark:text-blue-900 dark:hover:bg-blue-50 sm:w-auto"
          >
            Start Free
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onWatchDemo}
            className="w-full rounded-full border border-slate-900/20 px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-900/40 dark:border-white/60 dark:text-white/90 dark:hover:border-white sm:w-auto"
          >
            Watch Demo
          </button>
        </div>
        <div
          className={`mt-8 grid w-full max-w-sm grid-cols-2 gap-3 sm:mt-10 sm:max-w-2xl sm:grid-cols-4 sm:gap-4 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-900/10 bg-white/70 px-4 py-3 text-center text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur-md sm:rounded-full sm:px-5 sm:py-2 sm:text-[0.65rem] sm:tracking-[0.35em] dark:border-white/20 dark:bg-white/10 dark:text-white/85 dark:shadow-lg dark:backdrop-blur-xl"
            >
              <span className="block text-base font-bold text-slate-900 sm:text-lg dark:text-white">{stat.number}</span>
              <span className="block pt-1 text-[0.54rem] text-blue-700/80 sm:text-[0.65rem] dark:text-blue-100">{stat.label}</span>
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
      className={`px-4 py-14 sm:px-6 sm:py-16 lg:px-8 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Capabilities</p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Everything you need in one place</h2>
          <p className="max-w-3xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Track time, manage clients, handle billing, and get insights—without switching apps.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {enhancedFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg overflow-hidden border border-gray-100/80 dark:border-gray-800/70 flex flex-col"
            >
              <img src={feature.image} alt={feature.title} className="h-40 w-full object-cover sm:h-48" />
              <div className="flex flex-1 flex-col space-y-4 p-5 sm:p-6">
                <h3 className="text-lg font-semibold sm:text-xl">{feature.title}</h3>
                <p className="flex-1 text-sm text-gray-500 dark:text-gray-300 sm:text-base">{feature.description}</p>
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
      className="border-y border-gray-200/60 bg-gray-50 py-14 dark:border-gray-800/60 dark:bg-gray-900 sm:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Features</p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Powerful tools for every team</h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            From AI-assisted insights to full billing workflows, NexiFlow keeps every workflow on track.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featureHighlights.map((feature) => (
            <div
              key={feature.title}
              className={`rounded-3xl bg-white p-5 shadow transition-transform duration-500 dark:bg-gray-900 sm:p-6 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-gray-800/60 mb-4">
                <FeatureIcon iconKey={feature.iconKey} />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
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
      className="bg-white px-4 py-14 dark:bg-[#020617] sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Videos</p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">See NexiFlow in action</h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
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
              <div className="relative h-48 sm:h-52">
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
              <div className="space-y-3 p-5 sm:p-6">
                <h3 className="text-lg font-semibold sm:text-xl">{demo.title}</h3>
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
      className="bg-gray-50 px-4 py-14 text-gray-900 dark:bg-gradient-to-b dark:from-gray-900 dark:via-black dark:to-gray-900 dark:text-white sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-600 dark:text-blue-300">Testimonials</p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Trusted by teams worldwide</h2>
          <p className="max-w-3xl mx-auto text-sm text-gray-600 dark:text-blue-200 sm:text-base">
            Feedback from real users who rely on NexiFlow every day.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className={`flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition duration-500 dark:border-white/10 dark:bg-white/10 dark:shadow-none sm:p-6 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="flex items-center gap-2">
                {[...Array(testimonial.rating)].map((_, index) => (
                  <Star key={index} className="text-yellow-400 w-4 h-4" />
                ))}
              </div>
              <p className="text-sm italic leading-relaxed text-gray-700 dark:text-white/80">"{testimonial.content}"</p>
              <div>
                <p className="font-semibold">{testimonial.name}</p>
                <p className="text-xs text-gray-500 dark:text-white/60">
                  {testimonial.role} · {testimonial.company}
                </p>
              </div>
              <video
                src={testimonial.videoSrc}
                controls
                className="w-full rounded-2xl border border-gray-200 bg-black dark:border-white/20"
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
      className="bg-gray-100 px-4 py-14 dark:bg-gray-900 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.6em] text-blue-500">Pricing</p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Simple, transparent plans</h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Start free or upgrade when you need more controls, security, and analytics.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col gap-5 rounded-3xl border bg-white p-5 shadow-lg transition duration-500 dark:bg-gray-900 sm:gap-6 sm:p-6 ${
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
                <div className="text-3xl font-bold sm:text-4xl">
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
  <section className="bg-gradient-to-r from-blue-900 to-indigo-900 px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8">
    <div className="max-w-6xl mx-auto text-center space-y-5 sm:space-y-6">
      <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Ready to boost your productivity?</h2>
      <p className="text-sm text-blue-100 sm:text-lg">
        Join thousands of teams powering their workflows with NexiFlow.
      </p>
      <button
        onClick={onPrimaryAction}
        className="inline-flex w-full max-w-sm items-center justify-center gap-3 rounded-full bg-white px-8 py-3 text-base font-semibold text-blue-900 shadow-lg transition hover:bg-gray-100 sm:w-auto"
      >
        Start Free
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  </section>
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
