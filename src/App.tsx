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
import { Auth } from './pages/Auth'
import { MathsJury } from './pages/MathsJury'
import { syncWithBackend } from './services/storage'
import { getSupabaseUser } from './services/supabase'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    console.log('🚀 App.tsx - Checking auth')
    
    getSupabaseUser().then(user => {
      setIsAuthenticated(!!user)
      setIsInitialized(true)
      
      if (user) {
        syncWithBackend().catch(console.error)
      }
    })

    // Sync automatique toutes les 30 secondes
    const interval = setInterval(() => {
      if (isAuthenticated) {
        syncWithBackend().catch(console.error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Afficher un écran de chargement pendant l'initialisation
  if (!isInitialized) {
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
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={!isAuthenticated ? <Auth /> : <Navigate to="/" replace />} />
        
        {isAuthenticated ? (
          <Route path="*" element={
            <Layout>
              <div className="min-h-screen">
                <Routes>
                  <Route path="/" element={<MathsJury />} />
                  <Route path="/dashboard" element={<Home />} />
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
          <Route path="*" element={<Navigate to="/auth" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
