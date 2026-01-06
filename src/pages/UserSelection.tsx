import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAllUsers, switchUser, getCurrentUser } from '../services/userService'
import type { User } from '../types/user'

export function UserSelection() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadUsers() {
      try {
        // Vérifier si un utilisateur est déjà connecté
        const currentUser = await getCurrentUser()
        if (currentUser) {
          // Rediriger vers la page d'accueil
          navigate('/', { replace: true })
          return
        }

        const allUsers = await getAllUsers()
        setUsers(allUsers)
      } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [navigate])

  const handleSelectUser = async (userId: string) => {
    try {
      await switchUser(userId)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'utilisateur:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">AppStudy</h1>
          <p className="text-purple-300">Qui êtes-vous ?</p>
        </motion.div>

        <div className="space-y-4">
          {users.map((user, index) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onClick={() => handleSelectUser(user.id)}
              className="w-full glass-card p-6 flex items-center gap-4 hover:scale-105 transition-transform duration-200"
              style={{
                background: `linear-gradient(135deg, ${user.color}22 0%, ${user.color}11 100%)`,
                borderColor: user.color,
              }}
            >
              {/* Avatar circle */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name[0].toUpperCase()}
              </div>

              {/* User info */}
              <div className="flex-1 text-left">
                <h2 className="text-xl font-semibold text-white">{user.name}</h2>
                {user.lastActive && (
                  <p className="text-sm text-gray-400">
                    Dernière connexion : {new Date(user.lastActive).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>

              {/* Arrow icon */}
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </motion.button>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center text-gray-400 text-sm mt-8"
        >
          Vos données sont synchronisées sur tous vos appareils
        </motion.p>
      </div>
    </div>
  )
}
