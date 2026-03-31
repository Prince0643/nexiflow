import { ReactNode } from 'react'

export type EnhancedFeature = {
  title: string
  description: string
  highlights: string[]
  image: string
}

export type FeatureHighlight = {
  title: string
  description: string
  iconKey: 'analytics' | 'security' | 'team' | 'billing'
}

export type VideoDemo = {
  title: string
  description: string
  image: string
  videoSrc: string
}

export type Testimonial = {
  name: string
  role: string
  company: string
  content: string
  rating: number
  videoSrc: string
}

export type PricingPlan = {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  popular: boolean
}

export const navLinks = [
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'testimonials', label: 'Reviews' }
]

export const stats = [
  { number: '10,000+', label: 'Hours Tracked' },
  { number: '500+', label: 'Active Users' },
  { number: '99.9%', label: 'Uptime' },
  { number: '4.8★', label: 'User Rating' }
]

export const enhancedFeatures: EnhancedFeature[] = [
  {
    title: 'Track work hours easily',
    description:
      'Start and stop timers with one click, or log hours manually. View detailed timesheets and export them for payroll or billing.',
    highlights: ['Intuitive timers', 'Manual entries', 'Export-ready reports'],
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692962056c98c803f72c9ea6.png'
  },
  {
    title: 'Manage teams and projects',
    description:
      'Organize projects, assign roles, and monitor progress from one dashboard. Track client interactions and keep everyone aligned.',
    highlights: ['Project hierarchy', 'Team permissions', 'Activity feed'],
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205bc52feedbaf3cccd.png'
  },
  {
    title: 'Billing and analytics',
    description:
      'Generate invoices, track revenue, and get actionable charts so you can make better business decisions every day.',
    highlights: ['Invoice automation', 'Revenue breakdowns', 'Revenue insights'],
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205974316c65856f1e1.png'
  }
]

export const featureHighlights: FeatureHighlight[] = [
  {
    title: 'Advanced Analytics',
    description: 'Deep dive into how your team spends time with charts, filters, and ready-made reports.',
    iconKey: 'analytics'
  },
  {
    title: 'Enterprise Security',
    description: 'Data encryption, role-based access, and audit logs keep your workspace protected.',
    iconKey: 'security'
  },
  {
    title: 'Team Management',
    description: 'Manage guest users, assign roles, and monitor team performance across departments.',
    iconKey: 'team'
  },
  {
    title: 'Billing & Invoicing',
    description: 'Turn tracked time into polished invoices and export statements instantly.',
    iconKey: 'billing'
  }
]

export const videoDemos: VideoDemo[] = [
  {
    title: 'Client Navigation',
    description: 'See how easy it is to bounce between clients, projects, and tasks.',
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692962056c98c803f72c9ea6.png',
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f91080b5011fa1cb11c7f.mp4'
  },
  {
    title: 'Task Management',
    description: 'Create, assign, and track tasks so every teammate knows what to do next.',
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205bc52feedbaf3cccd.png',
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f91082b865e73be752614.mp4'
  },
  {
    title: 'Team Insights',
    description: 'Use dashboards to understand team productivity, availability, and workload.',
    image: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/69296205974316c65856f1e1.png',
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f9108fd073a8a8df243fd.mp4'
  }
]

export const testimonials: Testimonial[] = [
  {
    name: 'Sarah Johnson',
    role: 'Project Manager',
    company: 'TechCorp',
    content:
      'NexiFlow has revolutionized how we track time and manage projects. The productivity insights are invaluable.',
    rating: 5,
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999cfd073a8495f38522.mp4'
  },
  {
    name: 'Mike Williams',
    role: 'Freelance Developer',
    company: 'Independent',
    content:
      'The billing features are fantastic. I can easily generate invoices and track my revenue. Highly recommended!',
    rating: 5,
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999c73043a46935b1b48.mp4'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Agency Owner',
    company: 'Creative Agency',
    content:
      'Perfect for managing multiple clients and teams. The reporting features keep us profitable.',
    rating: 5,
    videoSrc: 'https://storage.googleapis.com/msgsndr/nb61f4OQ7o9Wsxx0zOsY/media/692f999c82f4c53a10b84a9c.mp4'
  }
]

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Solo',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individuals and small teams',
    features: ['Unlimited time tracker', 'Calendar', '1 project', '1 client'],
    popular: false
  },
  {
    name: 'Office',
    price: '$9',
    period: 'per user/month',
    description: 'Ideal for growing businesses',
    features: [
      'Everything in Solo',
      'Time off tracking',
      'Client invoicing',
      'Task management',
      'Project templates',
      'Billing reports',
      'Email support'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: '$12',
    period: 'per user/month',
    description: 'For large organizations with custom needs',
    features: [
      'Everything in Office',
      'Multiple currencies',
      'Dedicated success manager',
      'Force timer',
      'System logs',
      'Database backups'
    ],
    popular: false
  }
]
