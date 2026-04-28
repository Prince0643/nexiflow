import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Lock,
  MessageSquare,
  Play,
  Rocket,
  Sparkles,
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
        <ProofBandSection />
        <FeaturesSection />
        <HowItWorksSection />
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
  const { ref, visible } = useRevealOnScroll({ threshold: 0.25 })
  const [mockSeconds, setMockSeconds] = useState(3 * 60 * 60 + 18 * 60 + 42)

  useEffect(() => {
    const timer = window.setInterval(() => setMockSeconds((prev) => prev + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const mockTime = formatAsHhMmSs(mockSeconds)

  return (
    <section
      ref={ref}
      className="relative flex min-h-[calc(100vh-88px)] items-center overflow-hidden px-3 pb-8 pt-20 sm:min-h-[calc(100vh-96px)] sm:px-4 sm:pt-28 lg:px-8 lg:pb-12"
    >
      <div className="absolute inset-0 bg-[#f7fbff] dark:bg-[#020617]" />
      <div className="absolute inset-0 opacity-90 dark:opacity-100 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.18),transparent_60%),radial-gradient(circle_at_85%_75%,rgba(59,130,246,0.16),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,_transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,_transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.06)_1px,_transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,_transparent_1px)] bg-[length:72px_72px] sm:bg-[length:96px_96px]" />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div
          className={`grid items-center gap-8 lg:gap-12 lg:grid-cols-2 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="mx-auto flex w-full max-w-xl flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white/80 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.42em]">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-teal-400 to-blue-500" />
              NexiFlow Workspace
            </div>

            <h1 className="mt-5 font-bold leading-[1.05] tracking-tight text-slate-950 dark:text-white sm:mt-6 sm:leading-[1.04]">
              <span className="block text-[2.05rem] sm:text-5xl lg:text-6xl">Track work.</span>
              <span className="block text-[2.05rem] sm:text-5xl lg:text-6xl">Manage clients.</span>
              <span className="block text-[2.05rem] sm:text-5xl lg:text-6xl bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                Bill with confidence.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-700 dark:text-slate-200 sm:mt-5 sm:text-base sm:leading-8">
              NexiFlow is an all-in-one workspace for time tracking, project management, invoicing, and team collaboration—without switching apps.
            </p>

            <div className="mt-7 flex w-full flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
              <button
                onClick={onPrimaryAction}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-teal-500/10 transition hover:opacity-90 sm:w-auto sm:px-6 sm:py-3.5"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onWatchDemo}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-900/15 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white sm:w-auto sm:px-6 sm:py-3.5 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Play className="h-4 w-4" />
                Watch Demo
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-blue-600 text-white">
                  <CheckCircle className="h-3.5 w-3.5" />
                </span>
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-blue-600 text-white">
                  <CheckCircle className="h-3.5 w-3.5" />
                </span>
                Made for freelancers & small teams
              </div>
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-blue-600 text-white">
                  <CheckCircle className="h-3.5 w-3.5" />
                </span>
                Built by Nexistry Digital Solutions
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-md items-center justify-center sm:max-w-xl">
            <div className="relative w-full scale-[0.94] sm:scale-100 origin-top">
              <FloatingChip
                className="-top-6 right-16"
                icon={<Clock className="h-3.5 w-3.5" />}
                tone="teal"
                value={mockTime}
                label="Active Timer Running"
              />
              <FloatingChip
                className="-bottom-6 left-6"
                icon={<CreditCard className="h-3.5 w-3.5" />}
                tone="gold"
                value="Invoice Ready"
                label="Client Project · Billable"
              />
              <FloatingChip
                className="top-1/2 -right-4 hidden -translate-y-1/2 lg:flex"
                icon={<FileText className="h-3.5 w-3.5" />}
                tone="blue"
                value="4 Tasks Done"
                label="Today’s progress"
              />

              <div className="rounded-2xl border border-slate-900/10 bg-slate-950/90 shadow-2xl shadow-slate-900/20 backdrop-blur dark:border-white/10">
                <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                  </div>
                  <div className="ml-2 flex-1 rounded-md bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/50">
                    app.nexiflow.com/dashboard
                  </div>
                </div>

                <div className="grid min-h-[320px] grid-cols-[156px_1fr]">
                  <div className="border-r border-white/10 bg-black/25 p-3">
                    <div className="space-y-1">
                      {[
                        'Dashboard',
                        'Time Tracker',
                        'Projects',
                        'Clients',
                        'Invoices',
                        'Calendar',
                        'Reports',
                      ].map((item) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${
                            item === 'Dashboard' ? 'bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/20' : 'text-white/40 hover:bg-white/5 hover:text-white/65'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-teal-300">Active Timer</p>
                      <div className="mt-2 text-3xl font-bold tracking-[0.08em] text-white">{mockTime}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-teal-300/30 px-2.5 py-1 text-[10px] font-semibold text-teal-200">
                          In Progress
                        </span>
                        <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/60">
                          Client Project
                        </span>
                        <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/60">
                          Billable
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniBarCard title="Tasks" tone="teal" />
                      <MiniBarCard title="Invoice Ready" tone="blue" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const ProofBandSection = () => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      ref={ref}
      className={`border-y border-slate-900/10 bg-slate-50 px-4 py-10 dark:border-white/10 dark:bg-white/5 sm:px-6 sm:py-12 lg:px-8 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-900/10 dark:divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {[
          {
            headline: '$0',
            body: 'Start free and stay free as long as you need—no card required.',
          },
          {
            headline: '3-in-1',
            body: 'Time tracking, projects, and invoicing in one dashboard.',
          },
          {
            headline: 'AI Assist',
            body: 'Get guidance fast with built-in AI support inside your workflow.',
          },
          {
            headline: '99.9%',
            body: 'Reliable uptime so your team keeps flowing.',
          },
        ].map((item) => (
          <div key={item.headline} className="px-6 py-8 text-center sm:px-8">
            <div className="text-4xl font-bold tracking-tight text-transparent bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text">
              {item.headline}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/65">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const FeaturesSection = () => {
  const { ref, visible } = useRevealOnScroll()
  type FeatureCard = {
    title: string
    description: string
    pills: string[]
    icon: ReactNode
    tone: 'teal' | 'blue' | 'gold'
  }

  const featureCards: FeatureCard[] = [
    {
      title: 'Track Time Like a Pro',
      description:
        'Hit play. Walk away. NexiFlow keeps tracking even when your browser closes. Tag billable hours, log manually—your time, your rules.',
      pills: ['One-click start', 'Manual entry', 'Billable tagging'],
      icon: <Clock className="h-5 w-5" />,
      tone: 'teal',
    },
    {
      title: 'Run Projects Without the Panic',
      description:
        'Kanban boards, task priorities, client portals, deadlines—NexiFlow keeps your projects breathing. No more “where are we on this?” messages.',
      pills: ['Kanban board', 'Team permissions', 'Deadlines'],
      icon: <FileText className="h-5 w-5" />,
      tone: 'blue',
    },
    {
      title: 'Invoice. Get Paid. Repeat.',
      description:
        'Your tracked hours become a polished invoice in seconds—no math, no copy-paste. Export as PDF or CSV. Know your revenue before the email opens.',
      pills: ['Auto-invoice', 'PDF / CSV', 'Revenue analytics'],
      icon: <CreditCard className="h-5 w-5" />,
      tone: 'gold',
    },
    {
      title: 'Nexi — Your AI Teammate',
      description:
        'Lost? Stuck? Just ask Nexi. Your built-in AI answers questions about NexiFlow instantly—no ticket, no waiting. Support that never sleeps.',
      pills: ['Instant answers', 'Always-on 24/7'],
      icon: <MessageSquare className="h-5 w-5" />,
      tone: 'teal',
    },
    {
      title: 'See Your Week. Own It.',
      description:
        'A visual calendar showing exactly where your hours went—by day, week, or month. Color-coded per project so you never have to guess.',
      pills: ['Month view', 'Week view', 'Day view'],
      icon: <Clock className="h-5 w-5" />,
      tone: 'blue',
    },
    {
      title: 'Screenshot Proof, Zero Effort',
      description:
        'Auto-capture activity screenshots for client accountability. Syncs to Google Drive. Every billable hour, verified. Available on Enterprise.',
      pills: ['Auto-capture', 'Google Drive sync'],
      icon: <Lock className="h-5 w-5" />,
      tone: 'gold',
    },
    {
      title: 'Analytics That Actually Matter',
      description:
        'Know which projects drain your time and which ones print money. Deep reports on productivity and billing margins—no spreadsheet needed.',
      pills: ['Productivity reports', 'Billing margins'],
      icon: <BarChart3 className="h-5 w-5" />,
      tone: 'teal',
    },
    {
      title: 'Enterprise-Grade Security',
      description:
        'Role-based access, encrypted data, system logs, and daily backups. Your business is safe—even when you’re not watching.',
      pills: ['Role-based access', 'Daily backups'],
      icon: <Shield className="h-5 w-5" />,
      tone: 'blue',
    },
    {
      title: 'Your Team, One Workspace',
      description:
        'Invite your VA, teammate, or partner. Set roles, chat live, share files. Everyone moves together—or they don’t move at all.',
      pills: ['Invite members', 'Set roles', 'Live chat'],
      icon: <Users className="h-5 w-5" />,
      tone: 'gold',
    },
  ]

  return (
    <section
      id="features"
      ref={ref}
      className={`relative px-4 py-14 sm:px-6 sm:py-20 lg:px-8 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-teal-600 dark:text-teal-300">
            What NexiFlow Does
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Five apps. Killed.
            <br />
            One NexiFlow.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-white/70 sm:text-base">
            Your time tracker. Your project board. Your invoicing tool. Your AI support. Your calendar. All inside one dashboard—finally.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <div
              key={card.title}
              className="group relative rounded-2xl border border-slate-900/10 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-slate-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
              <div className="flex items-start gap-4">
                <div className={iconWrapClass(card.tone)}>{card.icon}</div>
                <div>
                  <h3 className="text-base font-semibold uppercase tracking-[0.12em] text-slate-950 dark:text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/70">{card.description}</p>
                </div>
              </div>
              {card.pills.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {card.pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-slate-900/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 transition group-hover:border-teal-500/20 group-hover:text-teal-600 dark:border-white/10 dark:text-white/55 dark:group-hover:border-teal-300/20 dark:group-hover:text-teal-200"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const HowItWorksSection = () => {
  const { ref, visible } = useRevealOnScroll()

  return (
    <section
      id="how"
      ref={ref}
      className={`bg-slate-50 px-4 py-14 dark:bg-white/5 sm:px-6 sm:py-20 lg:px-8 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-teal-600 dark:text-teal-300">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            From sign-up to first invoice—fast.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-white/70 sm:text-base">
            Set up in minutes, track work in real time, and turn time into polished invoices without the spreadsheet hustle.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {[
            {
              step: '01',
              tag: 'Create',
              title: 'Launch your workspace quickly',
              body: 'Create your account and add your first client and project. No credit card required.',
              bullets: ['Sign up in minutes', 'Create a project', 'Invite teammates (optional)', 'Start tracking right away'],
              icon: <Rocket className="h-5 w-5" />,
            },
            {
              step: '02',
              tag: 'Track',
              title: 'Track, manage, and collaborate',
              body: 'Run timers per task, keep projects organized, and stay aligned without switching tools.',
              bullets: ['One-click timers', 'Project + client organization', 'Clear task ownership', 'Visibility for the whole team'],
              icon: <Sparkles className="h-5 w-5" />,
            },
            {
              step: '03',
              tag: 'Invoice',
              title: 'Invoice in seconds and get paid',
              body: 'Turn tracked time into invoices and keep a clear view of billing and revenue.',
              bullets: ['Generate invoices from time', 'Export and share', 'Track billing and revenue', 'Know what’s profitable'],
              icon: <CreditCard className="h-5 w-5" />,
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative overflow-hidden rounded-2xl border border-slate-900/10 bg-white/70 p-7 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-slate-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
            >
              <div className="absolute right-4 top-2 text-6xl font-bold tracking-tight text-slate-900/5 transition group-hover:text-slate-900/10 dark:text-white/5 dark:group-hover:text-white/10">
                {item.step}
              </div>
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-teal-700 dark:border-teal-300/20 dark:bg-teal-300/10 dark:text-teal-200">
                  {item.icon}
                  {item.tag}
                </div>
                <h3 className="mt-4 text-lg font-semibold uppercase tracking-[0.12em] text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/70">{item.body}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600 dark:text-white/70">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-500/80 dark:bg-teal-300/80" />
                      <span>{bullet}</span>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.6em] text-teal-600 dark:text-teal-300">
            Videos
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">See NexiFlow in action</h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Product demos and walkthroughs so you can ramp up fast.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {videoDemos.map((demo, index) => (
            <div
              key={demo.title}
              className={`bg-white/80 dark:bg-white/5 rounded-3xl shadow-lg overflow-hidden border border-gray-100/80 dark:border-white/10 transition-transform duration-500 backdrop-blur ${
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
                      <div className="bg-gradient-to-r from-teal-500 to-blue-600 rounded-full p-4 shadow-lg shadow-teal-500/20">
                        <Play className="text-white w-5 h-5" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-3 p-5 sm:p-6">
                <h3 className="text-lg font-semibold sm:text-xl">{demo.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">{demo.description}</p>
                <button className="inline-flex items-center gap-2 text-teal-700 dark:text-teal-300 font-semibold text-sm">
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
      className="bg-slate-50 px-4 py-14 text-gray-900 dark:bg-white/5 dark:text-white sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.6em] text-teal-600 dark:text-teal-300">
            Testimonials
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">They stopped juggling. They started flowing.</h2>
          <p className="max-w-3xl mx-auto text-sm text-gray-600 dark:text-white/70 sm:text-base">
            Feedback from real users who rely on NexiFlow every day.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className={`flex flex-col gap-4 rounded-3xl border border-slate-900/10 bg-white/80 p-5 shadow-sm transition duration-500 dark:border-white/10 dark:bg-white/5 dark:shadow-none backdrop-blur sm:p-6 ${
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
                className="w-full rounded-2xl border border-slate-900/10 bg-black dark:border-white/15"
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
      className="bg-white px-4 py-14 dark:bg-[#020617] sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.6em] text-teal-600 dark:text-teal-300">
            Pricing
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">No hidden fees. No surprises.</h2>
          <p className="max-w-2xl mx-auto text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Start free or upgrade when you need more controls, security, and analytics.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col gap-5 rounded-3xl border p-6 shadow-lg transition duration-500 backdrop-blur ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
              } ${
                plan.popular
                  ? 'border-teal-500/30 bg-gradient-to-b from-teal-500/5 to-blue-600/5 shadow-teal-500/10 dark:border-teal-300/25 dark:bg-white/5'
                  : 'border-slate-900/10 bg-white/80 dark:border-white/10 dark:bg-white/5'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-teal-500 to-blue-600 text-white text-xs px-3 py-1 uppercase shadow">
                  Popular
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.45em] dark:text-white/55">
                  {plan.name}
                </p>
                <div className="text-3xl font-bold sm:text-4xl">
                  {plan.price}
                  <span className="text-base font-medium text-gray-500 ml-1">/{plan.period}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{plan.description}</p>
              </div>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-auto rounded-xl py-3 font-semibold transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:opacity-90'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
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
  <section className="px-4 pb-16 pt-6 sm:px-6 sm:pb-24 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-blue-600/10 px-6 py-14 text-center shadow-lg shadow-teal-500/10 dark:border-white/10 dark:bg-white/5 sm:px-10 sm:py-16">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_50%_-10%,rgba(20,184,166,0.35),transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl space-y-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl md:text-4xl">
            Ready to boost your productivity?
          </h2>
          <p className="text-sm leading-7 text-slate-600 dark:text-white/70 sm:text-lg">
            Join thousands of teams powering their workflows with NexiFlow.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={onPrimaryAction}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-500/10 transition hover:opacity-90"
            >
              Start Free
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-8 py-3.5 text-base font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              Explore Features
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
)

const FeatureIcon = ({ iconKey }: { iconKey: string }) => {
  switch (iconKey) {
    case 'analytics':
      return <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-300" />
    case 'security':
      return <Shield className="h-5 w-5 text-blue-600 dark:text-blue-300" />
    case 'team':
      return <Users className="h-5 w-5 text-amber-600 dark:text-amber-300" />
    case 'billing':
      return <CheckCircle className="h-5 w-5 text-teal-600 dark:text-teal-300" />
    default:
      return <Building2 className="h-5 w-5 text-gray-500" />
  }
}

const FloatingChip = ({
  className,
  icon,
  tone,
  value,
  label,
}: {
  className: string
  icon: ReactNode
  tone: 'teal' | 'blue' | 'gold'
  value: string
  label: string
}) => (
  <div
    className={`absolute z-20 hidden items-center gap-3 rounded-xl border border-slate-900/10 bg-white/80 px-4 py-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/70 sm:flex ${className}`}
  >
    <div className={chipIconClass(tone)}>{icon}</div>
    <div>
      <div className="text-sm font-semibold text-slate-950 dark:text-white">{value}</div>
      <div className="text-[11px] font-semibold text-slate-500 dark:text-white/55">{label}</div>
    </div>
  </div>
)

const MiniBarCard = ({ title, tone }: { title: string; tone: 'teal' | 'blue' }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
    <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-white/55">{title}</div>
    <div className="mt-3 space-y-2">
      {[72, 55, 88].map((width, index) => (
        <div key={`${title}-${index}`} className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`${tone === 'teal' ? 'bg-gradient-to-r from-teal-400 to-blue-500' : 'bg-gradient-to-r from-blue-500 to-violet-500'} h-full rounded-full`} style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  </div>
)

const chipIconClass = (tone: 'teal' | 'blue' | 'gold') => {
  if (tone === 'teal') return 'grid h-8 w-8 place-items-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-200'
  if (tone === 'blue') return 'grid h-8 w-8 place-items-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-200'
  return 'grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-200'
}

const iconWrapClass = (tone: 'teal' | 'blue' | 'gold') => {
  if (tone === 'teal') return 'grid h-11 w-11 place-items-center rounded-2xl border border-teal-500/15 bg-teal-500/10 text-teal-700 dark:text-teal-200'
  if (tone === 'blue') return 'grid h-11 w-11 place-items-center rounded-2xl border border-blue-500/15 bg-blue-500/10 text-blue-700 dark:text-blue-200'
  return 'grid h-11 w-11 place-items-center rounded-2xl border border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-200'
}

const formatAsHhMmSs = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
