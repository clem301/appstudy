const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const path = require('path')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' })) // Pour les images base64

// Initialiser la base de données SQLite
const db = new Database(path.join(__dirname, 'appstudy.db'))

// Créer les tables si elles n'existent pas
db.exec(`
  CREATE TABLE IF NOT EXISTS syntheses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    date INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    html TEXT NOT NULL,
    source_images TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    flashcards_generated INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    device_id TEXT
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    cover_image TEXT,
    total_pages INTEGER,
    current_page INTEGER,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS book_notes (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    book_title TEXT NOT NULL,
    page INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    synthesis_id TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT,
    subject TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review INTEGER NOT NULL,
    last_reviewed INTEGER,
    review_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (synthesis_id) REFERENCES syntheses(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_syntheses_date ON syntheses(date DESC);
  CREATE INDEX IF NOT EXISTS idx_syntheses_created_at ON syntheses(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_notes_page ON book_notes(page);
  CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);
  CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON flashcards(subject);
  CREATE INDEX IF NOT EXISTS idx_flashcards_synthesis_id ON flashcards(synthesis_id);
`)

console.log('✅ Base de données SQLite initialisée')

// ============================================
// ROUTES API - SYNTHESES
// ============================================

/**
 * GET /api/syntheses - Récupérer toutes les synthèses
 */
