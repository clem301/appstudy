import Dexie, { type Table } from 'dexie'
import type { Synthesis } from '../types/synthesis'
import type { Flashcard } from '../types/flashcard'
import type { PlannerTask } from '../types/planner'
import type { Book, BookNote } from '../types/bookNote'
import type { Project, PersonalEvent } from '../types/project'
import type { User } from '../types/user'
import { getCurrentUserId } from './userService'
import * as api from './api'

class AppStudyDatabase extends Dexie {
  users!: Table<User>
  syntheses!: Table<Synthesis & { userId: string }>
  flashcards!: Table<Flashcard & { userId: string }>
  tasks!: Table<PlannerTask & { userId: string }>
  books!: Table<Book & { userId: string }>
  bookNotes!: Table<BookNote & { userId: string }>
  projects!: Table<Project & { userId: string }>
  personalEvents!: Table<PersonalEvent & { userId: string }>

  constructor() {
    super('AppStudyDB')
    this.version(6).stores({
      users: 'id, name, lastActive',
      syntheses: 'id, userId, subject, date, createdAt',
      flashcards: 'id, userId, synthesisId, subject, nextReview',
      tasks: 'id, userId, dueDate, forWednesday, completed',
      books: 'id, userId, title, createdAt',
      bookNotes: 'id, userId, bookId, createdAt, page',
      projects: 'id, userId, category, deadline, status, createdAt',
      personalEvents: 'id, userId, startDate, endDate, createdAt',
    })
  }
}

export const db = new AppStudyDatabase()

// ============ SYNTHESES ============

