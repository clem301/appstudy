
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Synthesis } from '../types/synthesis'
import type { Flashcard } from '../types/flashcard'
import type { Book, BookNote } from '../types/bookNote'
import type { PlannerTask } from '../types/planner'
import type { Project, PersonalEvent } from '../types/project'
import { getCurrentUserId } from './userService'

// --- Configuration ---

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Sync will be disabled.')
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function isSupabaseEnabled(): boolean {
  return supabase !== null
}

// --- Authentification ---

export async function signUp(email: string, password: string, name: string) {
  if (!supabase) throw new Error('Supabase non configuré')
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: window.location.origin 
    }
  })
  
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase non configuré')
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
  localStorage.removeItem('appstudy_user_id') 
}

export async function getSupabaseUser() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// --- Types Database (Mapping SQL) ---

interface SynthesisDB {
  id: string
  user_id: string
  title: string
  subject: string
  chapter: string
  date: string 
  raw_text: string
  html: string
  source_images: string[]
  page_count: number
  word_count: number
  flashcards_generated: boolean
  tags: string[]
  created_at: string
  updated_at: string
  device_id?: string
}

interface FlashcardDB {
  id: string
  user_id: string
  synthesis_id?: string
  question: string
  answer: string
  explanation?: string
  subject: string
  tags: string[]
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  last_reviewed?: string
  review_count: number
  correct_count: number
  incorrect_count: number
  created_at: string
  updated_at: string
}

interface BookDB {
  id: string
  user_id: string
  title: string
  author?: string
  cover_image?: string
  total_pages?: number
  current_page?: number
  started_at: string
  finished_at?: string
  created_at: string
  updated_at: string
}

interface BookNoteDB {
  id: string
  user_id: string
  book_id: string
  book_title: string
  page?: number
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

interface ProjectDB {
  id: string
  user_id: string
  category: string
  school_sub_category?: string
  title: string
  description?: string
  deadline: string
  status: string
  priority: string
  user_estimated_hours?: number
  completed_at?: string
  tasks: any[] // JSONB
  created_at: string
  updated_at: string
}

interface PersonalEventDB {
  id: string
  user_id: string
  title: string
  start_date: string
  end_date: string
  is_all_day: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// --- Services ---

// 1. Syntheses
export async function fetchAllSyntheses(): Promise<Synthesis[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('syntheses').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toSynthesis)
}

export async function createSynthesis(synthesis: Synthesis): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: SynthesisDB = {
    id: synthesis.id,
    user_id: userId,
    title: synthesis.title,
    subject: synthesis.subject,
    chapter: synthesis.chapter,
    date: synthesis.date.toISOString(),
    raw_text: synthesis.rawText,
    html: synthesis.html,
    // OPTIMISATION: On n'envoie PAS les images brutes sur Supabase (trop lourd)
    source_images: [], 
    page_count: synthesis.pageCount,
    word_count: synthesis.wordCount,
    flashcards_generated: synthesis.flashcardsGenerated,
    tags: synthesis.tags,
    created_at: synthesis.createdAt.toISOString(),
    updated_at: synthesis.updatedAt.toISOString(),
    device_id: getDeviceId()
  }
  const { error } = await supabase.from('syntheses').upsert(dbRow)
  if (error) console.error('Error saving synthesis:', error)
}

export async function deleteSynthesis(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('syntheses').delete().eq('id', id)
}

// 2. Flashcards
export async function fetchAllFlashcards(): Promise<Flashcard[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('flashcards').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toFlashcard)
}

export async function createFlashcard(flashcard: Flashcard): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: FlashcardDB = {
    id: flashcard.id,
    user_id: userId,
    synthesis_id: flashcard.synthesisId,
    question: flashcard.question,
    answer: flashcard.answer,
    explanation: flashcard.explanation,
    subject: flashcard.subject,
    tags: flashcard.tags,
    ease_factor: flashcard.easeFactor,
    interval: flashcard.interval,
    repetitions: flashcard.repetitions,
    next_review: flashcard.nextReview.toISOString(),
    last_reviewed: flashcard.lastReviewed?.toISOString(),
    review_count: flashcard.reviewCount,
    correct_count: flashcard.correctCount,
    incorrect_count: flashcard.incorrectCount,
    created_at: flashcard.createdAt.toISOString(),
    updated_at: flashcard.updatedAt.toISOString()
  }
  const { error } = await supabase.from('flashcards').upsert(dbRow)
  if (error) console.error('Error saving flashcard:', error)
}

export async function deleteFlashcard(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('flashcards').delete().eq('id', id)
}

// 3. Books
export async function fetchAllBooks(): Promise<Book[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('books').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toBook)
}

export async function createBook(book: Book): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: BookDB = {
    id: book.id,
    user_id: userId,
    title: book.title,
    author: book.author,
    cover_image: book.coverImage,
    total_pages: book.totalPages,
    current_page: book.currentPage,
    started_at: book.startedAt.toISOString(),
    finished_at: book.finishedAt?.toISOString(),
    created_at: book.createdAt.toISOString(),
    updated_at: book.updatedAt.toISOString()
  }
  const { error } = await supabase.from('books').upsert(dbRow)
  if (error) console.error('Error saving book:', error)
}