app.get('/api/syntheses', (req, res) => {
  try {
    const syntheses = db.prepare('SELECT * FROM syntheses ORDER BY date DESC').all()

    // Parser les champs JSON
    const parsed = syntheses.map(s => ({
      ...s,
      date: new Date(s.date),
      sourceImages: JSON.parse(s.source_images),
      tags: JSON.parse(s.tags),
      flashcardsGenerated: Boolean(s.flashcards_generated),
    }))

    res.json(parsed)
  } catch (error) {
    console.error('Error fetching syntheses:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/syntheses/:id - Récupérer une synthèse par ID
 */
app.get('/api/syntheses/:id', (req, res) => {
  try {
    const synthesis = db.prepare('SELECT * FROM syntheses WHERE id = ?').get(req.params.id)

    if (!synthesis) {
      return res.status(404).json({ error: 'Synthesis not found' })
    }

    const parsed = {
      ...synthesis,
      date: new Date(synthesis.date),
      sourceImages: JSON.parse(synthesis.source_images),
      tags: JSON.parse(synthesis.tags),
      flashcardsGenerated: Boolean(synthesis.flashcards_generated),
    }

    res.json(parsed)
  } catch (error) {
    console.error('Error fetching synthesis:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/syntheses - Créer une nouvelle synthèse
 */
app.post('/api/syntheses', (req, res) => {
  try {
    const {
      id,
      title,
      subject,
      chapter,
      date,
      rawText,
      html,
      sourceImages,
      pageCount,
      wordCount,
      flashcardsGenerated,
      tags,
      deviceId,
    } = req.body

    const stmt = db.prepare(`
      INSERT INTO syntheses (
        id, title, subject, chapter, date, raw_text, html, source_images,
        page_count, word_count, flashcards_generated, tags, device_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      title,
      subject,
      chapter,
      new Date(date).getTime(),
      rawText,
      html,
      JSON.stringify(sourceImages),
      pageCount,
      wordCount,
      flashcardsGenerated ? 1 : 0,
      JSON.stringify(tags || []),
      deviceId || null,
      Date.now()
    )

    res.status(201).json({ message: 'Synthesis created', id })
  } catch (error) {
    console.error('Error creating synthesis:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/syntheses/:id - Mettre à jour une synthèse
 */
app.put('/api/syntheses/:id', (req, res) => {
  try {
    const { id } = req.params
    const {
      title,
      subject,
      chapter,
      date,
      rawText,
      html,
      sourceImages,
      pageCount,
      wordCount,
      flashcardsGenerated,
      tags,
    } = req.body

    const stmt = db.prepare(`
      UPDATE syntheses SET
        title = ?, subject = ?, chapter = ?, date = ?, raw_text = ?,
        html = ?, source_images = ?, page_count = ?, word_count = ?,
        flashcards_generated = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `)

    const result = stmt.run(
      title,
      subject,
      chapter,
      new Date(date).getTime(),
      rawText,
      html,
      JSON.stringify(sourceImages),
      pageCount,
      wordCount,
      flashcardsGenerated ? 1 : 0,
      JSON.stringify(tags || []),
      Date.now(),
      id
    )

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Synthesis not found' })
    }

    res.json({ message: 'Synthesis updated', id })
  } catch (error) {
    console.error('Error updating synthesis:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/syntheses/:id - Supprimer une synthèse
 */
app.delete('/api/syntheses/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM syntheses WHERE id = ?')
    const result = stmt.run(req.params.id)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Synthesis not found' })
    }

    res.json({ message: 'Synthesis deleted' })
  } catch (error) {
    console.error('Error deleting synthesis:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/sync - Récupérer les synthèses modifiées après une date
 */
app.get('/api/sync', (req, res) => {
  try {
    const { since } = req.query
    const sinceTimestamp = since ? parseInt(since) : 0

    const syntheses = db
      .prepare('SELECT * FROM syntheses WHERE updated_at > ? ORDER BY updated_at DESC')
      .all(sinceTimestamp)

    const parsed = syntheses.map(s => ({
      ...s,
      date: new Date(s.date),
      sourceImages: JSON.parse(s.source_images),
      tags: JSON.parse(s.tags),
      flashcardsGenerated: Boolean(s.flashcards_generated),
    }))

    res.json(parsed)
  } catch (error) {
    console.error('Error syncing:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES API - BOOKS
// ============================================

app.get('/api/books', (req, res) => {
  try {
    const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all()
    const parsed = books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverImage: b.cover_image,
      totalPages: b.total_pages,
      currentPage: b.current_page,
      startedAt: b.started_at,
      finishedAt: b.finished_at,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }))
    res.json(parsed)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/books', (req, res) => {
  try {
    const { id, title, author, coverImage, totalPages, currentPage, startedAt } = req.body

    db.prepare(`INSERT INTO books (id, title, author, cover_image, total_pages, current_page, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, title, author || null, coverImage || null, totalPages || null, currentPage || null,
      new Date(startedAt).getTime(), Date.now()
    )

    res.status(201).json({ message: 'Book created', id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/books/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id)
    db.prepare('DELETE FROM book_notes WHERE book_id = ?').run(req.params.id)
    res.json({ message: 'Book deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES API - BOOK NOTES
// ============================================

app.get('/api/book-notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM book_notes ORDER BY created_at DESC').all()
    const parsed = notes.map(n => ({
      id: n.id,
      bookId: n.book_id,
      bookTitle: n.book_title,
      page: n.page,
      title: n.title,
      content: n.content,
      tags: JSON.parse(n.tags),
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))
    res.json(parsed)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/books/:bookId/notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM book_notes WHERE book_id = ? ORDER BY page, created_at').all(req.params.bookId)
    const parsed = notes.map(n => ({
      id: n.id,
      bookId: n.book_id,
      bookTitle: n.book_title,
      page: n.page,
      title: n.title,
      content: n.content,
      tags: JSON.parse(n.tags),
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))
    res.json(parsed)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/book-notes', (req, res) => {
  try {
    const { id, bookId, bookTitle, page, title, content, tags } = req.body

    db.prepare(`INSERT INTO book_notes (id, book_id, book_title, page, title, content, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, bookId, bookTitle, page || null, title, content, JSON.stringify(tags || []), Date.now()
    )

    res.status(201).json({ message: 'Note created', id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/book-notes/:id', (req, res) => {
  try {
    const { page, title, content, tags } = req.body

    db.prepare(`UPDATE book_notes SET page = ?, title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?`).run(
      page || null, title, content, JSON.stringify(tags || []), Date.now(), req.params.id
    )

    res.json({ message: 'Note updated', id: req.params.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/book-notes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM book_notes WHERE id = ?').run(req.params.id)
    res.json({ message: 'Note deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES API - FLASHCARDS
// ============================================

/**
 * GET /api/flashcards - Récupérer toutes les flashcards
 */
app.get('/api/flashcards', (req, res) => {
  try {
    const flashcards = db.prepare('SELECT * FROM flashcards ORDER BY created_at DESC').all()

    const parsed = flashcards.map(f => ({
      id: f.id,
      synthesisId: f.synthesis_id,
      question: f.question,
      answer: f.answer,
      explanation: f.explanation,
      subject: f.subject,
      tags: JSON.parse(f.tags),
      easeFactor: f.ease_factor,
      interval: f.interval,
      repetitions: f.repetitions,
      nextReview: f.next_review,
      lastReviewed: f.last_reviewed,
      reviewCount: f.review_count,
      correctCount: f.correct_count,
      incorrectCount: f.incorrect_count,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))

    res.json(parsed)
  } catch (error) {
    console.error('Error fetching flashcards:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/flashcards - Créer une nouvelle flashcard
 */
app.post('/api/flashcards', (req, res) => {
  try {
    const {
      id, synthesisId, question, answer, explanation, subject, tags,
      easeFactor, interval, repetitions, nextReview, lastReviewed,
      reviewCount, correctCount, incorrectCount, createdAt, updatedAt
    } = req.body

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO flashcards (
        id, synthesis_id, question, answer, explanation, subject, tags,
        ease_factor, interval, repetitions, next_review, last_reviewed,
        review_count, correct_count, incorrect_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      synthesisId || null,
      question,
      answer,
      explanation || null,
      subject,
      JSON.stringify(tags || []),
      easeFactor,
      interval,
      repetitions,
      nextReview,
      lastReviewed || null,
      reviewCount,
      correctCount,
      incorrectCount,
      createdAt,
      updatedAt
    )

    res.json({ success: true, id })
  } catch (error) {
    console.error('Error creating flashcard:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/flashcards/:id - Mettre à jour une flashcard
 */
app.put('/api/flashcards/:id', (req, res) => {
  try {
    const { id } = req.params
    const {
      question, answer, explanation, subject, tags,
      easeFactor, interval, repetitions, nextReview, lastReviewed,
      reviewCount, correctCount, incorrectCount
    } = req.body

    const stmt = db.prepare(`
      UPDATE flashcards SET
        question = ?,
        answer = ?,
        explanation = ?,
        subject = ?,
        tags = ?,
        ease_factor = ?,
        interval = ?,
        repetitions = ?,
        next_review = ?,
        last_reviewed = ?,
        review_count = ?,
        correct_count = ?,
        incorrect_count = ?,
        updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      question,
      answer,
      explanation || null,
      subject,
      JSON.stringify(tags || []),
      easeFactor,
      interval,
      repetitions,
      nextReview,
      lastReviewed || null,
      reviewCount,
      correctCount,
      incorrectCount,
      Date.now(),
      id
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating flashcard:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/flashcards/:id - Supprimer une flashcard
 */
app.delete('/api/flashcards/:id', (req, res) => {
  try {
    const { id } = req.params
    db.prepare('DELETE FROM flashcards WHERE id = ?').run(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting flashcard:', error)
    res.status(500).json({ error: error.message })
  }
})

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend AppStudy is running!' })
})

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend AppStudy lancé sur http://localhost:${PORT}`)
  console.log(`📊 Base de données: ${path.join(__dirname, 'appstudy.db')}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  db.close()
  console.log('\n✅ Base de données fermée')
  process.exit(0)
})
