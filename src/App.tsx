import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/ui/BottomNav'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Scanner } from './pages/Scanner'
import { Syntheses } from './pages/Syntheses'
import { SynthesisView } from './pages/SynthesisView'
import { Flashcards } from './pages/Flashcards'
import { BookNotes } from './pages/BookNotes'
import { Planning } from './pages/Planning'
import { UserSelection } from './pages/UserSelection'
import { syncWithBackend } from './services/storage'
import { initializeUsers, getCurrentUser } from './services/userService'
// import './services/resetDatabase' // Désactivé - cause des refreshes en boucle

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasUser, setHasUser] = useState(false)

  // Initialiser les utilisateurs et sync backend
  useEffect(() => {
    console.log('🚀 App.tsx useEffect - Début initialisation')

    // Initialiser les utilisateurs au démarrage
    initializeUsers()
      .then(async () => {
        console.log('✅ App.tsx - Utilisateurs initialisés')

        // Vérifier si un utilisateur est sélectionné
        const currentUser = await getCurrentUser()
        setHasUser(!!currentUser)

        setIsInitialized(true)

        // Sync seulement si un utilisateur est sélectionné
        if (currentUser) {
          return syncWithBackend()
        }
      })
      .then(() => {
        console.log('✅ App.tsx - Sync backend terminée')
      })
      .catch(err => {
        console.error('❌ App.tsx - Erreur lors de l\'initialisation:', err)
        setIsInitialized(true) // Continuer quand même
      })

    // Sync automatique toutes les 5 minutes (pas toutes les 30 secondes pour éviter trop de rechargements)
    const interval = setInterval(() => {
      console.log('⏰ App.tsx - Sync automatique déclenchée')
      getCurrentUser().then(user => {
        if (user) {
          syncWithBackend().catch(err => {
            console.warn('❌ App.tsx - Erreur lors de la sync automatique:', err)
          })
        }
      })
    }, 300000) // 5 minutes

    // Nettoyage à la fermeture
    return () => {
      console.log('🧹 App.tsx - Cleanup useEffect')
      clearInterval(interval)
    }
  }, [])

  // Afficher un écran de chargement pendant l'initialisation
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Initialisation...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/select-user" element={<UserSelection />} />
        {hasUser ? (
          <Route path="*" element={
            <Layout>
              <div className="min-h-screen">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/scan" element={<Scanner />} />
                  <Route path="/syntheses" element={<Syntheses />} />
                  <Route path="/syntheses/:id" element={<SynthesisView />} />
                  <Route path="/flashcards" element={<Flashcards />} />
                  <Route path="/notes" element={<BookNotes />} />
                  <Route path="/planning" element={<Planning />} />
                </Routes>
                <BottomNav />
              </div>
            </Layout>
          } />
        ) : (
          <Route path="*" element={<Navigate to="/select-user" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
