
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signIn, signUp } from '../services/supabase'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Auth() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const translateError = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
    if (msg.includes('Email not confirmed')) return 'Veuillez confirmer votre email.'
    if (msg.includes('User already registered')) return 'Cet email est déjà utilisé.'
    if (msg.includes('security purposes')) return 'Trop de tentatives. Veuillez attendre 30 secondes.'
    if (msg.includes('Password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.'
    return msg
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isLogin) {
        await signIn(email, password)
      } else {
        await signUp(email, password, name)
      }
      
      // Redirection vers l'accueil après connexion réussie
      window.location.href = '/' 
    } catch (err: any) {
      console.error('Auth Error:', err)
      setError(translateError(err.message || 'Une erreur est survenue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">AppStudy</h1>
          <p className="text-purple-200">Votre compagnon d'étude intelligent</p>
        </div>

        <Card className="p-8 backdrop-blur-xl bg-white/10 border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                label="Prénom"
                type="text"
                placeholder="Ex: Clément"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            <Button
              type="submit"
              variant="gradient"
              className="w-full py-3 mt-4"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Traitement...</span>
                </div>
              ) : (
                isLogin ? 'Se connecter' : "S'inscrire"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
              }}
              className="text-sm text-purple-300 hover:text-white transition-colors"
            >
              {isLogin 
                ? "Pas encore de compte ? S'inscrire" 
                : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