export async function saveSynthesis(synthesis: Omit<Synthesis, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `syn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newSynthesis = {
    ...synthesis,
    id,
    userId,
    createdAt: now,
    updatedAt: now,
  }

  // 1. Sauvegarde locale d'abord (local-first)
  await db.syntheses.add(newSynthesis as any)

  // 2. Sync au backend (non-bloquant)
  syncSynthesisToBackend(newSynthesis).catch(err => {
    console.warn('⚠️ Sync backend échouée (mode offline):', err.message)
  })

  return id
}

async function syncSynthesisToBackend(synthesis: Synthesis): Promise<void> {
  try {
    await api.createSynthesis({
      id: synthesis.id,
      title: synthesis.title,
      subject: synthesis.subject,
      chapter: synthesis.chapter,
      date: synthesis.date,
      rawText: synthesis.rawText,
      html: synthesis.html,
      sourceImages: synthesis.sourceImages,
      pageCount: synthesis.pageCount,
      wordCount: synthesis.wordCount,
      flashcardsGenerated: synthesis.flashcardsGenerated,
      tags: synthesis.tags,
      createdAt: synthesis.createdAt.getTime(),
      updatedAt: synthesis.updatedAt.getTime(),
    })
    console.log('✅ Synthèse synchronisée au backend')
  } catch (error) {
    throw new Error('Backend indisponible')
  }
}

export async function getAllSyntheses(): Promise<Synthesis[]> {
  const userId = await getCurrentUserId()
  return await db.syntheses.where('userId').equals(userId).reverse().sortBy('createdAt')
}

export async function getSynthesisById(id: string): Promise<Synthesis | undefined> {
  return await db.syntheses.get(id)
}

export async function deleteSynthesis(id: string): Promise<void> {
  // 1. Suppression locale d'abord
  await db.syntheses.delete(id)
  // Supprimer aussi les flashcards associées
  await db.flashcards.where('synthesisId').equals(id).delete()

  // 2. Sync suppression au backend (non-bloquant)
  api.deleteSynthesis(id).catch(err => {
    console.warn('⚠️ Sync suppression backend échouée:', err.message)
  })
}

export async function updateSynthesis(id: string, updates: Partial<Synthesis>): Promise<void> {
  const now = new Date()

  // 1. Mise à jour locale
  await db.syntheses.update(id, {
    ...updates,
    updatedAt: now,
  })

  // 2. Sync au backend (non-bloquant)
  const synthesis = await db.syntheses.get(id)
  if (synthesis) {
    syncSynthesisToBackend(synthesis).catch(err => {
      console.warn('⚠️ Sync mise à jour synthesis backend échouée:', err.message)
    })
  }
}

export async function getSynthesesBySubject(subject: string): Promise<Synthesis[]> {
  const userId = await getCurrentUserId()
  const allSyntheses = await db.syntheses.where('subject').equals(subject).toArray()
  return allSyntheses.filter((syn: any) => syn.userId === userId)
}

/**
 * Synchronise avec le backend au démarrage de l'app
 * Récupère les synthèses des autres appareils ET supprime celles qui ont été supprimées
 */
export async function syncWithBackend(): Promise<{ synced: number; deleted: number; errors: number }> {
  try {
    console.log('🔄 Synchronisation avec le backend...')

    // Vérifier si backend disponible avec timeout
    const isOnline = await Promise.race([
      api.checkBackendHealth(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
    ])

    if (!isOnline) {
      console.log('⚠️ Backend indisponible - mode offline')
      return { synced: 0, deleted: 0, errors: 0 }
    }

    // Récupérer toutes les synthèses du backend
    const backendSyntheses = await api.fetchAllSyntheses()
    console.log(`📥 ${backendSyntheses.length} synthèses sur le backend`)

    let synced = 0
    let deleted = 0
    let errors = 0

    // 1. Synchroniser les synthèses du backend vers local
    const backendIds = new Set(backendSyntheses.map(s => s.id))

    for (const backendSyn of backendSyntheses) {
      try {
        const localSyn = await db.syntheses.get(backendSyn.id)

        if (!localSyn) {
          // Nouvelle synthèse - ajouter localement
          const userId = await getCurrentUserId()
          await db.syntheses.add({
            id: backendSyn.id,
            userId,
            title: backendSyn.title,
            subject: backendSyn.subject,
            chapter: backendSyn.chapter,
            date: new Date(backendSyn.date),
            rawText: backendSyn.rawText,
            html: backendSyn.html,
            sourceImages: backendSyn.sourceImages,
            pageCount: backendSyn.pageCount,
            wordCount: backendSyn.wordCount,
            flashcardsGenerated: backendSyn.flashcardsGenerated,
            tags: backendSyn.tags,
            createdAt: new Date(backendSyn.createdAt || Date.now()),
            updatedAt: new Date(backendSyn.updatedAt || Date.now()),
          })
          synced++
          console.log(`✅ Synthèse ${backendSyn.id} ajoutée`)
        } else {
          // Résolution de conflit - la plus récente gagne
          const backendTime = new Date(backendSyn.updatedAt || 0).getTime()
          const localTime = localSyn.updatedAt.getTime()

          if (backendTime > localTime) {
            const userId = await getCurrentUserId()
            await db.syntheses.put({
              id: backendSyn.id,
              userId,
              title: backendSyn.title,
              subject: backendSyn.subject,
              chapter: backendSyn.chapter,
              date: new Date(backendSyn.date),
              rawText: backendSyn.rawText,
              html: backendSyn.html,
              sourceImages: backendSyn.sourceImages,
              pageCount: backendSyn.pageCount,
              wordCount: backendSyn.wordCount,
              flashcardsGenerated: backendSyn.flashcardsGenerated,
              tags: backendSyn.tags,
              createdAt: new Date(backendSyn.createdAt || Date.now()),
              updatedAt: new Date(backendSyn.updatedAt || Date.now()),
            })
            synced++
            console.log(`🔄 Synthèse ${backendSyn.id} mise à jour`)
          }
        }
      } catch (err) {
        console.error(`❌ Erreur sync ${backendSyn.id}:`, err)
        errors++
      }
    }

    // 2. Supprimer localement les synthèses qui n'existent plus sur le backend
    const localSyntheses = await db.syntheses.toArray()
    for (const localSyn of localSyntheses) {
      if (!backendIds.has(localSyn.id)) {
        // Cette synthèse a été supprimée sur le backend - la supprimer localement
        await db.syntheses.delete(localSyn.id)
        await db.flashcards.where('synthesisId').equals(localSyn.id).delete()
        deleted++
        console.log(`🗑️ Synthèse ${localSyn.id} supprimée (n'existe plus sur backend)`)
      }
    }

    // 3. Synchroniser les livres
    const backendBooks = await api.fetchAllBooks()
    console.log(`📚 ${backendBooks.length} livres sur le backend`)
    const backendBookIds = new Set(backendBooks.map(b => b.id))

    for (const backendBook of backendBooks) {
      try {
        const localBook = await db.books.get(backendBook.id)
        if (!localBook) {
          const userId = await getCurrentUserId()
          await db.books.add({
            id: backendBook.id,
            userId,
            title: backendBook.title,
            author: backendBook.author,
            coverImage: backendBook.coverImage,
            totalPages: backendBook.totalPages,
            currentPage: backendBook.currentPage,
            startedAt: new Date(backendBook.startedAt),
            finishedAt: backendBook.finishedAt ? new Date(backendBook.finishedAt) : undefined,
            createdAt: new Date(backendBook.createdAt || Date.now()),
            updatedAt: new Date(backendBook.updatedAt || Date.now()),
          })
          synced++
          console.log(`✅ Livre ${backendBook.title} ajouté`)
        }
      } catch (err) {
        console.error('❌ Erreur sync livre:', err)
        errors++
      }
    }

    const localBooks = await db.books.toArray()
    for (const localBook of localBooks) {
      if (!backendBookIds.has(localBook.id)) {
        await db.books.delete(localBook.id)
        await db.bookNotes.where('bookId').equals(localBook.id).delete()
        deleted++
        console.log(`🗑️ Livre ${localBook.title} supprimé`)
      }
    }

    // 4. Synchroniser les notes
    const backendNotes = await api.fetchAllBookNotes()
    console.log(`📝 ${backendNotes.length} notes sur le backend`)
    const backendNoteIds = new Set(backendNotes.map(n => n.id))

    for (const backendNote of backendNotes) {
      try {
        const localNote = await db.bookNotes.get(backendNote.id)
        if (!localNote) {
          const userId = await getCurrentUserId()
          await db.bookNotes.add({
            id: backendNote.id,
            userId,
            bookId: backendNote.bookId,
            bookTitle: backendNote.bookTitle,
            page: backendNote.page,
            title: backendNote.title,
            content: backendNote.content,
            tags: backendNote.tags,
            createdAt: new Date(backendNote.createdAt || Date.now()),
            updatedAt: new Date(backendNote.updatedAt || Date.now()),
          })
          synced++
          console.log(`✅ Note "${backendNote.title}" ajoutée`)
        }
      } catch (err) {
        console.error('❌ Erreur sync note:', err)
        errors++
      }
    }

    const localNotes = await db.bookNotes.toArray()
    for (const localNote of localNotes) {
      if (!backendNoteIds.has(localNote.id)) {
        await db.bookNotes.delete(localNote.id)
        deleted++
        console.log(`🗑️ Note "${localNote.title}" supprimée`)
      }
    }

    // 5. Synchroniser les flashcards
    const backendFlashcards = await api.fetchAllFlashcards()
    console.log(`🎴 ${backendFlashcards.length} flashcards sur le backend`)
    const backendFlashcardIds = new Set(backendFlashcards.map(f => f.id))

    for (const backendCard of backendFlashcards) {
      try {
        const localCard = await db.flashcards.get(backendCard.id)
        if (!localCard) {
          const userId = await getCurrentUserId()
          await db.flashcards.add({
            id: backendCard.id,
            userId,
            synthesisId: backendCard.synthesisId,
            question: backendCard.question,
            answer: backendCard.answer,
            explanation: backendCard.explanation,
            subject: backendCard.subject,
            tags: backendCard.tags || [],
            easeFactor: backendCard.easeFactor,
            interval: backendCard.interval,
            repetitions: backendCard.repetitions,
            nextReview: new Date(backendCard.nextReview),
            lastReviewed: backendCard.lastReviewed ? new Date(backendCard.lastReviewed) : undefined,
            reviewCount: backendCard.reviewCount,
            correctCount: backendCard.correctCount,
            incorrectCount: backendCard.incorrectCount,
            createdAt: new Date(backendCard.createdAt),
            updatedAt: new Date(backendCard.updatedAt),
          })
          synced++
          console.log(`✅ Flashcard "${backendCard.question.substring(0, 30)}..." ajoutée`)
        }
      } catch (err) {
        console.error('❌ Erreur sync flashcard:', err)
        errors++
      }
    }

    const localFlashcards = await db.flashcards.toArray()
    for (const localCard of localFlashcards) {
      if (!backendFlashcardIds.has(localCard.id)) {
        await db.flashcards.delete(localCard.id)
        deleted++
        console.log(`🗑️ Flashcard "${localCard.question.substring(0, 30)}..." supprimée`)
      }
    }

    console.log(`✅ Sync terminée: ${synced} ajoutées/modifiées, ${deleted} supprimées, ${errors} erreurs`)
    return { synced, deleted, errors }
  } catch (error) {
    console.error('❌ Erreur de synchronisation:', error)
    return { synced: 0, deleted: 0, errors: 1 }
  }
}