export async function deleteBook(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('books').delete().eq('id', id)
}

// 4. Book Notes
export async function fetchAllBookNotes(): Promise<BookNote[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('book_notes').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toBookNote)
}

export async function createBookNote(note: BookNote): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: BookNoteDB = {
    id: note.id,
    user_id: userId,
    book_id: note.bookId,
    book_title: note.bookTitle,
    page: note.page,
    title: note.title,
    content: note.content,
    tags: note.tags,
    created_at: note.createdAt.toISOString(),
    updated_at: note.updatedAt.toISOString()
  }
  const { error } = await supabase.from('book_notes').upsert(dbRow)
  if (error) console.error('Error saving note:', error)
}

export async function deleteBookNote(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('book_notes').delete().eq('id', id)
}

// 5. Projects (Planning)
export async function fetchAllProjects(): Promise<Project[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toProject)
}

export async function createProject(project: Project): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: ProjectDB = {
    id: project.id,
    user_id: userId,
    category: project.category,
    school_sub_category: project.schoolSubCategory,
    title: project.title,
    description: project.description,
    deadline: project.deadline.toISOString(),
    status: project.status,
    priority: project.priority,
    user_estimated_hours: project.userEstimatedHours,
    completed_at: project.completedAt?.toISOString(),
    tasks: project.tasks,
    created_at: project.createdAt.toISOString(),
    updated_at: project.updatedAt.toISOString()
  }
  const { error } = await supabase.from('projects').upsert(dbRow)
  if (error) console.error('Error saving project:', error)
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('projects').delete().eq('id', id)
}

// 6. Personal Events
export async function fetchAllPersonalEvents(): Promise<PersonalEvent[]> {
  if (!supabase) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase.from('personal_events').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(toPersonalEvent)
}

export async function createPersonalEvent(event: PersonalEvent): Promise<void> {
  if (!supabase) return
  const userId = await getCurrentUserId()
  const dbRow: PersonalEventDB = {
    id: event.id,
    user_id: userId,
    title: event.title,
    start_date: event.startDate.toISOString(),
    end_date: event.endDate.toISOString(),
    is_all_day: event.isAllDay,
    notes: event.notes,
    created_at: event.createdAt.toISOString(),
    updated_at: event.updatedAt.toISOString()
  }
  const { error } = await supabase.from('personal_events').upsert(dbRow)
  if (error) console.error('Error saving event:', error)
}

export async function deletePersonalEvent(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('personal_events').delete().eq('id', id)
}

// --- Helpers de conversion ---

function toSynthesis(db: SynthesisDB): Synthesis {
  return {
    id: db.id,
    title: db.title,
    subject: db.subject,
    chapter: db.chapter,
    date: new Date(db.date),
    rawText: db.raw_text,
    html: db.html,
    sourceImages: db.source_images || [],
    pageCount: db.page_count,
    wordCount: db.word_count,
    flashcardsGenerated: db.flashcards_generated,
    tags: db.tags || [],
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

function toFlashcard(db: FlashcardDB): Flashcard {
  return {
    id: db.id,
    synthesisId: db.synthesis_id,
    question: db.question,
    answer: db.answer,
    explanation: db.explanation,
    subject: db.subject,
    tags: db.tags || [],
    easeFactor: db.ease_factor,
    interval: db.interval,
    repetitions: db.repetitions,
    nextReview: new Date(db.next_review),
    lastReviewed: db.last_reviewed ? new Date(db.last_reviewed) : undefined,
    reviewCount: db.review_count,
    correctCount: db.correct_count,
    incorrectCount: db.incorrect_count,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

function toBook(db: BookDB): Book {
  return {
    id: db.id,
    title: db.title,
    author: db.author,
    coverImage: db.cover_image,
    totalPages: db.total_pages,
    currentPage: db.current_page,
    startedAt: new Date(db.started_at),
    finishedAt: db.finished_at ? new Date(db.finished_at) : undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

function toBookNote(db: BookNoteDB): BookNote {
  return {
    id: db.id,
    bookId: db.book_id,
    bookTitle: db.book_title,
    page: db.page,
    title: db.title,
    content: db.content,
    tags: db.tags || [],
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

function toProject(db: ProjectDB): Project {
  // Convertir les tâches (surtout les dates qui sont des strings dans le JSON)
  const tasks = (db.tasks || []).map((t: any) => ({
    ...t,
    scheduledDate: t.scheduledDate ? new Date(t.scheduledDate) : undefined,
    completedAt: t.completedAt ? new Date(t.completedAt) : undefined
  }))

  return {
    id: db.id,
    category: db.category as any,
    schoolSubCategory: db.school_sub_category as any,
    title: db.title,
    description: db.description || '',
    deadline: new Date(db.deadline),
    status: db.status as any,
    priority: db.priority as any,
    userEstimatedHours: db.user_estimated_hours || 0,
    completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
    tasks: tasks,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

function toPersonalEvent(db: PersonalEventDB): PersonalEvent {
  return {
    id: db.id,
    title: db.title,
    startDate: new Date(db.start_date),
    endDate: new Date(db.end_date),
    isAllDay: db.is_all_day,
    notes: db.notes,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at)
  }
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}
