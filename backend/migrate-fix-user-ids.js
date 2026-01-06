const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'appstudy.db'))

console.log('🔄 Migration: Correction des user_id dans toutes les tables')

try {
  // Afficher l'état actuel
  const syntheses = db.prepare('SELECT id, user_id, title FROM syntheses').all()
  console.log(`\n📊 État actuel des synthèses:`)
  syntheses.forEach(s => {
    console.log(`  - ${s.id}: user_id="${s.user_id}" - "${s.title}"`)
  })

  const books = db.prepare('SELECT id, user_id, title FROM books').all()
  console.log(`\n📚 État actuel des livres:`)
  books.forEach(b => {
    console.log(`  - ${b.id}: user_id="${b.user_id}" - "${b.title}"`)
  })

  const notes = db.prepare('SELECT id, user_id, title FROM book_notes').all()
  console.log(`\n📝 État actuel des notes:`)
  notes.forEach(n => {
    console.log(`  - ${n.id}: user_id="${n.user_id}" - "${n.title}"`)
  })

  const flashcards = db.prepare('SELECT id, user_id, question FROM flashcards').all()
  console.log(`\n🎴 État actuel des flashcards:`)
  flashcards.forEach(f => {
    console.log(`  - ${f.id}: user_id="${f.user_id}" - "${f.question.substring(0, 50)}..."`)
  })

  // Mettre à jour tous les user_id qui ne sont pas 'user_clement' ou 'user_alex'
  console.log('\n🔄 Mise à jour des user_id...')

  const updateSyntheses = db.prepare(`
    UPDATE syntheses
    SET user_id = 'user_clement'
    WHERE user_id != 'user_clement' AND user_id != 'user_alex'
  `)
  const synthesesResult = updateSyntheses.run()
  console.log(`✅ ${synthesesResult.changes} synthèses mises à jour`)

  const updateBooks = db.prepare(`
    UPDATE books
    SET user_id = 'user_clement'
    WHERE user_id != 'user_clement' AND user_id != 'user_alex'
  `)
  const booksResult = updateBooks.run()
  console.log(`✅ ${booksResult.changes} livres mis à jour`)

  const updateNotes = db.prepare(`
    UPDATE book_notes
    SET user_id = 'user_clement'
    WHERE user_id != 'user_clement' AND user_id != 'user_alex'
  `)
  const notesResult = updateNotes.run()
  console.log(`✅ ${notesResult.changes} notes mises à jour`)

  const updateFlashcards = db.prepare(`
    UPDATE flashcards
    SET user_id = 'user_clement'
    WHERE user_id != 'user_clement' AND user_id != 'user_alex'
  `)
  const flashcardsResult = updateFlashcards.run()
  console.log(`✅ ${flashcardsResult.changes} flashcards mises à jour`)

  // Afficher l'état final
  console.log('\n📊 État final:')
  const finalSyntheses = db.prepare('SELECT user_id, COUNT(*) as count FROM syntheses GROUP BY user_id').all()
  finalSyntheses.forEach(s => {
    console.log(`  - user_id="${s.user_id}": ${s.count} synthèses`)
  })

  const finalBooks = db.prepare('SELECT user_id, COUNT(*) as count FROM books GROUP BY user_id').all()
  finalBooks.forEach(b => {
    console.log(`  - user_id="${b.user_id}": ${b.count} livres`)
  })

  const finalNotes = db.prepare('SELECT user_id, COUNT(*) as count FROM book_notes GROUP BY user_id').all()
  finalNotes.forEach(n => {
    console.log(`  - user_id="${n.user_id}": ${n.count} notes`)
  })

  const finalFlashcards = db.prepare('SELECT user_id, COUNT(*) as count FROM flashcards GROUP BY user_id').all()
  finalFlashcards.forEach(f => {
    console.log(`  - user_id="${f.user_id}": ${f.count} flashcards`)
  })

  console.log('\n✅ Migration terminée avec succès')

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message)
  process.exit(1)
} finally {
  db.close()
}
