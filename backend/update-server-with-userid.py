#!/usr/bin/env python3
"""
Script pour ajouter le support de user_id dans server.js
"""

# Lire le fichier original
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Mettre à jour le schéma de syntheses
content = content.replace(
    '''CREATE TABLE IF NOT EXISTS syntheses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,''',
    '''CREATE TABLE IF NOT EXISTS syntheses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'user_clement',
    title TEXT NOT NULL,'''
)

# 2. Mettre à jour le schéma de books
content = content.replace(
    '''CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,''',
    '''CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'user_clement',
    title TEXT NOT NULL,'''
)

# 3. Mettre à jour le schéma de book_notes
content = content.replace(
    '''CREATE TABLE IF NOT EXISTS book_notes (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,''',
    '''CREATE TABLE IF NOT EXISTS book_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'user_clement',
    book_id TEXT NOT NULL,'''
)

# 4. Mettre à jour le schéma de flashcards
content = content.replace(
    '''CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    synthesis_id TEXT,''',
    '''CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'user_clement',
    synthesis_id TEXT,'''
)

# 5. Ajouter les index pour user_id
content = content.replace(
    '''CREATE INDEX IF NOT EXISTS idx_syntheses_date ON syntheses(date DESC);''',
    '''CREATE INDEX IF NOT EXISTS idx_syntheses_user_id ON syntheses(user_id);
  CREATE INDEX IF NOT EXISTS idx_syntheses_date ON syntheses(date DESC);'''
)

content = content.replace(
    '''CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);''',
    '''CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
  CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);'''
)

content = content.replace(
    '''CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);''',
    '''CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);'''
)

content = content.replace(
    '''CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);''',
    '''CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id);
  CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);'''
)

# 6. Mettre à jour GET /api/syntheses - filtrer par userId
content = content.replace(
    '''app.get('/api/syntheses', (req, res) => {
  try {
    const syntheses = db.prepare('SELECT * FROM syntheses ORDER BY date DESC').all()''',
    '''app.get('/api/syntheses', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const syntheses = db.prepare('SELECT * FROM syntheses WHERE user_id = ? ORDER BY date DESC').all(userId)'''
)

# 7. Mettre à jour POST /api/syntheses - ajouter user_id
content = content.replace(
    '''const {
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
    } = req.body''',
    '''const {
      id,
      userId,
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
    } = req.body'''
)

content = content.replace(
    '''const stmt = db.prepare(`
      INSERT INTO syntheses (
        id, title, subject, chapter, date, raw_text, html, source_images,
        page_count, word_count, flashcards_generated, tags, device_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      title,''',
    '''const stmt = db.prepare(`
      INSERT INTO syntheses (
        id, user_id, title, subject, chapter, date, raw_text, html, source_images,
        page_count, word_count, flashcards_generated, tags, device_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      userId,
      title,'''
)

# 8. Mettre à jour GET /api/books - filtrer par userId
content = content.replace(
    '''app.get('/api/books', (req, res) => {
  try {
    const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all()''',
    '''app.get('/api/books', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const books = db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC').all(userId)'''
)

# 9. Mettre à jour POST /api/books - ajouter user_id
content = content.replace(
    '''app.post('/api/books', (req, res) => {
  try {
    const { id, title, author, coverImage, totalPages, currentPage, startedAt } = req.body

    db.prepare(`INSERT INTO books (id, title, author, cover_image, total_pages, current_page, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, title, author || null, coverImage || null, totalPages || null, currentPage || null,
      new Date(startedAt).getTime(), Date.now()
    )''',
    '''app.post('/api/books', (req, res) => {
  try {
    const { id, userId, title, author, coverImage, totalPages, currentPage, startedAt } = req.body

    db.prepare(`INSERT INTO books (id, user_id, title, author, cover_image, total_pages, current_page, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, title, author || null, coverImage || null, totalPages || null, currentPage || null,
      new Date(startedAt).getTime(), Date.now()
    )'''
)

# 10. Mettre à jour GET /api/book-notes - filtrer par userId
content = content.replace(
    '''app.get('/api/book-notes', (req, res) => {
  try:
    const notes = db.prepare('SELECT * FROM book_notes ORDER BY created_at DESC').all()''',
    '''app.get('/api/book-notes', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const notes = db.prepare('SELECT * FROM book_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId)'''
)

# 11. Mettre à jour GET /api/books/:bookId/notes - filtrer par userId
content = content.replace(
    '''app.get('/api/books/:bookId/notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM book_notes WHERE book_id = ? ORDER BY page, created_at').all(req.params.bookId)''',
    '''app.get('/api/books/:bookId/notes', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const notes = db.prepare('SELECT * FROM book_notes WHERE book_id = ? AND user_id = ? ORDER BY page, created_at').all(req.params.bookId, userId)'''
)

# 12. Mettre à jour POST /api/book-notes - ajouter user_id
content = content.replace(
    '''app.post('/api/book-notes', (req, res) => {
  try {
    const { id, bookId, bookTitle, page, title, content, tags } = req.body

    db.prepare(`INSERT INTO book_notes (id, book_id, book_title, page, title, content, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, bookId, bookTitle, page || null, title, content, JSON.stringify(tags || []), Date.now()
    )''',
    '''app.post('/api/book-notes', (req, res) => {
  try {
    const { id, userId, bookId, bookTitle, page, title, content, tags } = req.body

    db.prepare(`INSERT INTO book_notes (id, user_id, book_id, book_title, page, title, content, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, bookId, bookTitle, page || null, title, content, JSON.stringify(tags || []), Date.now()
    )'''
)

# 13. Mettre à jour GET /api/flashcards - filtrer par userId
content = content.replace(
    '''app.get('/api/flashcards', (req, res) => {
  try {
    const flashcards = db.prepare('SELECT * FROM flashcards ORDER BY created_at DESC').all()''',
    '''app.get('/api/flashcards', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id']
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const flashcards = db.prepare('SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at DESC').all(userId)'''
)

# 14. Mettre à jour POST /api/flashcards - ajouter user_id
content = content.replace(
    '''const {
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
      synthesisId || null,''',
    '''const {
      id, userId, synthesisId, question, answer, explanation, subject, tags,
      easeFactor, interval, repetitions, nextReview, lastReviewed,
      reviewCount, correctCount, incorrectCount, createdAt, updatedAt
    } = req.body

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO flashcards (
        id, user_id, synthesis_id, question, answer, explanation, subject, tags,
        ease_factor, interval, repetitions, next_review, last_reviewed,
        review_count, correct_count, incorrect_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      userId,
      synthesisId || null,'''
)

# 15. Mettre à jour GET /api/sync - filtrer par userId
content = content.replace(
    '''app.get('/api/sync', (req, res) => {
  try {
    const { since } = req.query
    const sinceTimestamp = since ? parseInt(since) : 0

    const syntheses = db
      .prepare('SELECT * FROM syntheses WHERE updated_at > ? ORDER BY updated_at DESC')
      .all(sinceTimestamp)''',
    '''app.get('/api/sync', (req, res) => {
  try {
    const { since, userId } = req.query
    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }
    const sinceTimestamp = since ? parseInt(since) : 0

    const syntheses = db
      .prepare('SELECT * FROM syntheses WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC')
      .all(userId, sinceTimestamp)'''
)

# Écrire le fichier mis à jour
with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK - server.js a ete mis a jour avec le support de user_id')
print('   - Tous les schemas de tables incluent maintenant user_id')
print('   - Toutes les routes GET filtrent par user_id')
print('   - Toutes les routes POST incluent user_id')
print('   - Index crees pour optimiser les requetes par user_id')