// ============ FLASHCARDS ============

export async function saveFlashcard(flashcard: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newFlashcard: Flashcard = {
    ...flashcard,
    id,
    tags: flashcard.tags || [],
    createdAt: now,
    updatedAt: now,
  }

  // 1. Sauvegarde locale d'abord (local-first)
  await db.flashcards.add({ ...newFlashcard, userId } as any)

  // 2. Sync au backend (non-bloquant)
  syncFlashcardToBackend(newFlashcard).catch(err => {
    console.warn('⚠️ Sync flashcard backend échouée (mode offline):', err.message)
  })

  return id
}

async function syncFlashcardToBackend(flashcard: Flashcard): Promise<void> {
  try {
    await api.createFlashcard({
      id: flashcard.id,
      synthesisId: flashcard.synthesisId,
      question: flashcard.question,
      answer: flashcard.answer,
      explanation: flashcard.explanation,
      subject: flashcard.subject,
      tags: flashcard.tags,
      easeFactor: flashcard.easeFactor,
      interval: flashcard.interval,
      repetitions: flashcard.repetitions,
      nextReview: flashcard.nextReview.getTime(),
      lastReviewed: flashcard.lastReviewed?.getTime(),
      reviewCount: flashcard.reviewCount,
      correctCount: flashcard.correctCount,
      incorrectCount: flashcard.incorrectCount,
      createdAt: flashcard.createdAt.getTime(),
      updatedAt: flashcard.updatedAt.getTime(),
    })
  } catch (error) {
    console.error('❌ Sync flashcard backend error:', error)
    throw error
  }
}

