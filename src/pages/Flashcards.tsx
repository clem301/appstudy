import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import katex from 'katex'
import { getAllFlashcards, getFlashcardsDueForReview, saveFlashcard, deleteFlashcard, updateFlashcard, getAllSyntheses, deleteSynthesis } from '../services/storage'
import { createNewFlashcard, isDueForReview, getDaysUntilReview } from '../services/sm2'
import type { Flashcard, FlashcardRating } from '../types/flashcard'
import type { Synthesis } from '../types/synthesis'

type ViewMode = 'library' | 'review' | 'create'

interface FolderNode {
  id: string
  name: string
  type: 'subject' | 'synthesis' | 'card'
  children?: FolderNode[]
  card?: Flashcard
  cardCount?: number
}

// Helper pour afficher le contenu (texte ou maths)
const DisplayContent = ({ content }: { content: string }) => {
  if (!content.includes('$')) return <>{content}</>

  let html = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch (err) {
      return match
    }
  })

  html = html.replace(/\$([^$]+?)\$/g, (match, tex) => {
    if (tex.match(/^\s/) || tex.match(/\s$/)) return match
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch (err) {
      return match
    }
  })

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export function Flashcards() {
  const [mode, setMode] = useState<ViewMode>('library')
  const [allCards, setAllCards] = useState<Flashcard[]>([])
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])
  const [syntheses, setSyntheses] = useState<Synthesis[]>([])

  // Tree view - dossiers expandables
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // État pour la création/édition
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [subject, setSubject] = useState('')
  const [selectedSynthesisId, setSelectedSynthesisId] = useState<string>('')

  useEffect(() => {
    loadFlashcards()
  }, [])

  async function loadFlashcards() {
    const cards = await getAllFlashcards()
    const due = await getFlashcardsDueForReview()
    const synths = await getAllSyntheses()

    setAllCards(cards)
    setDueCards(due)
    setSyntheses(synths)

    // Extraire les matières uniques
    const uniqueSubjects = Array.from(new Set(cards.map(c => c.subject))).sort()
    setSubjects(uniqueSubjects)
  }

  function getSynthesisTitle(synthesisId?: string): string | null {
    if (!synthesisId) return null
    const synthesis = syntheses.find(s => s.id === synthesisId)
    return synthesis ? synthesis.title : null
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  function buildFolderTree(): FolderNode[] {
    const cards = selectedSubject === 'all' ? allCards : allCards.filter(c => c.subject === selectedSubject)

    // Grouper par matière
    const subjectMap = new Map<string, Flashcard[]>()
    cards.forEach(card => {
      if (!subjectMap.has(card.subject)) {
        subjectMap.set(card.subject, [])
      }
      subjectMap.get(card.subject)!.push(card)
    })

    // Construire l'arbre
    const tree: FolderNode[] = []

    Array.from(subjectMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([subject, subjectCards]) => {
        // Grouper par synthèse
        const synthesisMap = new Map<string, Flashcard[]>()
        const noSynthesisCards: Flashcard[] = []

        subjectCards.forEach(card => {
          if (card.synthesisId) {
            const synthId = card.synthesisId
            if (!synthesisMap.has(synthId)) {
              synthesisMap.set(synthId, [])
            }
            synthesisMap.get(synthId)!.push(card)
          } else {
            noSynthesisCards.push(card)
          }
        })

        const subjectChildren: FolderNode[] = []

        // Ajouter les dossiers de synthèses
        Array.from(synthesisMap.entries())
          .sort(([a], [b]) => {
            const titleA = getSynthesisTitle(a) || ''
            const titleB = getSynthesisTitle(b) || ''
            return titleA.localeCompare(titleB)
          })
          .forEach(([synthId, synthCards]) => {
            const synthTitle = getSynthesisTitle(synthId) || 'Sans titre'

            // Trier les cartes par date
            const sortedCards = [...synthCards].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            const cardNodes: FolderNode[] = sortedCards.map(card => ({
              id: card.id,
              name: card.question,
              type: 'card',
              card,
            }))

            subjectChildren.push({
              id: `synthesis-${synthId}`,
              name: synthTitle,
              type: 'synthesis',
              children: cardNodes,
              cardCount: synthCards.length,
            })
          })

        // Ajouter les cartes sans synthèse directement dans la matière
        if (noSynthesisCards.length > 0) {
          const sortedCards = [...noSynthesisCards].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )

          sortedCards.forEach(card => {
            subjectChildren.push({
              id: card.id,
              name: card.question,
              type: 'card',
              card,
            })
          })
        }

        tree.push({
          id: `subject-${subject}`,
          name: subject,
          type: 'subject',
          children: subjectChildren,
          cardCount: subjectCards.length,
        })
      })

    return tree
  }

  async function handleCreateCard() {
    if (!question.trim() || !answer.trim() || !subject.trim()) return

    // Passer les cartes existantes pour l'étalement intelligent
    const cardData = createNewFlashcard({
      question: question.trim(),
      answer: answer.trim(),
      explanation: explanation.trim() || undefined,
      subject: subject.trim(),
      synthesisId: selectedSynthesisId || undefined,
      tags: [],
    }, allCards, 20) // Limite: max 20 nouvelles cartes par jour

    await saveFlashcard(cardData)

    resetForm()
    setShowCreateModal(false)
    await loadFlashcards()
  }

  async function handleDeleteCard(id: string) {
    if (confirm('Supprimer cette flashcard ?')) {
      await deleteFlashcard(id)
      await loadFlashcards()
    }
  }

  async function handleDeleteFolder(node: FolderNode) {
    if (node.type === 'synthesis') {
      const synthesisId = node.id.replace('synthesis-', '')
      if (confirm(`Supprimer le dossier "${node.name}" et ses ${node.cardCount} cartes ?\n\nCela supprimera également la synthèse associée.`)) {
        await deleteSynthesis(synthesisId)
        await loadFlashcards()
      }
    } else if (node.type === 'subject') {
      alert('Pour supprimer une matière, supprimez tous les dossiers qu\'elle contient.')
    }
  }

  function handleReviewFolder(node: FolderNode) {
    let cardsToReview: Flashcard[] = []

    if (node.type === 'synthesis') {
      const synthesisId = node.id.replace('synthesis-', '')
      cardsToReview = allCards.filter(c => c.synthesisId === synthesisId)
    } else if (node.type === 'subject') {
      cardsToReview = allCards.filter(c => c.subject === node.name)
    }

    if (cardsToReview.length > 0) {
      setDueCards(cardsToReview)
      setMode('review')
    } else {
      alert("Ce dossier est vide.")
    }
  }

  function resetForm() {
    setQuestion('')
    setAnswer('')
    setExplanation('')
    setSubject('')
    setSelectedSynthesisId('')
    setEditingCard(null)
  }

  function openCreateModal() {
    resetForm()
    setShowCreateModal(true)
  }

  // Composant récursif pour afficher l'arbre
  function FolderTreeNode({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
    const isExpanded = expandedFolders.has(node.id)
    const isFolder = node.type === 'subject' || node.type === 'synthesis'

    if (node.type === 'card' && node.card) {
      const card = node.card
      const daysUntil = getDaysUntilReview(card)
      const due = isDueForReview(card)

      return (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-3 rounded-lg ml-8"
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {due && (
                  <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                    À réviser
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white text-sm">
                <DisplayContent content={card.question} />
              </h3>
            </div>
            <button
              onClick={() => handleDeleteCard(card.id)}
              className="text-red-400 hover:text-red-300 ml-2 text-sm"
            >
              🗑️
            </button>
          </div>

          <div className="text-white/60 text-xs mb-2">
            <DisplayContent content={card.answer} />
          </div>

          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>📊 {card.reviewCount}</span>
            <span>✅ {Math.round((card.correctCount / Math.max(card.reviewCount, 1)) * 100)}%</span>
            <span>
              {due
                ? '🔴 Aujourd\'hui'
                : daysUntil > 0
                  ? `🟢 ${daysUntil}j`
                  : `🟡 -${Math.abs(daysUntil)}j`
              }
            </span>
          </div>
        </motion.div>
      )
    }

    return (
      <div className={depth === 0 ? 'mb-2' : ''}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => isFolder && toggleFolder(node.id)}
          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition ${
            node.type === 'subject'
              ? 'bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30'
              : 'bg-white/5 hover:bg-white/10 ml-4 border border-white/10'
          }`}
        >
          {isFolder && (
            <span className="text-white/70 text-lg">
              {isExpanded ? '📂' : '📁'}
            </span>
          )}
          <span className={`flex-1 font-semibold ${
            node.type === 'subject' ? 'text-white text-base' : 'text-white/90 text-sm'
          }`}>
            {node.name}
          </span>
          
          {(node.type === 'synthesis' || node.type === 'subject') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReviewFolder(node)
              }}
              className="p-1.5 text-white/40 hover:text-green-400 hover:bg-white/5 rounded transition mr-1"
              title="Réviser tout ce dossier"
            >
              ▶️
            </button>
          )}

          {node.type === 'synthesis' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteFolder(node)
              }}
              className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded transition mr-1"
              title="Supprimer ce dossier"
            >
              🗑️
            </button>
          )}

          {node.cardCount !== undefined && (
            <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded">
              {node.cardCount}
            </span>
          )}
        </motion.div>

        <AnimatePresence>
          {isExpanded && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {node.children.map(child => (
                  <FolderTreeNode key={child.id} node={child} depth={depth + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (mode === 'library') {
    const folderTree = buildFolderTree()

    return (
      <div className="fixed inset-0 overflow-y-scroll pb-20 p-6 bg-[#0f172a]" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="container max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">🎴 Flashcards</h1>
              <p className="text-white/60 mt-1">
                {dueCards.length} carte{dueCards.length > 1 ? 's' : ''} à réviser aujourd'hui
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transform hover:scale-105 transition"
            >
              + Nouvelle carte
            </button>
          </div>

          {/* Bouton révision */}
          {dueCards.length > 0 && (
            <motion.button
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setMode('review')}
              className="w-full mb-6 p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl text-white font-bold text-xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg"
            >
              🚀 Commencer la révision ({dueCards.length} carte{dueCards.length > 1 ? 's' : ''})
            </motion.button>
          )}

          {/* Filtres par matière */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                selectedSubject === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Toutes ({allCards.length})
            </button>
            {subjects.map(subj => {
              const count = allCards.filter(c => c.subject === subj).length
              return (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                    selectedSubject === subj
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {subj} ({count})
                </button>
              )
            })}
          </div>

          {/* Arbre hiérarchique de dossiers */}
          <div className="space-y-2">
            {folderTree.map(node => (
              <FolderTreeNode key={node.id} node={node} />
            ))}

            {folderTree.length === 0 && (
              <div className="text-center text-white/50 py-12">
                <p className="text-lg mb-4">Aucune flashcard pour le moment</p>
                <button
                  onClick={openCreateModal}
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  Créer la première carte
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal création */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-800 p-6 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Nouvelle Flashcard</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 mb-2">Matière *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-orange-500 focus:outline-none"
                    placeholder="Ex: Mathématiques"
                    list="subjects-list"
                  />
                  <datalist id="subjects-list">
                    {subjects.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-white/80 mb-2">Synthèse / Cours (optionnel)</label>
                  <select
                    value={selectedSynthesisId}
                    onChange={(e) => setSelectedSynthesisId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Aucune synthèse</option>
                    {syntheses
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map(synth => (
                        <option key={synth.id} value={synth.id}>
                          {synth.subject} - {synth.title}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-white/80 mb-2">Question *</label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-orange-500 focus:outline-none resize-none"
                    placeholder="Ex: Qu'est-ce qu'une dérivée ?"
                  />
                </div>

                <div>
                  <label className="block text-white/80 mb-2">Réponse *</label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-orange-500 focus:outline-none resize-none"
                    placeholder="La réponse à la question..."
                  />
                </div>

                <div>
                  <label className="block text-white/80 mb-2">Explication (optionnelle)</label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-orange-500 focus:outline-none resize-none"
                    placeholder="Contexte ou explication supplémentaire..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateCard}
                  disabled={!question.trim() || !answer.trim() || !subject.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Créer
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    )
  }

  // Mode révision
  return <ReviewMode cards={dueCards} onComplete={() => {
    loadFlashcards()
    setMode('library')
  }} />
}

// Composant de révision avec animation 3D flip et mode "Drill" (Bachotage)
function ReviewMode({ cards, onComplete }: { cards: Flashcard[], onComplete: () => void }) {
  // File d'attente des cartes à réviser
  const [queue, setQueue] = useState<Flashcard[]>(cards)
  // Cartes qui ont déjà été notées une fois dans cette session (pour ne pas fausser les stats SM-2)
  const [ratedCardIds, setRatedCardIds] = useState<Set<string>>(new Set())
  
  const [isFlipped, setIsFlipped] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  // Simulation des futurs intervalles pour l'affichage
  const formatInterval = (interval: number): string => {
    if (interval === 0) return 'Maintenant'
    if (interval < 1) return `${Math.round(interval * 24)}h`
    return `${Math.round(interval)}j`
  }

  // Si la file est vide, c'est fini !
  if (queue.length === 0) {
    return (
      <div className="fixed inset-0 overflow-y-scroll pb-20 p-6 bg-[#0f172a] flex items-center justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-6xl mb-6"
          >
            🎉
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-4">Session terminée !</h2>
          <p className="text-white/70 mb-6">
            Vous avez maîtrisé {reviewedCount} carte{reviewedCount > 1 ? 's' : ''} aujourd'hui.
          </p>
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition"
          >
            Retour à la bibliothèque
          </button>
        </div>
      </div>
    )
  }

  const currentCard = queue[0]

  // Simulation rapide des prochains intervalles pour l'affichage (logique simplifiée pour UI)
  const isExamMode = localStorage.getItem('appstudy_exam_mode') === 'true'
  const rep = currentCard.repetitions
  const ef = currentCard.easeFactor

  const calcNext = (ratingQuality: number) => {
    let nextI = 0
    if (ratingQuality < 3) {
      nextI = 0
    } else {
      if (rep === 0) nextI = 4/24
      else if (rep === 1) nextI = 8/24
      else if (rep === 2) nextI = 16/24
      else if (rep === 3) nextI = 1
      else if (rep === 4) nextI = 2
      else if (rep === 5) nextI = 4
      else nextI = Math.round(currentCard.interval * ef)
      
      if (nextI > 7) nextI = 7
      if (isExamMode) nextI = nextI / 3
    }
    return nextI
  }

  const nextIntervals = {
    again: 0, // Toujours 0 (Maintenant)
    good: calcNext(4) // Intervalle si réussite
  }

  async function handleRating(rating: FlashcardRating) {
    const { calculateSM2 } = await import('../services/sm2')

    // Est-ce la première fois qu'on note cette carte dans la session ?
    const isFirstReview = !ratedCardIds.has(currentCard.id)

    if (isFirstReview) {
      // 1. Sauvegarder le résultat SM-2 (Intervalle long terme)
      const sm2Result = calculateSM2(currentCard, rating, 1.0)
      
      const isCorrect = rating === 'good' || rating === 'easy'
      const updates = {
        ...sm2Result,
        reviewCount: currentCard.reviewCount + 1,
        correctCount: currentCard.correctCount + (isCorrect ? 1 : 0),
        incorrectCount: currentCard.incorrectCount + (isCorrect ? 0 : 1),
        lastReviewed: new Date(),
      }
      
      await updateFlashcard(currentCard.id, updates)
      
      // Marquer comme notée
      setRatedCardIds(prev => new Set(prev).add(currentCard.id))
    }

    // 2. Gérer le Drill (File d'attente session)
    if (rating === 'again' || rating === 'hard') {
      // Mauvaise réponse : On remet la carte à la fin de la file
      setQueue(prev => {
        const [, ...rest] = prev
        return [...rest, currentCard]
      })
      // Pas d'alerte
    } else {
      // Bonne réponse : On la retire
      setQueue(prev => prev.slice(1))
      setReviewedCount(prev => prev + 1)
    }

    setIsFlipped(false)
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll pb-20 p-6 bg-[#0f172a]" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">
              Reste : {queue.length} carte{queue.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={onComplete}
              className="text-white/60 hover:text-white transition text-sm"
            >
              Quitter
            </button>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              className="bg-orange-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(reviewedCount / (cards.length)) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Matière badge */}
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm">
            {currentCard.subject}
          </span>
        </div>

        {/* Carte 3D flip */}
        <div className="perspective-1000 mb-8" style={{ minHeight: '400px' }}>
          <motion.div
            className="relative w-full h-full cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)} // Toggle
            style={{
              transformStyle: 'preserve-3d',
              minHeight: '400px',
            }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
          >
            {/* Face avant - Question */}
            <div
              className="absolute inset-0 glass-card p-8 rounded-3xl flex flex-col items-center justify-center text-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div className="text-4xl mb-6">❓</div>
              <h2 className="text-2xl font-bold text-white mb-4 select-text">
                <DisplayContent content={currentCard.question} />
              </h2>
              {!isFlipped && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white/50 text-sm mt-4"
                >
                  Appuyez pour révéler la réponse
                </motion.p>
              )}
            </div>

            {/* Face arrière - Réponse */}
            <div
              className="absolute inset-0 glass-card p-8 rounded-3xl flex flex-col items-center justify-center text-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="text-4xl mb-6">💡</div>
              <h2 className="text-xl font-bold text-white mb-4 select-text">
                <DisplayContent content={currentCard.answer} />
              </h2>
              {currentCard.explanation && (
                <div className="text-white/70 text-sm mt-4 max-w-md select-text">
                  <DisplayContent content={currentCard.explanation} />
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Boutons de notation */}
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            <button
              onClick={() => handleRating('again')}
              className="p-4 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 rounded-xl text-white transition flex flex-col items-center justify-center h-32"
            >
              <div className="text-4xl mb-2">❌</div>
              <div className="font-bold text-lg">Recommencer</div>
              <div className="text-sm text-white/60 mt-1">{formatInterval(nextIntervals.again)}</div>
            </button>

            <button
              onClick={() => handleRating('good')}
              className="p-4 bg-green-500/20 hover:bg-green-500/30 border-2 border-green-500/50 rounded-xl text-white transition flex flex-col items-center justify-center h-32"
            >
              <div className="text-4xl mb-2">👍</div>
              <div className="font-bold text-lg">Bon</div>
              <div className="text-sm text-white/60 mt-1">{formatInterval(nextIntervals.good)}</div>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
