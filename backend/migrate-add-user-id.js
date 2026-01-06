const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'appstudy.db'))

console.log('🔄 Migration: Ajout du champ user_id à toutes les tables')

try {
  // Vérifier si la colonne user_id existe déjà dans syntheses
  const columns = db.prepare("PRAGMA table_info(syntheses)").all()
  const hasUserId = columns.some(col => col.name === 'user_id')

  if (hasUserId) {
    console.log('✅ La colonne user_id existe déjà dans les tables')
    process.exit(0)
  }

  // Ajouter user_id aux tables existantes
  db.exec(`
    -- Ajouter user_id à la table syntheses
    ALTER TABLE syntheses ADD COLUMN user_id TEXT DEFAULT 'user_clement';

    -- Ajouter user_id à la table books
    ALTER TABLE books ADD COLUMN user_id TEXT DEFAULT 'user_clement';

    -- Ajouter user_id à la table book_notes
    ALTER TABLE book_notes ADD COLUMN user_id TEXT DEFAULT 'user_clement';

    -- Ajouter user_id à la table flashcards
    ALTER TABLE flashcards ADD COLUMN user_id TEXT DEFAULT 'user_clement';

    -- Créer des index pour améliorer les performances des requêtes par utilisateur
    CREATE INDEX IF NOT EXISTS idx_syntheses_user_id ON syntheses(user_id);
    CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
    CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id);
  `)

  console.log('✅ Migration terminée avec succès')
  console.log('   - Colonne user_id ajoutée à: syntheses, books, book_notes, flashcards')
  console.log('   - Index créés pour optimiser les requêtes par utilisateur')
  console.log('   - Toutes les données existantes sont assignées à user_clement par défaut')

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message)
  process.exit(1)
}