export async function getAllFlashcards(): Promise<Flashcard[]> {
  const userId = await getCurrentUserId()
  return await db.flashcards.where('userId').equals(userId).toArray()
}

export async function getFlashcardsBySubject(subject: string): Promise<Flashcard[]> {
  const userId = await getCurrentUserId()
  const allCards = await db.flashcards.where('subject').equals(subject).toArray()
  return allCards.filter((card: any) => card.userId === userId)
}

export async function getFlashcardsDueForReview(): Promise<Flashcard[]> {
  const now = new Date()
  const userId = await getCurrentUserId()
  const allDue = await db.flashcards.where('nextReview').belowOrEqual(now).toArray()
  return allDue.filter((card: any) => card.userId === userId)
}

export async function updateFlashcard(id: string, updates: Partial<Flashcard>): Promise<void> {
  const now = new Date()

  await db.flashcards.update(id, {
    ...updates,
    updatedAt: now,
  })

  // Sync au backend
  const flashcard = await db.flashcards.get(id)
  if (flashcard) {
    syncFlashcardToBackend(flashcard).catch(err => {
      console.warn('⚠️ Sync update flashcard backend échouée:', err.message)
    })
  }
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id)

  // Sync suppression au backend
  api.deleteFlashcard(id).catch(err => {
    console.warn('⚠️ Sync suppression flashcard backend échouée:', err.message)
  })
}

