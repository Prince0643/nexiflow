import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  Search, 
  Bell, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  X, 
  MessageSquare,
  ChevronDown,
  Menu,
  Bot,
  Gift,
  Shield,
  MoreVertical
} from 'lucide-react'
import { useMySQLAuth } from '../contexts/MySQLAuthContext'
import { useSearch } from '../contexts/SearchContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useTheme } from '../contexts/ThemeContext'
import AIChatWidget from './ai/AIChatWidget'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const updatesRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  
  const { currentUser, logout } = useMySQLAuth()
  const { searchQuery, setSearchQuery, searchResults, isSearching, performSearch, clearSearch } = useSearch()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // AI Widget visibility state
  const [isAIWidgetHidden, setIsAIWidgetHidden] = useState(false);

  // Load AI widget visibility state from localStorage
  useEffect(() => {
    const savedHidden = localStorage.getItem('aiChatWidgetHidden');
    if (savedHidden) {
      setIsAIWidgetHidden(JSON.parse(savedHidden));
    }
  }, []);

  // Toggle AI widget visibility
  const toggleAIWidgetVisibility = () => {
    const newHidden = !isAIWidgetHidden;
    setIsAIWidgetHidden(newHidden);
    localStorage.setItem('aiChatWidgetHidden', JSON.stringify(newHidden));
    
    // Dispatch a custom event to notify the AIChatWidget of the change
    window.dispatchEvent(new CustomEvent('aiWidgetVisibilityChange', { detail: newHidden }));
  };

  // Comprehensive updates data covering all implemented features
  const updates = [
    {
      id: '1',
      title: '📅 New Calendar System',
      description: 'Enhanced calendar with drag-and-drop scheduling, recurring events, and team availability views.',
      date: '2024-01-15',
      category: 'feature'
    },
    {
      id: '2',
      title: '📊 Advanced Reporting',
      description: 'New dashboard with customizable charts, export options, and team performance metrics.',
      date: '2024-01-10',
      category: 'feature'
    },
    {
      id: '3',
      title: '🔒 Security Enhancements',
      description: 'Improved authentication with two-factor verification and enhanced data encryption.',
      date: '2024-01-05',
      category: 'security'
    },
    {
      id: '4',
      title: '📱 Mobile Responsiveness',
      description: 'Complete mobile optimization for all features with touch-friendly controls.',
      date: '2023-12-28',
      category: 'improvement'
    }
  ];

  // Filter out updates that have already been seen
  const [seenUpdates, setSeenUpdates] = useState<string[]>(() => {
    const saved = localStorage.getItem('seenUpdates');
    return saved ? JSON.parse(saved) : [];
  });

  const unseenUpdates = updates.filter(update => !seenUpdates.includes(update.id));
  const hasUnseenUpdates = unseenUpdates.length > 0;

  // Mark updates as seen when the updates panel is opened
  const handleOpenUpdates = () => {
    setShowUpdates(true);
    if (unseenUpdates.length > 0) {
      const updatedSeen = [...seenUpdates, ...unseenUpdates.map(u => u.id)];
      setSeenUpdates(updatedSeen);
      localStorage.setItem('seenUpdates', JSON.stringify(updatedSeen));
    }
  };

  // Handle clicks outside of dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (updatesRef.current && !updatesRef.current.contains(event.target as Node)) {
        setShowUpdates(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
      if (!event.target || !(event.target as Element).closest('.user-menu, .user-menu-button')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.trim()) {
      performSearch(value);
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
      setShowSearchResults(true);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  // Filter notifications to show only unread ones in the dropdown
  console.log('=== Header: Filtering unread notifications ===');
  console.log('All notifications:', notifications);
  const unreadNotifications = notifications.filter(notification => !notification.isRead);
  console.log('Unread notifications:', unreadNotifications);
  console.log('Unread count:', unreadNotifications.length);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Left side - Menu button and search */}
          <div className="flex items-center">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white focus:outline-none"
              onClick={onMenuClick}
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Search */}
            <div className="relative ml-4 flex-1 max-w-md" ref={searchRef}>
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-500 dark:focus:border-primary-500 sm:text-sm"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                />
              </form>
              
              {showSearchResults && (
                <div className="absolute z-50 mt-1 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg">
                  <div className="rounded-md ring-1 ring-black ring-opacity-5 overflow-hidden">
                    {isSearching ? (
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {searchResults.slice(0, 10).map((result) => (
                          <li
                            key={result.id}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              navigate(result.url);
                              setShowSearchResults(false);
                              clearSearch();
                            }}
                          >
                            <div className="font-medium">{result.title}</div>
                            <div className="text-gray-500 dark:text-gray-400 truncate">
                              {result.url}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : searchQuery ? (
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        No results found for "{searchQuery}"
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Theme toggle, Notifications and user menu */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Desktop icons - hidden on mobile */}
            <div className="hidden sm:flex items-center space-x-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5 text-yellow-500" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>



              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-xs text-white items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
                      {unreadNotifications.length > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {unreadNotifications.length > 0 ? (
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                          {unreadNotifications.map((notification) => (
                            <li 
                              key={notification.id} 
                              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                markAsRead(notification.id);
                                setShowNotifications(false);
                                if (notification.actionUrl) {
                                  navigate(notification.actionUrl);
                                }
                              }}
                            >
                              <div className="flex">
                                <div className="ml-3 flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {notification.title}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {notification.message}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                    {notification.timestamp.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-center">
                          <Bell className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            No new notifications
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Updates/Changelog */}
              <div className="relative" ref={updatesRef}>
                <button
                  onClick={handleOpenUpdates}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                  title="What's New"
                >
                  <Gift className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  {hasUnseenUpdates && (
                    <span className="absolute top-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  )}
                </button>

                {showUpdates && (
                  <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">What's New</h3>
                      <button 
                        onClick={() => setShowUpdates(false)}
                        className="text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {updates.map((update) => (
                          <li key={update.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex justify-between">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                {update.title}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                update.category === 'feature' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                                  : update.category === 'security' 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' 
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                              }`}>
                                {update.category}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {update.description}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                              {new Date(update.date).toLocaleDateString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Chat Widget Toggle */}
              <button
                onClick={toggleAIWidgetVisibility}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isAIWidgetHidden ? "Show AI Assistant" : "Hide AI Assistant"}
              >
                <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                {isAIWidgetHidden && (
                  <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                  </span>
                )}
              </button>
            </div>

            {/* Mobile menu button - visible only on mobile */}
            <div className="sm:hidden relative" ref={mobileMenuRef}>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="More options"
              >
                <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>

              {/* Mobile dropdown menu */}
              {showMobileMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="py-1">
                    {/* Theme Toggle */}
                    <button
                      onClick={() => {
                        toggleDarkMode();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {isDarkMode ? (
                        <Sun className="h-5 w-5 text-yellow-500 mr-3" />
                      ) : (
                        <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-3" />
                      )}
                      {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>



                    {/* Notifications */}
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 relative"
                    >
                      <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-3" />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="absolute right-4 flex h-5 w-5">
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-xs text-white items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        </span>
                      )}
                    </button>

                    {/* Updates/Changelog */}
                    <button
                      onClick={() => {
                        handleOpenUpdates();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 relative"
                    >
                      <Gift className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-3" />
                      What's New
                      {hasUnseenUpdates && (
                        <span className="absolute right-4 flex h-3 w-3">
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                      )}
                    </button>

                    {/* AI Chat Widget Toggle */}
                    <button
                      onClick={() => {
                        toggleAIWidgetVisibility();
                        setShowMobileMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <Bot className="h-5 w-5 text-gray-600 dark:text-gray-300 mr-3" />
                      {isAIWidgetHidden ? "Show AI Assistant" : "Hide AI Assistant"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors user-menu-button"
              >
                <div className="relative">
                  {currentUser?.avatar ? (
                    <img 
                      src={currentUser.avatar} 
                      alt="Profile" 
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                      {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  {/* Root user badge */}
                  {currentUser?.role === 'root' && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                      <Shield className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none user-menu z-50">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {currentUser?.avatar ? (
                          <img 
                            src={currentUser.avatar} 
                            alt="Profile" 
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                            {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
                          </div>
                        )}
                        {/* Root user badge in dropdown */}
                        {currentUser?.role === 'root' && (
                          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                            <Shield className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {currentUser?.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {currentUser?.email}
                        </p>
                        <div className="flex items-center space-x-1">
                          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                            {currentUser?.role?.replace('_', ' ')}
                          </p>
                          {currentUser?.role === 'root' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                              ROOT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <User className="inline h-4 w-4 mr-2" />
                      Your Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <LogOut className="inline h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}