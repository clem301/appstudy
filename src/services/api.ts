/**
 * Service API pour communiquer avec le backend Node.js
 * Permet la synchronisation des synthèses entre appareils
 */

import { getCurrentUserId } from './userService'

// Détection automatique de l'URL du backend
function getBackendURL(): string {
  // Si on a une URL configurée dans .env, l'utiliser
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Sinon, détecter automatiquement en fonction de l'URL actuelle
  const currentHost = window.location.hostname

  // Si on accède via le domaine de production (appstudy.be), utiliser HTTPS
  if (currentHost === 'appstudy.be' || currentHost === 'www.appstudy.be') {
    return 'https://appstudy.be/api'
  }

  // Si on accède via Tailscale (100.x.x.x), utiliser l'IP Tailscale
  if (currentHost.startsWith('100.')) {
    return `http://${currentHost}:3001/api`
  }

  // Si on accède via IP locale (192.168.x.x), utiliser cette IP
  if (currentHost.startsWith('192.168.') || currentHost.startsWith('10.') || currentHost.startsWith('172.')) {
    return `http://${currentHost}:3001/api`
  }

  // Par défaut, utiliser localhost
  return 'http://localhost:3001/api'
}

const API_URL = getBackendURL()
console.log('🔗 Backend URL:', API_URL)

export interface SynthesisDTO {
  id: string
  title: string
  subject: string
  chapter: string
  date: Date | string
  rawText: string
  html: string
  sourceImages: string[]
  pageCount: number
  wordCount: number
  flashcardsGenerated: boolean
  tags: string[]
  deviceId?: string
  createdAt?: number
  updatedAt?: number
}

/**
 * Récupère toutes les synthèses depuis le backend
 */
export async function fetchAllSyntheses(): Promise<SynthesisDTO[]> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/syntheses?userId=${userId}`, {
      cache: 'no-store', // Force le bypass du cache
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching syntheses from backend:', error)
    throw error
  }
}

/**
 * Récupère une synthèse par ID
 */
export async function fetchSynthesisById(id: string): Promise<SynthesisDTO> {
  try {
    const response = await fetch(`${API_URL}/syntheses/${id}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching synthesis from backend:', error)
    throw error
  }
}

/**
 * Crée une nouvelle synthèse sur le backend
 */
export async function createSynthesis(synthesis: SynthesisDTO): Promise<void> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/syntheses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...synthesis, userId }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`✅ Synthèse ${synthesis.id} sauvegardée sur le backend`)
  } catch (error) {
    console.error('Error creating synthesis on backend:', error)
    // Ne pas throw - continuer en mode local si backend indisponible
  }
}

/**
 * Met à jour une synthèse existante
 */
export async function updateSynthesis(id: string, synthesis: Partial<SynthesisDTO>): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/syntheses/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(synthesis),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`✅ Synthèse ${id} mise à jour sur le backend`)
  } catch (error) {
    console.error('Error updating synthesis on backend:', error)
  }
}

/**
 * Supprime une synthèse
 */
export async function deleteSynthesis(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/syntheses/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`✅ Synthèse ${id} supprimée du backend`)
  } catch (error) {
    console.error('Error deleting synthesis from backend:', error)
  }
}

/**
 * Synchronise les synthèses modifiées depuis une date
 */
export async function syncSyntheses(since: number = 0): Promise<SynthesisDTO[]> {
  try {
    const userId = await getCurrentUserId()
    const response = await fetch(`${API_URL}/sync?since=${since}&userId=${userId}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error syncing with backend:', error)
    return []
  }
}

/**
 * Vérifie si le backend est disponible
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, { method: 'GET' })
    return response.ok
  } catch (error) {
    return false
  }
}

// ============ BOOKS ============

export interface BookDTO {
  id: string
  title: string
  author?: string
  coverImage?: string
  totalPages?: number
  currentPage?: number
  startedAt: Date | string
  finishedAt?: Date | string
  createdAt?: number
  updatedAt?: number
}

export async function fetchAllBooks(): Promise<BookDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/books?userId=${userId}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
  return await response.json()
}

export async function createBook(book: BookDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...book, userId }),
  })
}

export async function deleteBook(id: string): Promise<void> {
  await fetch(`${API_URL}/books/${id}`, { method: 'DELETE' })
}

// ============ BOOK NOTES ============

export interface BookNoteDTO {
  id: string
  bookId: string
  bookTitle: string
  page?: number
  title: string
  content: string
  tags: string[]
  createdAt?: number
  updatedAt?: number
}

export async function fetchAllBookNotes(): Promise<BookNoteDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/book-notes?userId=${userId}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
  return await response.json()
}

export async function createBookNote(note: BookNoteDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/book-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...note, userId }),
  })
}

export async function deleteBookNote(id: string): Promise<void> {
  await fetch(`${API_URL}/book-notes/${id}`, { method: 'DELETE' })
}

// ============ FLASHCARDS ============

export interface FlashcardDTO {
  id: string
  synthesisId?: string
  question: string
  answer: string
  explanation?: string
  subject: string
  tags: string[]
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: number  // Timestamp
  lastReviewed?: number  // Timestamp
  reviewCount: number
  correctCount: number
  incorrectCount: number
  createdAt: number  // Timestamp
  updatedAt: number  // Timestamp
}

export async function fetchAllFlashcards(): Promise<FlashcardDTO[]> {
  const userId = await getCurrentUserId()
  const response = await fetch(`${API_URL}/flashcards?userId=${userId}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
  return await response.json()
}

export async function createFlashcard(flashcard: FlashcardDTO): Promise<void> {
  const userId = await getCurrentUserId()
  await fetch(`${API_URL}/flashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...flashcard, userId }),
  })
}

export async function updateFlashcard(id: string, flashcard: Partial<FlashcardDTO>): Promise<void> {
  await fetch(`${API_URL}/flashcards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flashcard),
  })
}

export async function deleteFlashcard(id: string): Promise<void> {
  await fetch(`${API_URL}/flashcards/${id}`, { method: 'DELETE' })
}