// ============ TASKS ============

export async function saveTask(task: Omit<PlannerTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newTask: PlannerTask = {
    ...task,
    id,
    createdAt: now,
    updatedAt: now,
  }

  await db.tasks.add({ ...newTask, userId } as any)
  return id
}

export async function getAllTasks(): Promise<PlannerTask[]> {
  const userId = await getCurrentUserId()
  const allTasks = await db.tasks.orderBy('dueDate').toArray()
  return allTasks.filter((task: any) => task.userId === userId)
}

export async function updateTask(id: string, updates: Partial<PlannerTask>): Promise<void> {
  await db.tasks.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id)
}

export async function getTasksForWednesday(): Promise<PlannerTask[]> {
  const userId = await getCurrentUserId()
  const allTasks = await db.tasks.where('forWednesday').equals(1).toArray()
  return allTasks.filter((task: any) => task.userId === userId)
}

// ============ BOOKS ============

export async function saveBook(book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newBook: Book = {
    ...book,
    id,
    createdAt: now,
    updatedAt: now,
  }

  // 1. Sauvegarde locale
  await db.books.add({ ...newBook, userId } as any)

  // 2. Sync au backend (non-bloquant)
  syncBookToBackend(newBook).catch(err => {
    console.warn('⚠️ Sync book backend échouée:', err.message)
  })

  return id
}

async function syncBookToBackend(book: Book): Promise<void> {
  try {
    await api.createBook({
      id: book.id,
      title: book.title,
      author: book.author,
      coverImage: book.coverImage,
      totalPages: book.totalPages,
      currentPage: book.currentPage,
      startedAt: book.startedAt,
      finishedAt: book.finishedAt,
      createdAt: book.createdAt.getTime(),
      updatedAt: book.updatedAt.getTime(),
    })
    console.log('✅ Livre synchronisé au backend')
  } catch (error) {
    throw new Error('Backend indisponible')
  }
}

export async function getAllBooks(): Promise<Book[]> {
  const userId = await getCurrentUserId()
  const allBooks = await db.books.orderBy('createdAt').reverse().toArray()
  return allBooks.filter((book: any) => book.userId === userId)
}

