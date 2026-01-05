import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import {
  getSynthesisById,
  deleteSynthesis,
  updateSynthesis,
  saveFlashcard,
  getAllFlashcards
} from '../services/storage'
import { generateFlashcardsFromSynthesis } from '../services/gemini'
import { createNewFlashcard } from '../services/sm2'
import type { Synthesis } from '../types/synthesis'

export function SynthesisView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')

  useEffect(() => {
    loadSynthesis()
  }, [id])

  const loadSynthesis = async () => {
    if (!id) {
      navigate('/syntheses')
      return
    }

    setLoading(true)
    const data = await getSynthesisById(id)

    if (!data) {
      navigate('/syntheses')
      return
    }

    setSynthesis(data)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!synthesis) return

    if (confirm('Supprimer cette synthèse ?')) {
      await deleteSynthesis(synthesis.id)
      navigate('/syntheses')
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!synthesis) return

    setGenerating(true)
    setGenerationProgress('Analyse de la synthèse...')

    try {
      // 1. Générer les flashcards avec Gemini
      setGenerationProgress('Génération des flashcards avec IA...')
      const generatedCards = await generateFlashcardsFromSynthesis(
        synthesis.html,
        synthesis.subject,
        synthesis.chapter
      )

      // 2. Récupérer les flashcards existantes pour l'étalement optimal
      setGenerationProgress('Optimisation de la planification...')
      const existingCards = await getAllFlashcards()

      // 3. Créer et sauvegarder chaque flashcard avec SM-2
      setGenerationProgress(`Création de ${generatedCards.length} flashcards...`)
      let savedCount = 0

      for (const card of generatedCards) {
        const flashcardData = createNewFlashcard(
          {
            synthesisId: synthesis.id,
            question: card.question,
            answer: card.answer,
            explanation: card.explanation,
            subject: synthesis.subject,
            tags: [synthesis.chapter],
          },
          existingCards,
          20 // Max 20 nouvelles cartes par jour
        )

        await saveFlashcard(flashcardData)
        savedCount++
        setGenerationProgress(`Sauvegarde: ${savedCount}/${generatedCards.length} flashcards...`)
      }

      // 4. Mettre à jour le flag de la synthèse
      await updateSynthesis(synthesis.id, { flashcardsGenerated: true })
      setSynthesis({ ...synthesis, flashcardsGenerated: true })

      // 5. Afficher un message de succès
      setGenerationProgress(`✅ ${generatedCards.length} flashcards créées avec succès !`)

      // Attendre 2 secondes puis fermer le modal
      setTimeout(() => {
        setGenerating(false)
        setGenerationProgress('')

        // Proposer d'aller aux flashcards
        if (confirm(`${generatedCards.length} flashcards créées ! Voulez-vous les réviser maintenant ?`)) {
          navigate('/flashcards')
        }
      }, 2000)

    } catch (error) {
      console.error('Erreur lors de la génération des flashcards:', error)
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      setGenerationProgress(`❌ Erreur: ${message}`)

      // Fermer après 3 secondes
      setTimeout(() => {
        setGenerating(false)
        setGenerationProgress('')
      }, 3000)
    }
  }

  const handleDownload = () => {
    if (!synthesis) return

    // Créer un HTML complet pour l'impression/PDF
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${synthesis.title}</title>
  <style>
    body {
      background: #ffffff;
      padding: 2rem;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #000000;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 1rem; }
    }
  </style>
</head>
<body>
${synthesis.html}
</body>
</html>
    `

    // Créer un blob et télécharger
    const blob = new Blob([fullHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${synthesis.title.replace(/[^a-z0-9]/gi, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-5 pb-28 flex items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    )
  }

  if (!synthesis) {
    return null
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Modal de génération de flashcards */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-6">
              <div className="text-4xl mb-4 animate-bounce">🎴</div>
              <h3 className="text-xl font-bold text-white mb-2">
                Génération de flashcards
              </h3>
            </div>

            <div className="mb-6">
              <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: generationProgress.includes('✅') ? '100%' : '50%' }}
                />
              </div>
              <p className="text-gray-300 text-sm">{generationProgress}</p>
            </div>

            {!generationProgress.includes('✅') && !generationProgress.includes('❌') && (
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="pt-6 pb-2">
          <button
            onClick={() => navigate('/syntheses')}
            className="text-orange-500 text-sm mb-3 flex items-center gap-1"
          >
            ← Retour
          </button>
          <h1 className="text-3xl font-bold text-white mb-1">{synthesis.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{synthesis.subject}</span>
            <span>•</span>
            <span>{synthesis.chapter}</span>
            <span>•</span>
            <span>{new Date(synthesis.date).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="gradient"
            onClick={handleGenerateFlashcards}
            className="flex-1"
            disabled={synthesis.flashcardsGenerated || generating}
          >
            {generating
              ? '⏳ Génération...'
              : synthesis.flashcardsGenerated
              ? '✓ Flashcards créées'
              : '🎴 Générer flashcards'}
          </Button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors"
            title="Télécharger"
          >
            📥
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>

        {/* Stats */}
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{synthesis.wordCount}</div>
              <div className="text-xs text-gray-400">Mots</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{synthesis.pageCount}</div>
              <div className="text-xs text-gray-400">Pages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{synthesis.tags.length}</div>
              <div className="text-xs text-gray-400">Tags</div>
            </div>
          </div>
        </Card>

        {/* Synthesis Content */}
        <div className="bg-white rounded-2xl p-8 shadow-lg">
          <div
            dangerouslySetInnerHTML={{ __html: synthesis.html }}
          />
        </div>

        {/* Original Image */}
        {synthesis.sourceImages.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Image source</h3>
            <div className="space-y-3">
              {synthesis.sourceImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Source ${idx + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </Card>
        )}

        {/* Raw Text (collapsible) */}
        <details>
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
            Afficher le texte brut
          </summary>
          <Card className="p-4 mt-2">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap">{synthesis.rawText}</pre>
          </Card>
        </details>
      </div>
    </div>
  )
}
