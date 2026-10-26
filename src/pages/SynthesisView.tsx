import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import katex from 'katex'
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

    // On pré-traite le contenu pour l'impression (mark -> noir)
    // Mais on laisse les $...$ pour que KaTeX (via script) les traite
    let printHtml = synthesis.html.replace(/background: #e8e8e8;/g, 'background: #000; color: #fff;')

    // Créer un HTML complet pour l'impression/PDF avec KaTeX intégré
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${synthesis.title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
        renderMathInElement(document.body, {
          delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
          ],
          throwOnError : false
        });
    });
  </script>
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
      body { padding: 0; }
      .no-print { display: none; }
    }
    /* Style spécifique synthèse */
    .definition, .example, .formula, .important, .key-points {
      break-inside: avoid; /* Empêche de couper les blocs au milieu */
      page-break-inside: avoid;
      margin-bottom: 1.5rem;
    }
    .definition { border: 2px solid black; padding: 1rem; }
    .key-points { background: black; color: white; padding: 1rem; }
    h1, h2, h3 { break-after: avoid; page-break-after: avoid; } /* Titres collés au texte suivant */
  </style>
</head>
<body>
${printHtml}
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

  const handlePrint = () => {
    if (!synthesis) return

    // ÉCONOMIE D'ENCRE : Au lieu de fond noir, on met un encadré simple
    let printHtml = synthesis.html.replace(
      /background: #e8e8e8;/g, 
      'background: transparent; color: #000; font-weight: bold; border: 1px solid #666; padding: 1px 4px; border-radius: 4px;'
    )

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${synthesis.title}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.5;
            padding: 2rem;
            max-width: 800px;
            margin: 0 auto;
            color: #000;
          }
          /* Réinitialiser les sauts de page pour éviter les gros blancs */
          body, html, #root {
            height: auto !important;
            overflow: visible !important;
          }

          /* Titres : on réduit les marges pour coller au texte */
          h1, h2, h3 { 
            margin-top: 1rem !important;
            margin-bottom: 0.2rem !important;
            page-break-after: avoid; /* Essayer de garder avec le texte suivant */
          }

          /* Le contenu principal ne doit pas forcer un bloc unique */
          .synthesis-content > div {
            page-break-inside: auto;
          }

          /* Seuls les petits blocs (définitions) sont insécables */
          .definition, .example, .formula, .important, .key-points {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 1rem;
          }
          
          /* Styles ÉCO-ENCRE pour l'impression */
          .definition { border: 2px solid #000; padding: 1rem; margin: 1rem 0; border-radius: 8px; }
          
          /* Les points clés deviennent un cadre blanc avec bordure épaisse au lieu d'un fond noir */
          .key-points { 
            background: #fff; 
            color: #000; 
            border: 3px double #000; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 2rem; 
          }
          
          @media print {
            body { padding: 0; }
            @page { margin: 2cm; }
          }
        </style>
      </head>
      <body>
        ${printHtml}
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            renderMathInElement(document.body, {
              delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false}
              ],
              throwOnError : false
            });
            // Attendre un peu que KaTeX finisse avant d'imprimer
            setTimeout(() => {
              window.print();
              window.close();
            }, 1000);
          });
        </script>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(content)
      printWindow.document.close()
    }
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

  const renderContent = (html: string) => {
    // Fonction pour remplacer les formules LaTeX par le rendu KaTeX
    // 1. Remplacer $$...$$ (Block math)
    let processedHtml = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
      try {
        return katex.renderToString(tex, { displayMode: true, throwOnError: false })
      } catch (err) {
        return match
      }
    })

    // 2. Remplacer $...$ (Inline math)
    // Attention: on évite de matcher des prix comme $10...$20 en vérifiant qu'il n'y a pas d'espace juste après le premier $
    processedHtml = processedHtml.replace(/\$([^$]+?)\$/g, (match, tex) => {
      // Ignorer si c'est juste un signe dollar isolé ou prix
      if (tex.match(/^\s/) || tex.match(/\s$/)) return match
      
      try {
        return katex.renderToString(tex, { displayMode: false, throwOnError: false })
      } catch (err) {
        return match
      }
    })

    // Remplacement des balises <mark> pour qu'elles soient visibles en noir et blanc
    processedHtml = processedHtml.replace(/background: #e8e8e8;/g, 'background: #000; color: #fff;')

    return { __html: processedHtml }
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll p-5 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        @media print {
          /* 1. Forcer l'impression des fonds noirs (Vital pour la lisibilité) */
          /* ÉCONOMIE D'ENCRE : On remplace les aplats noirs par des bordures */
          
          /* Cibler les textes surlignés (Gemini met du style inline background: #000) */
          [style*="background: #000"] {
            background-color: transparent !important;
            color: #000 !important;
            font-weight: bold !important;
            border: 1px solid #000 !important;
            padding: 0 4px !important;
            border-radius: 4px !important;
          }

          /* Transformer les blocs "Key Points" (fond noir) en cadres blancs */
          .key-points {
            background-color: transparent !important;
            color: #000 !important;
            border: 3px double #000 !important;
          }

          /* 2. Cacher l'interface de l'app (Boutons, menus...) */
          button, .header-actions, nav, .bottom-nav, .no-print {
            display: none !important;
          }

          /* 3. Réinitialiser le layout pour l'impression */
          body, #root, .fixed {
            position: relative !important;
            overflow: visible !important;
            height: auto !important;
            background: white !important;
          }

          .overflow-y-scroll {
            overflow: visible !important;
          }

          /* 4. Empêcher de couper les cadres en deux */
          .definition, .example, .formula, .important, .key-points, h1, h2, h3 {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 1rem;
          }
          
          /* 5. Nettoyer les ombres */
          .glass-card, .shadow-lg {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }
        }
      `}</style>

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
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors flex items-center gap-2"
            title="Imprimer ou Sauvegarder en PDF"
          >
            <span>🖨️</span>
            <span>PDF / Imprimer</span>
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
        <div className="bg-white rounded-2xl p-8 shadow-lg synthesis-container">
          <div
            dangerouslySetInnerHTML={renderContent(synthesis.html)}
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
