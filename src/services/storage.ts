import Dexie, { type Table } from 'dexie'
import type { Synthesis } from '../types/synthesis'
import type { Flashcard } from '../types/flashcard'
import type { PlannerTask } from '../types/planner'
import type { Book, BookNote } from '../types/bookNote'
import type { Project, PersonalEvent } from '../types/project'
import type { User } from '../types/user'
import { getCurrentUserId } from './userService'
import * as supabaseService from './supabase'

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

// Fonction pour réinitialiser complètement la base de données locale
export async function resetLocalDatabase(): Promise<void> {
  console.log('🗑️ Suppression de toutes les données locales...')
  await db.syntheses.clear()
  await db.flashcards.clear()
  await db.tasks.clear()
  await db.books.clear()
  await db.bookNotes.clear()
  await db.projects.clear()
  await db.personalEvents.clear()
  console.log('✅ Base de données locale vidée')
}

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

  // 2. Sync au backend (Supabase)
  try {
    await supabaseService.createSynthesis(newSynthesis)
    console.log('✅ Synthèse sauvegardée sur Supabase')
  } catch (err: any) {
    console.warn('⚠️ Sync Supabase échouée (sera rejouée plus tard):', err.message)
  }

  return id
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

  // 2. Sync suppression au backend
  supabaseService.deleteSynthesis(id).catch(err => {
    console.warn('⚠️ Sync suppression Supabase échouée:', err.message)
  })
}

export async function updateSynthesis(id: string, updates: Partial<Synthesis>): Promise<void> {
  const now = new Date()

  // 1. Mise à jour locale
  await db.syntheses.update(id, {
    ...updates,
    updatedAt: now,
  })

  // 2. Sync au backend
  const synthesis = await db.syntheses.get(id)
  if (synthesis) {
    supabaseService.createSynthesis(synthesis).catch(err => {
      console.warn('⚠️ Sync mise à jour Supabase échouée:', err.message)
    })
  }
}

export async function getSynthesesBySubject(subject: string): Promise<Synthesis[]> {
  const userId = await getCurrentUserId()
  const allSyntheses = await db.syntheses.where('subject').equals(subject).toArray()
  return allSyntheses.filter((syn: any) => syn.userId === userId)
}

/**
 * Synchronise avec Supabase au démarrage de l'app
 * Stratégie : Supabase est la source de vérité. On télécharge tout et on écrase le local.
 */
