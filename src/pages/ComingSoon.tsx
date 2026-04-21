import { Link } from 'react-router-dom'

const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold mb-4">Coming Soon</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">We're working on something amazing!</p>
      <Link to="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
        Back to Home
      </Link>
    </div>
  )
}

export default ComingSoon