export async function getBookById(id: string): Promise<Book | undefined> {
  return await db.books.get(id)
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  await db.books.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function deleteBook(id: string): Promise<void> {
  // 1. Suppression locale
  await db.books.delete(id)
  // Supprimer aussi les notes associées
  await db.bookNotes.where('bookId').equals(id).delete()

  // 2. Sync suppression au backend (non-bloquant)
  api.deleteBook(id).catch(err => {
    console.warn('⚠️ Sync suppression book backend échouée:', err.message)
  })
}

// ============ BOOK NOTES ============

export async function saveBookNote(note: Omit<BookNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newNote: BookNote = {
    ...note,
    id,
    createdAt: now,
    updatedAt: now,
  }

  // 1. Sauvegarde locale
  await db.bookNotes.add({ ...newNote, userId } as any)

  // 2. Sync au backend (non-bloquant)
  syncBookNoteToBackend(newNote).catch(err => {
    console.warn('⚠️ Sync note backend échouée:', err.message)
  })

  return id
}

async function syncBookNoteToBackend(note: BookNote): Promise<void> {
  try {
    await api.createBookNote({
      id: note.id,
      bookId: note.bookId,
      bookTitle: note.bookTitle,
      page: note.page,
      title: note.title,
      content: note.content,
      tags: note.tags,
      createdAt: note.createdAt.getTime(),
      updatedAt: note.updatedAt.getTime(),
    })
    console.log('✅ Note synchronisée au backend')
  } catch (error) {
    throw new Error('Backend indisponible')
  }
}

export async function getAllBookNotes(): Promise<BookNote[]> {
  const userId = await getCurrentUserId()
  const allNotes = await db.bookNotes.orderBy('createdAt').reverse().toArray()
  return allNotes.filter((note: any) => note.userId === userId)
}

export async function getBookNotesByBookId(bookId: string): Promise<BookNote[]> {
  const userId = await getCurrentUserId()
  const allNotes = await db.bookNotes.where('bookId').equals(bookId).toArray()
  const notes = allNotes.filter((note: any) => note.userId === userId)
  // Trier par page (les notes sans page en dernier) puis par date de création
  return notes.sort((a, b) => {
    if (a.page && b.page) return a.page - b.page
    if (a.page && !b.page) return -1
    if (!a.page && b.page) return 1
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

export async function getBookNoteById(id: string): Promise<BookNote | undefined> {
  return await db.bookNotes.get(id)
}

export async function updateBookNote(id: string, updates: Partial<BookNote>): Promise<void> {
  await db.bookNotes.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function deleteBookNote(id: string): Promise<void> {
  // 1. Suppression locale
  await db.bookNotes.delete(id)

  // 2. Sync suppression au backend (non-bloquant)
  api.deleteBookNote(id).catch(err => {
    console.warn('⚠️ Sync suppression note backend échouée:', err.message)
  })
}

// ============ PROJECTS ============

export async function saveProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newProject = {
    ...project,
    id,
    userId,
    createdAt: now,
    updatedAt: now,
  }

  await db.projects.add(newProject as any)
  return id
}

export async function getAllProjects(): Promise<Project[]> {
  const userId = await getCurrentUserId()
  return await db.projects.where('userId').equals(userId).sortBy('deadline')
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return await db.projects.get(id)
}

export async function getProjectsByCategory(category: string): Promise<Project[]> {
  const userId = await getCurrentUserId()
  const allProjects = await db.projects.where('category').equals(category).sortBy('deadline')
  return allProjects.filter((project: any) => project.userId === userId)
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  await db.projects.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id)
}

export async function getUpcomingProjects(): Promise<Project[]> {
  const now = new Date()
  const userId = await getCurrentUserId()
  const allProjects = await db.projects
    .where('status')
    .notEqual('completed')
    .toArray()

  const projects = allProjects.filter((project: any) => project.userId === userId)

  return projects
    .filter(p => new Date(p.deadline) >= now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
}

// ============ PERSONAL EVENTS ============

export async function savePersonalEvent(event: Omit<PersonalEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const userId = await getCurrentUserId()

  const newEvent: PersonalEvent = {
    ...event,
    id,
    createdAt: now,
    updatedAt: now,
  }

  await db.personalEvents.add({ ...newEvent, userId } as any)
  return id
}

export async function getAllPersonalEvents(): Promise<PersonalEvent[]> {
  const userId = await getCurrentUserId()
  const allEvents = await db.personalEvents.orderBy('startDate').toArray()
  return allEvents.filter((event: any) => event.userId === userId)
}

export async function getPersonalEventById(id: string): Promise<PersonalEvent | undefined> {
  return await db.personalEvents.get(id)
}

export async function getUpcomingPersonalEvents(): Promise<PersonalEvent[]> {
  const now = new Date()
  const userId = await getCurrentUserId()
  const allEvents = await db.personalEvents.toArray()
  const events = allEvents.filter((event: any) => event.userId === userId)

  return events
    .filter(e => new Date(e.endDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
}

export async function updatePersonalEvent(id: string, updates: Partial<PersonalEvent>): Promise<void> {
  await db.personalEvents.update(id, {
    ...updates,
    updatedAt: new Date(),
  })
}

export async function deletePersonalEvent(id: string): Promise<void> {
  await db.personalEvents.delete(id)
}

// ============ STATS ============

export async function getStats() {
  const syntheses = await db.syntheses.count()
  const flashcards = await db.flashcards.count()
  const flashcardsDue = (await getFlashcardsDueForReview()).length
  const allTasks = await db.tasks.toArray()
  const tasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.completed).length
  const books = await db.books.count()
  const bookNotes = await db.bookNotes.count()
  const projects = await db.projects.count()

  return {
    syntheses,
    flashcards,
    flashcardsDue,
    tasks,
    completedTasks,
    books,
    bookNotes,
    projects,
  }
}