export async function syncWithBackend(): Promise<{ synced: number; deleted: number; errors: number }> {
  if (!supabaseService.isSupabaseEnabled()) {
    console.log('⚠️ Supabase non configuré - Mode offline uniquement')
    return { synced: 0, deleted: 0, errors: 0 }
  }

  try {
    console.log('🔄 Synchronisation avec Supabase...')
    const userId = await getCurrentUserId()
    let synced = 0
    let errors = 0

    // --- 1. Syntheses ---
    try {
      const remoteSyntheses = await supabaseService.fetchAllSyntheses()
      await db.transaction('rw', db.syntheses, async () => {
        await db.syntheses.where('userId').equals(userId).delete()
        for (const syn of remoteSyntheses) {
          await db.syntheses.add({ ...syn, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteSyntheses.length} synthèses synchronisées`)
    } catch (err) {
      console.error('❌ Erreur sync syntheses:', err)
      errors++
    }

    // --- 2. Flashcards ---
    try {
      const remoteFlashcards = await supabaseService.fetchAllFlashcards()
      await db.transaction('rw', db.flashcards, async () => {
        await db.flashcards.where('userId').equals(userId).delete()
        for (const card of remoteFlashcards) {
          await db.flashcards.add({ ...card, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteFlashcards.length} flashcards synchronisées`)
    } catch (err) {
      console.error('❌ Erreur sync flashcards:', err)
      errors++
    }

    // --- 3. Books ---
    try {
      const remoteBooks = await supabaseService.fetchAllBooks()
      await db.transaction('rw', db.books, async () => {
        await db.books.where('userId').equals(userId).delete()
        for (const book of remoteBooks) {
          await db.books.add({ ...book, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteBooks.length} livres synchronisés`)
    } catch (err) {
      console.error('❌ Erreur sync books:', err)
      errors++
    }

    // --- 4. Book Notes ---
    try {
      const remoteNotes = await supabaseService.fetchAllBookNotes()
      await db.transaction('rw', db.bookNotes, async () => {
        await db.bookNotes.where('userId').equals(userId).delete()
        for (const note of remoteNotes) {
          await db.bookNotes.add({ ...note, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteNotes.length} notes synchronisées`)
    } catch (err) {
      console.error('❌ Erreur sync notes:', err)
      errors++
    }

    // --- 5. Projects (Planning) ---
    try {
      const remoteProjects = await supabaseService.fetchAllProjects()
      await db.transaction('rw', db.projects, async () => {
        await db.projects.where('userId').equals(userId).delete()
        for (const proj of remoteProjects) {
          await db.projects.add({ ...proj, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteProjects.length} projets synchronisés`)
    } catch (err) {
      console.error('❌ Erreur sync projets:', err)
      errors++
    }

    // --- 6. Personal Events ---
    try {
      const remoteEvents = await supabaseService.fetchAllPersonalEvents()
      await db.transaction('rw', db.personalEvents, async () => {
        await db.personalEvents.where('userId').equals(userId).delete()
        for (const evt of remoteEvents) {
          await db.personalEvents.add({ ...evt, userId } as any)
          synced++
        }
      })
      console.log(`✅ ${remoteEvents.length} événements synchronisés`)
    } catch (err) {
      console.error('❌ Erreur sync events:', err)
      errors++
    }

    console.log(`✅ Sync Supabase terminée: ${synced} éléments mis à jour`)
    return { synced, deleted: 0, errors }

  } catch (error) {
    console.error('❌ Erreur globale sync Supabase:', error)
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

  // 1. Sauvegarde locale
  await db.flashcards.add({ ...newFlashcard, userId } as any)

  // 2. Sync au backend
  supabaseService.createFlashcard(newFlashcard).catch(err => {
    console.warn('⚠️ Sync flashcard Supabase échouée:', err.message)
  })

  return id
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
    supabaseService.createFlashcard(flashcard).catch(err => {
      console.warn('⚠️ Sync update flashcard Supabase échouée:', err.message)
    })
  }
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id)

  // Sync suppression au backend
  supabaseService.deleteFlashcard(id).catch(err => {
    console.warn('⚠️ Sync suppression flashcard Supabase échouée:', err.message)
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

  // 2. Sync au backend
  supabaseService.createBook(newBook).catch(err => {
    console.warn('⚠️ Sync book Supabase échouée:', err.message)
  })

  return id
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

  // 2. Sync suppression au backend
  supabaseService.deleteBook(id).catch(err => {
    console.warn('⚠️ Sync suppression book Supabase échouée:', err.message)
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

  // 2. Sync au backend
  supabaseService.createBookNote(newNote).catch(err => {
    console.warn('⚠️ Sync note Supabase échouée:', err.message)
  })

  return id
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
  // Trier par page
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

  // 2. Sync suppression au backend
  supabaseService.deleteBookNote(id).catch(err => {
    console.warn('⚠️ Sync suppression note Supabase échouée:', err.message)
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

  // 1. Sauvegarde locale
  await db.projects.add(newProject as any)

  // 2. Sync au backend
  supabaseService.createProject(newProject as any).catch(err => {
    console.warn('⚠️ Sync project Supabase échouée:', err.message)
  })

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
  const now = new Date()
  
  // 1. Mise à jour locale
  await db.projects.update(id, {
    ...updates,
    updatedAt: now,
  })

  // 2. Sync au backend
  const project = await db.projects.get(id)
  if (project) {
    supabaseService.createProject(project as any).catch(err => {
      console.warn('⚠️ Sync update project Supabase échouée:', err.message)
    })
  }
}

export async function deleteProject(id: string): Promise<void> {
  // 1. Suppression locale
  await db.projects.delete(id)

  // 2. Sync suppression au backend
  supabaseService.deleteProject(id).catch(err => {
    console.warn('⚠️ Sync suppression project Supabase échouée:', err.message)
  })
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

  // 1. Sauvegarde locale
  await db.personalEvents.add({ ...newEvent, userId } as any)

  // 2. Sync au backend
  supabaseService.createPersonalEvent(newEvent as any).catch(err => {
    console.warn('⚠️ Sync event Supabase échouée:', err.message)
  })

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
  const now = new Date()

  // 1. Mise à jour locale
  await db.personalEvents.update(id, {
    ...updates,
    updatedAt: now,
  })

  // 2. Sync au backend
  const event = await db.personalEvents.get(id)
  if (event) {
    supabaseService.createPersonalEvent(event as any).catch(err => {
      console.warn('⚠️ Sync update event Supabase échouée:', err.message)
    })
  }
}

export async function deletePersonalEvent(id: string): Promise<void> {
  // 1. Suppression locale
  await db.personalEvents.delete(id)

  // 2. Sync suppression au backend
  supabaseService.deletePersonalEvent(id).catch(err => {
    console.warn('⚠️ Sync suppression event Supabase échouée:', err.message)
  })
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
