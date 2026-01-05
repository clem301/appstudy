import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'

interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: number
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/' },
  { id: 'scan', label: 'Scan', icon: '📸', path: '/scan' },
  { id: 'syntheses', label: 'Synthèses', icon: '📚', path: '/syntheses' },
  { id: 'notes', label: 'Notes', icon: '📖', path: '/notes' },
  { id: 'flashcards', label: 'Cards', icon: '🎴', path: '/flashcards' },
  { id: 'planning', label: 'Planning', icon: '📋', path: '/planning' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-5 left-0 right-0 z-50 px-5 safe-area-bottom pointer-events-none">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="mx-auto max-w-lg pointer-events-auto"
        style={{
          background: 'rgba(28, 41, 56, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1 relative min-w-[56px] py-2 px-1 rounded-2xl transition-all"
                style={{
                  background: active ? 'rgba(255, 107, 53, 0.15)' : 'transparent',
                }}
              >
                {/* Icon */}
                <div className="relative">
                  <motion.div
                    animate={{
                      scale: active ? 1.1 : 1,
                    }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="flex items-center justify-center w-10 h-10"
                  >
                    <span className="text-xl">
                      {item.icon}
                    </span>
                  </motion.div>
                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </motion.span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] font-semibold transition-all ${
                    active
                      ? 'text-orange-400'
                      : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </nav>
  )
}
