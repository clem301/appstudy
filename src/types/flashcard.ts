export interface Flashcard {
  id: string
  synthesisId?: string // Optionnel, pour lier à une synthèse
  question: string
  answer: string
  explanation?: string
  subject: string
  tags: string[]

  // SRS (Spaced Repetition System) - Algorithme SM-2
  easeFactor: number // 1.3 - 2.5 (défaut: 2.5)
  interval: number // Days until next review
  repetitions: number // Nombre de révisions réussies consécutives
  nextReview: Date
  lastReviewed?: Date

  // Stats
  reviewCount: number
  correctCount: number
  incorrectCount: number

  createdAt: Date
  updatedAt: Date
}

/**
 * Qualité de réponse simplifiée pour l'UI
 * again = 0-2 (échec, recommencer)
 * hard = 3 (correct mais difficile)
 * good = 4 (correct avec hésitation)
 * easy = 5 (parfait)
 */
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy'

export interface ReviewSession {
  id: string
  subject: string
  cards: Flashcard[]
  startedAt: Date
  completedAt?: Date
  totalReviewed: number
  correctAnswers: number
}
