/**
 * Algorithme SM-2 (SuperMemo 2) pour la répétition espacée
 *
 * Basé sur l'algorithme original de Piotr Wozniak (1987)
 * Utilisé par Anki, Mnemosyne et autres systèmes SRS
 */

import type { Flashcard, FlashcardRating } from '../types/flashcard'

interface SM2Result {
  interval: number        // Jours jusqu'à la prochaine révision
  repetitions: number     // Nombre de révisions réussies consécutives
  easeFactor: number      // Facteur de facilité (1.3 - 2.5)
  nextReview: Date        // Date de la prochaine révision
}

/**
 * Convertit le rating simple en qualité SM-2 (0-5)
 */
function ratingToQuality(rating: FlashcardRating): number {
  switch (rating) {
    case 'again': return 0  // Échec complet
    case 'hard': return 3   // Correct avec difficulté
    case 'good': return 4   // Correct avec hésitation
    case 'easy': return 5   // Parfait
  }
}

/**
 * Calcule les nouveaux paramètres selon SM-2
 *
 * @param card - La flashcard à mettre à jour
 * @param rating - Qualité de la réponse ('again', 'hard', 'good', 'easy')
 * @param spreadFactor - Facteur d'étalement (0-1) pour éviter trop de cartes le même jour
 * @returns Nouveaux paramètres SM-2
 */
export function calculateSM2(
  card: Flashcard,
  rating: FlashcardRating,
  spreadFactor: number = 0
): SM2Result {
  const quality = ratingToQuality(rating)
  let { easeFactor, interval, repetitions } = card

  // Mise à jour du facteur de facilité (EF)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

  // Contrainte : EF ne peut pas être inférieur à 1.3
  // (Les cartes trop difficiles doivent être reformulées)
  if (easeFactor < 1.3) {
    easeFactor = 1.3
  }

  // Si la réponse est incorrecte (quality < 3), recommencer
  if (quality < 3) {
    repetitions = 0
    interval = 1 // Revoir demain
  } else {
    repetitions += 1

    // Calcul de l'intervalle selon SM-2
    if (repetitions === 1) {
      interval = 1 // Premier jour : revoir demain
    } else if (repetitions === 2) {
      interval = 6 // Deuxième jour : revoir dans 6 jours
    } else {
      // Révisions suivantes : intervalle * facteur de facilité
      interval = Math.round(interval * easeFactor)
    }
  }

  // Étalement : ajouter un petit délai aléatoire pour éviter
  // d'avoir toutes les cartes créées le même jour à réviser le même jour
  let spreadDays = 0
  if (spreadFactor > 0 && repetitions > 0) {
    // Ajouter 0-20% de l'intervalle de manière aléatoire
    const maxSpread = Math.ceil(interval * 0.2 * spreadFactor)
    spreadDays = Math.floor(Math.random() * maxSpread)
  }

  // Calcul de la prochaine date de révision
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval + spreadDays)
  nextReview.setHours(0, 0, 0, 0) // Minuit pour comparaison facile

  return {
    interval: interval + spreadDays,
    repetitions,
    easeFactor: Math.round(easeFactor * 100) / 100, // 2 décimales
    nextReview,
  }
}

/**
 * Vérifie si une carte doit être révisée aujourd'hui
 */
export function isDueForReview(card: Flashcard): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const reviewDate = new Date(card.nextReview)
  reviewDate.setHours(0, 0, 0, 0)

  return reviewDate <= today
}

/**
 * Obtient le nombre de jours restants avant la révision
 * (négatif si en retard)
 */
export function getDaysUntilReview(card: Flashcard): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const reviewDate = new Date(card.nextReview)
  reviewDate.setHours(0, 0, 0, 0)

  const diffTime = reviewDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Crée une nouvelle flashcard avec les paramètres SM-2 par défaut
 * et étalement intelligent pour éviter trop de cartes le même jour
 *
 * @param data - Données de la flashcard
 * @param existingCards - Cartes existantes pour calculer l'étalement optimal
 * @param maxNewPerDay - Nombre maximum de nouvelles cartes par jour (défaut: 20)
 */
export function createNewFlashcard(
  data: Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'lastReviewed' | 'reviewCount' | 'correctCount' | 'incorrectCount' | 'createdAt' | 'updatedAt'>,
  existingCards: Flashcard[] = [],
  maxNewPerDay: number = 20
): Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt'> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  // Compter les cartes à réviser aujourd'hui
  const cardsDueToday = existingCards.filter(card => {
    const reviewDate = new Date(card.nextReview)
    reviewDate.setHours(0, 0, 0, 0)
    return reviewDate.getTime() === todayTime
  }).length

  // Si moins de maxNewPerDay cartes aujourd'hui, planifier pour aujourd'hui
  let daysToAdd = 0
  if (cardsDueToday >= maxNewPerDay) {
    // Sinon, chercher le premier jour disponible
    for (let day = 1; day <= 7; day++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + day)
      targetDate.setHours(0, 0, 0, 0)
      const targetTime = targetDate.getTime()

      const cardsDueOnDay = existingCards.filter(card => {
        const reviewDate = new Date(card.nextReview)
        reviewDate.setHours(0, 0, 0, 0)
        return reviewDate.getTime() === targetTime
      }).length

      if (cardsDueOnDay < maxNewPerDay) {
        daysToAdd = day
        break
      }
    }
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + daysToAdd)
  nextReview.setHours(0, 0, 0, 0)

  return {
    ...data,
    easeFactor: 2.5,      // Valeur par défaut SM-2
    interval: daysToAdd,  // 0 = aujourd'hui, 1 = demain, etc.
    repetitions: 0,       // Aucune révision encore
    nextReview,
    reviewCount: 0,
    correctCount: 0,
    incorrectCount: 0,
  }
}

/**
 * Obtient les cartes à réviser avec priorisation
 * Les cartes en retard sont prioritaires, puis les plus anciennes
 */
export function getCardsForReview(cards: Flashcard[], limit?: number): Flashcard[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Filtrer les cartes à réviser
  const dueCards = cards.filter(card => isDueForReview(card))

  // Trier par priorité :
  // 1. Les plus en retard d'abord (nextReview le plus ancien)
  // 2. À égalité, celles avec le plus de répétitions (plus importantes)
  dueCards.sort((a, b) => {
    const dateA = new Date(a.nextReview).getTime()
    const dateB = new Date(b.nextReview).getTime()

    if (dateA !== dateB) {
      return dateA - dateB // Plus en retard d'abord
    }

    // Si même date, prioriser celles avec plus de répétitions (plus avancées)
    return b.repetitions - a.repetitions
  })

  // Limiter le nombre si spécifié
  return limit ? dueCards.slice(0, limit) : dueCards
}
