# Clockistry - Time Tracking Application

A modern, Clockify-like time tracking application built with React, TypeScript, and Tailwind CSS. Track your time, manage projects, and analyze productivity with a beautiful, intuitive interface.

## ✨ Features

### 🕐 Time Tracking
- **Start/Stop Timer**: Simple one-click time tracking
- **Manual Entries**: Add time entries manually with detailed information
- **Project & Task Association**: Link time entries to specific projects and tasks
- **Tags**: Organize entries with customizable tags
- **Billable Hours**: Mark entries as billable and track earnings

### 🤖 AI Assistant
- **Dedicated Chat Widget**: Interact with an AI assistant directly in the application
- **Productivity Insights**: Get AI-powered suggestions for improving productivity
- **Natural Language Queries**: Ask questions in plain English
- **Time Management Help**: Assistance with scheduling and task prioritization

### 📊 Dashboard & Analytics
- **Overview Statistics**: Daily, weekly, and monthly time summaries
- **Earnings Tracking**: Calculate earnings based on hourly rates
- **Productivity Insights**: View time distribution across projects
- **Recent Activity**: Quick access to latest time entries

### 🗂️ Project Management
- **Project Organization**: Create and manage multiple projects
- **Task Management**: Break down projects into specific tasks
- **Client Management**: Organize projects by client
- **Color Coding**: Visual project identification with custom colors

### 📈 Reports & Export
- **Time Reports**: Detailed time analysis by period and project
- **Data Export**: Export time data for external analysis
- **Filtering**: Filter reports by date, project, and other criteria
- **Visual Charts**: Data visualization for better insights

### ⚙️ Settings & Customization
- **User Profile**: Manage personal information and preferences
- **Time & Billing**: Configure hourly rates and working hours
- **Notifications**: Customize email and browser notifications
- **Appearance**: Theme and layout customization options

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase project (for backend functionality)
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clockistry
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Run the setup script to create your environment file:
   ```bash
   npm run setup-env
   ```
   
   Then update the `.env.local` file with your actual Firebase configuration:
   ```bash
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   
   # OpenAI Configuration (for AI features)
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   **Important**: Never commit your `.env.local` file to version control. It's already included in `.gitignore`.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to view the application

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run setup-env` - Set up environment variables file

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx     # Application header with navigation
│   ├── Sidebar.tsx    # Navigation sidebar
│   └── TimeTracker.tsx # Core time tracking component
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard view
│   ├── TimeTracker.tsx # Time tracking page
│   ├── Projects.tsx    # Project management
│   ├── Reports.tsx     # Analytics and reports
│   └── Settings.tsx    # User settings
├── types/              # TypeScript type definitions
│   └── index.ts        # Application interfaces
├── utils/              # Utility functions
│   └── index.ts        # Helper functions
├── data/               # Mock data for development
│   └── mockData.ts     # Sample data
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## 🎨 Design System

### Colors
- **Primary**: Blue (#3B82F6) - Main brand color
- **Success**: Green (#10B981) - Positive actions and billable time
- **Warning**: Yellow (#F59E0B) - Cautions and alerts
- **Danger**: Red (#EF4444) - Errors and destructive actions
- **Neutral**: Gray scale for text and backgrounds

### Components
- **Cards**: Consistent container styling with shadows and borders
- **Buttons**: Primary, secondary, and danger variants
- **Forms**: Clean input styling with focus states
- **Tables**: Responsive data tables with hover effects

## 🔧 Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS for utility-first styling
- **Icons**: Lucide React for consistent iconography
- **Date Handling**: date-fns for date manipulation
- **Routing**: React Router for navigation
- **State Management**: React hooks for local state
- **AI Integration**: OpenAI API for AI assistant features

## 📱 Responsive Design

The application is fully responsive and works seamlessly across:
- Desktop computers
- Tablets
- Mobile devices

Features responsive navigation, collapsible sidebar, and mobile-optimized layouts.

## 🚧 Development Status

This is a **frontend-only** implementation with the following status:

### ✅ Completed
- Complete UI/UX design and implementation
- Time tracking functionality
- Project and task management
- Dashboard and analytics
- Settings and customization
- Responsive design
- Mock data integration
- AI assistant integration

### 🔄 Planned for Backend
- User authentication and authorization
- Data persistence (database)
- Real-time updates
- API endpoints
- Data export functionality
- User collaboration features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Clockify](https://clockify.me/) and other time tracking applications
- Built with modern web technologies and best practices
- Designed for developer productivity and user experience

## 📞 Support

For questions, issues, or contributions, please:
1. Check existing issues in the repository
2. Create a new issue with detailed information
3. Reach out to the development team

---

**Happy Time Tracking! ⏰**