import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getStats, getFlashcardsDueForReview, getAllProjects, syncWithBackend, resetLocalDatabase } from '../services/storage'
import { signOut } from '../services/supabase'
import { recoverOldData } from '../services/userService'
import type { Flashcard } from '../types/flashcard'
import type { Project, ProjectTask } from '../types/project'

export function Home() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ syntheses: 0, flashcards: 0 })
  const [todayFlashcards, setTodayFlashcards] = useState<Flashcard[]>([])
  const [todayTasks, setTodayTasks] = useState<{ project: Project, task: ProjectTask }[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSyncClick, setLastSyncClick] = useState(0)
  
  // Paramètres
  const [showSettings, setShowSettings] = useState(false)
  const [examMode, setExamMode] = useState(() => localStorage.getItem('appstudy_exam_mode') === 'true')

  useEffect(() => {
    loadStats().catch(err => console.error('Erreur chargement stats:', err))
    loadTodayItems().catch(err => console.error('Erreur chargement items:', err))
  }, [])

  const toggleExamMode = () => {
    const newValue = !examMode
    setExamMode(newValue)
    localStorage.setItem('appstudy_exam_mode', String(newValue))
  }

  const loadStats = async () => {
    try {
      const data = await getStats()
      setStats({ syntheses: data.syntheses, flashcards: data.flashcards })
    } catch (err) {
      console.error('Erreur lors du chargement des stats:', err)
    }
  }

  const loadTodayItems = async () => {
    try {
      // Flashcards à réviser aujourd'hui
      const dueCards = await getFlashcardsDueForReview()
      setTodayFlashcards(dueCards)

    // Tâches du planning pour aujourd'hui
    const projects = await getAllProjects()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const tasksToday: { project: Project, task: ProjectTask }[] = []
    projects.forEach(project => {
      project.tasks.forEach(task => {
        if (
          task.scheduledDate &&
          task.scheduledDate >= today &&
          task.scheduledDate < tomorrow &&
          !task.completed
        ) {
          tasksToday.push({ project, task })
        }
      })
    })
      setTodayTasks(tasksToday)
    } catch (err) {
      console.error('Erreur lors du chargement des items du jour:', err)
    }
  }

  const handleSync = async () => {
    // Détection du double-click (moins de 500ms entre 2 clics)
    const now = Date.now()
    const isDoubleClick = now - lastSyncClick < 500
    setLastSyncClick(now)

    if (isDoubleClick) {
      // Double-click : HARD RESET - vider tout et resynchroniser
      const confirm = window.confirm('⚠️ RESET COMPLET\n\nCeci va supprimer toutes les données locales et les re-télécharger depuis le serveur.\n\nContinuer ?')
      if (!confirm) return

      setSyncing(true)
      try {
        console.log('🗑️ HARD RESET - Suppression de toutes les données locales...')

        // Vider complètement IndexedDB
        await resetLocalDatabase()

        // Resynchroniser depuis le serveur
        const result = await syncWithBackend()
        console.log(`✅ Resynchronisation terminée: ${result.synced} ajoutées`)

        // Forcer le rechargement de la page
        window.location.reload()
      } catch (err) {
        console.error('❌ Erreur lors du reset:', err)
        alert('Erreur lors du reset. Vérifiez votre connexion internet.')
      } finally {
        setSyncing(false)
      }
    } else {
      // Simple click : synchronisation normale
      setSyncing(true)
      try {
        console.log('🔄 Début de la synchronisation...')

        // Synchroniser avec le backend
        const result = await syncWithBackend()
        console.log(`✅ Synchronisation terminée: ${result.synced} ajoutées, ${result.deleted} supprimées, ${result.errors} erreurs`)

        // Recharger les données locales
        await loadStats()
        await loadTodayItems()

        // Forcer le rechargement de la page pour afficher les nouvelles données
        window.location.reload()
      } catch (err) {
        console.error('❌ Erreur lors de la synchronisation:', err)
        alert('Erreur de synchronisation. Vérifiez votre connexion internet.')
      } finally {
        setSyncing(false)
      }
    }
  }

  const handleLogout = async () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      await signOut()
      // Nettoyer les données locales pour éviter qu'un autre utilisateur les voie
      await resetLocalDatabase()
      window.location.href = '/auth'
    }
  }

  const handleRecover = async () => {
    if (confirm('Voulez-vous récupérer les données des anciens comptes locaux vers ce compte ?\n\nÀ faire uniquement sur le PC principal.')) {
      setSyncing(true)
      try {
        const count = await recoverOldData()
        alert(`${count} éléments récupérés ! La synchronisation va les envoyer sur le serveur.`)
        await handleSync()
      } catch (err) {
        console.error('Erreur recup:', err)
        alert('Erreur lors de la récupération.')
      } finally {
        setSyncing(false)
      }
    }
  }

  // Calculate days until next Wednesday
  const getNextWednesday = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysUntilWednesday = dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek
    const nextWednesday = new Date(now)
    nextWednesday.setDate(now.getDate() + daysUntilWednesday)
    nextWednesday.setHours(14, 0, 0, 0)
    return nextWednesday
  }

  const nextWednesday = getNextWednesday()

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28 safe-area-top" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Sync Button & Logout */}
      <div className="fixed top-5 right-5 z-50 safe-area-top flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1 px-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Synchroniser avec le serveur"
        >
          <svg
            className={`w-5 h-5 text-white ${syncing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1 px-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          title="Paramètres"
        >
          <span className="text-lg">⚙️</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-3 py-2 bg-red-500/20 text-red-200 hover:bg-red-500/40 rounded-lg transition-colors border border-red-500/30"
          title="Se déconnecter"
        >
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="pt-6 pb-2">
          <h1 className="text-3xl font-bold text-white mb-1">
            AppStudy
          </h1>
          <p className="text-gray-400 text-sm">Mercredi {nextWednesday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Tâches du planning pour aujourd'hui */}
        {todayTasks.length > 0 ? (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">📋 {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <span className="text-sm text-orange-400">{todayTasks.length} tâche{todayTasks.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {todayTasks.map(({ project, task }) => {
                const categoryColors: Record<string, string> = {
                  video: 'from-purple-500 to-pink-500',
                  work: 'from-blue-500 to-cyan-500',
                  school: 'from-orange-500 to-yellow-500',
                }
                const color = categoryColors[project.category] || 'from-gray-500 to-gray-600'

                return (
                  <motion.div
                    key={task.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => navigate('/planning')}
                    className={`p-3 bg-gradient-to-r ${color} bg-opacity-20 rounded-lg cursor-pointer hover:opacity-80 transition-opacity`}
                  >
                    <div className="text-sm text-white font-medium line-clamp-1">{task.description}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-white/70">{project.title}</div>
                      <div className="text-xs text-white/70">
                        {Math.floor(task.estimatedMinutes / 60)}h{task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            <Button
              variant="glass"
              onClick={() => navigate('/planning')}
              className="w-full mt-3"
            >
              Voir le planning
            </Button>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="font-bold text-white mb-2">📋 {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <p className="text-sm text-gray-400 mb-4">Aucune tâche planifiée</p>
          </Card>
        )}

        {/* Flashcards à réviser aujourd'hui */}
        {todayFlashcards.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">🎴 Flashcards du jour</h3>
              <span className="text-sm text-orange-400">{todayFlashcards.length} carte{todayFlashcards.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {todayFlashcards.slice(0, 3).map((card) => (
                <motion.div
                  key={card.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate('/flashcards')}
                  className="p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                >
                  <div className="text-sm text-white font-medium line-clamp-1">{card.question}</div>
                  <div className="text-xs text-gray-400 mt-1">{card.subject}</div>
                </motion.div>
              ))}
              {todayFlashcards.length > 3 && (
                <div className="text-xs text-center text-gray-500 pt-1">
                  +{todayFlashcards.length - 3} autre{todayFlashcards.length - 3 > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <Button
              variant="gradient"
              onClick={() => navigate('/flashcards')}
              className="w-full mt-3"
            >
              Commencer la révision
            </Button>
          </Card>
        )}

        {/* Gros bouton de synchronisation */}
        <Card className="p-6 mt-6">
          <div className="text-center">
            <h3 className="font-bold text-white mb-2">Synchronisation</h3>
            <p className="text-sm text-gray-400 mb-4">
              {syncing ? 'Synchronisation en cours...' : 'Récupérer les données depuis le serveur'}
            </p>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-4 text-lg"
            >
              {syncing ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Synchronisation...</span>
                </div>
              ) : (
                '🔄 Synchroniser maintenant'
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Double-clic = Reset complet (supprime toutes les données locales)
            </p>
            
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <button
                onClick={handleRecover}
                className="text-xs text-gray-500 hover:text-gray-300 underline"
              >
                📥 Récupérer mes anciennes données locales
              </button>
            </div>
          </div>
        </Card>

        {/* Modal Paramètres */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowSettings(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-800 p-6 rounded-2xl max-w-sm w-full border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Paramètres</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎓</span>
                      <span className="font-bold text-white">Mode Examen</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Révisions 3x plus fréquentes (Cramming)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={examMode} onChange={toggleExamMode} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">v1.3.0 • AppStudy Pro</p>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  )
}
