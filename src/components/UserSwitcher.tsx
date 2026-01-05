import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllUsers, getCurrentUser, switchUser, createUser } from '../services/userService'
import type { User } from '../types/user'
import { Button } from './ui/Button'

export function UserSwitcher() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [showNewUserModal, setShowNewUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const [current, all] = await Promise.all([
        getCurrentUser(),
        getAllUsers()
      ])
      setCurrentUser(current)
      setAllUsers(all)
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchUser = async (userId: string) => {
    const user = await switchUser(userId)
    if (user) {
      setCurrentUser(user)
      setShowMenu(false)
      // Recharger la page pour mettre à jour toutes les données
      window.location.reload()
    }
  }

  const handleCreateUser = async () => {
    if (!newUserName.trim()) return

    await createUser(newUserName.trim())
    await loadUsers()
    setNewUserName('')
    setShowNewUserModal(false)
  }

  if (loading) {
    return (
      <div className="w-10 h-10 bg-gray-800/50 rounded-full animate-pulse" />
    )
  }

  if (!currentUser) {
    console.error('Aucun utilisateur actif trouvé')
    return null
  }

  return (
    <>
      {/* Bouton utilisateur actuel */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: currentUser.color }}
        >
          {currentUser.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-white text-sm hidden sm:inline">{currentUser.name}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Menu déroulant */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 right-5 z-50 glass-card p-3 w-64 shadow-xl"
            >
              <div className="mb-2 px-2 py-1 text-xs text-gray-400 font-semibold uppercase">
                Changer d'utilisateur
              </div>

              <div className="space-y-1">
                {allUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSwitchUser(user.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      user.id === currentUser.id
                        ? 'bg-white/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white text-sm">{user.name}</div>
                      {user.id === currentUser.id && (
                        <div className="text-xs text-green-400">● Actif</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {allUsers.length < 5 && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowNewUserModal(true)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter un utilisateur
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal nouvel utilisateur */}
      <AnimatePresence>
        {showNewUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNewUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-4">👤 Nouvel utilisateur</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nom</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Ex: Marie"
                    className="w-full bg-gray-700/50 text-white rounded-xl p-3"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateUser()
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="glass"
                    onClick={() => {
                      setShowNewUserModal(false)
                      setNewUserName('')
                    }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={handleCreateUser}
                    className="flex-1"
                  >
                    Créer
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
