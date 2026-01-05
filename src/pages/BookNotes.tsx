import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAllBooks, getAllBookNotes, saveBook, saveBookNote, deleteBook, deleteBookNote, getBookNotesByBookId } from '../services/storage'
import type { Book, BookNote } from '../types/bookNote'

export function BookNotes() {
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [notes, setNotes] = useState<BookNote[]>([])
  const [showNewBookModal, setShowNewBookModal] = useState(false)
  const [showNewNoteModal, setShowNewNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<BookNote | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastBooksHash, setLastBooksHash] = useState<string>('')
  const [lastNotesHash, setLastNotesHash] = useState<string>('')

  // Formulaire nouveau livre
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookAuthor, setNewBookAuthor] = useState('')
  const [newBookPages, setNewBookPages] = useState('')

  // Formulaire nouvelle note
  const [noteTitle, setNoteTitle] = useState('')
  const [notePage, setNotePage] = useState('')
  const [noteContent, setNoteContent] = useState('')

  // Créer un hash simple des données pour détecter les changements
  function createHash(data: any[]): string {
    return JSON.stringify(data.map(d => ({ id: d.id, updatedAt: d.updatedAt })))
  }

  useEffect(() => {
    loadBooks()

    // Vérifier les changements toutes les 10 secondes
    const interval = setInterval(async () => {
      await checkForUpdates()
    }, 10000)

    return () => clearInterval(interval)
  }, []) // Pas de dépendance pour éviter de rafraîchir au changement de livre

  async function checkForUpdates() {
    const allBooks = await getAllBooks()
    const booksHash = createHash(allBooks)

    // Si les livres ont changé, recharger
    if (lastBooksHash !== '' && booksHash !== lastBooksHash) {
      setIsRefreshing(true)
      setBooks(allBooks)
      setLastBooksHash(booksHash)
      setTimeout(() => setIsRefreshing(false), 300)
    } else if (lastBooksHash === '') {
      // Premier chargement, juste mettre à jour le hash
      setLastBooksHash(booksHash)
    }

    // Si un livre est sélectionné, vérifier ses notes
    if (selectedBook) {
      const bookNotes = await getBookNotesByBookId(selectedBook.id)
      const notesHash = createHash(bookNotes)

      if (lastNotesHash !== '' && notesHash !== lastNotesHash) {
        setIsRefreshing(true)
        setNotes(bookNotes)
        setLastNotesHash(notesHash)
        setTimeout(() => setIsRefreshing(false), 300)
      } else if (lastNotesHash === '') {
        // Premier chargement, juste mettre à jour le hash
        setLastNotesHash(notesHash)
      }
    }
  }

  useEffect(() => {
    if (selectedBook) {
      loadNotesForBook(selectedBook.id)
    }
  }, [selectedBook])

  async function loadBooks() {
    const allBooks = await getAllBooks()
    setBooks(allBooks)
    setLastBooksHash(createHash(allBooks))
  }

  async function loadNotesForBook(bookId: string) {
    const bookNotes = await getBookNotesByBookId(bookId)
    setNotes(bookNotes)
    setLastNotesHash(createHash(bookNotes))
  }

  async function handleCreateBook() {
    if (!newBookTitle.trim()) return

    await saveBook({
      title: newBookTitle.trim(),
      author: newBookAuthor.trim() || undefined,
      totalPages: newBookPages ? parseInt(newBookPages) : undefined,
      startedAt: new Date(),
    })

    setNewBookTitle('')
    setNewBookAuthor('')
    setNewBookPages('')
    setShowNewBookModal(false)
    await loadBooks()
  }

  async function handleCreateNote() {
    if (!selectedBook || !noteTitle.trim() || !noteContent.trim()) {
      console.log('❌ Validation échouée:', { selectedBook, noteTitle, noteContent })
      return
    }

    console.log('📝 Création de note...')
    const noteData = {
      bookId: selectedBook.id,
      bookTitle: selectedBook.title,
      title: noteTitle.trim(),
      page: notePage ? parseInt(notePage) : undefined,
      content: noteContent.trim(),
      tags: [],
    }
    console.log('📋 Données note:', noteData)

    try {
      await saveBookNote(noteData)
      console.log('✅ Note créée avec succès')

      setNoteTitle('')
      setNotePage('')
      setNoteContent('')
      setShowNewNoteModal(false)
      await loadNotesForBook(selectedBook.id)
    } catch (error) {
      console.error('❌ Erreur création note:', error)
      alert('Erreur lors de la création de la note: ' + error.message)
    }
  }

  async function handleDeleteBook(bookId: string) {
    if (confirm('Supprimer ce livre et toutes ses notes ?')) {
      await deleteBook(bookId)
      if (selectedBook?.id === bookId) {
        setSelectedBook(null)
        setNotes([])
      }
      await loadBooks()
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (confirm('Supprimer cette note ?')) {
      await deleteBookNote(noteId)
      if (selectedBook) {
        await loadNotesForBook(selectedBook.id)
      }
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-scroll pb-20 p-6 bg-[#0f172a]" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="container max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">📚 Notes de lecture</h1>
          <button
            onClick={() => setShowNewBookModal(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transform hover:scale-105 transition"
          >
            + Nouveau livre
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Liste des livres */}
          <div className="md:col-span-1">
            <motion.div
              className="glass-card p-4 rounded-2xl"
              animate={{ opacity: isRefreshing ? 0.6 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-white mb-4">Mes livres</h2>
              <div className="space-y-2">
                {books.map(book => (
                  <motion.div
                    key={book.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedBook(book)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedBook?.id === book.id
                        ? 'bg-orange-500/20 border-2 border-orange-500 text-white'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    <div className="font-semibold">{book.title}</div>
                    {book.author && (
                      <div className="text-sm opacity-75">{book.author}</div>
                    )}
                  </motion.div>
                ))}

                {books.length === 0 && (
                  <div className="text-center text-white/50 py-8">
                    Aucun livre pour le moment
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Notes du livre sélectionné */}
          <div className="md:col-span-2">
            {selectedBook ? (
              <motion.div
                className="glass-card p-6 rounded-2xl"
                animate={{ opacity: isRefreshing ? 0.6 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedBook.title}</h2>
                    {selectedBook.author && (
                      <p className="text-white/70">{selectedBook.author}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewNoteModal(true)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                    >
                      + Note
                    </button>
                    <button
                      onClick={() => handleDeleteBook(selectedBook.id)}
                      className="px-3 py-2 bg-white/10 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {notes.map(note => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/10 p-4 rounded-lg border border-white/20"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-white">{note.title}</h3>
                          {note.page && (
                            <span className="text-xs text-white/60">Page {note.page}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                      <p className="text-white/80 whitespace-pre-wrap">{note.content}</p>
                      <div className="text-xs text-white/50 mt-2">
                        {new Date(note.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </motion.div>
                  ))}

                  {notes.length === 0 && (
                    <div className="text-center text-white/50 py-12">
                      Aucune note pour ce livre
                      <br />
                      <button
                        onClick={() => setShowNewNoteModal(true)}
                        className="mt-4 text-orange-400 hover:text-orange-300 underline"
                      >
                        Créer la première note
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="glass-card p-12 rounded-2xl text-center"
                animate={{ opacity: isRefreshing ? 0.6 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-white/60 text-lg">
                  Sélectionnez un livre pour voir ses notes
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Modal nouveau livre */}
        {showNewBookModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-800 p-6 rounded-2xl max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Nouveau livre</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 mb-2">Titre *</label>
                  <input
                    type="text"
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: Sapiens"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Auteur</label>
                  <input
                    type="text"
                    value={newBookAuthor}
                    onChange={(e) => setNewBookAuthor(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: Yuval Noah Harari"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Nombre de pages</label>
                  <input
                    type="number"
                    value={newBookPages}
                    onChange={(e) => setNewBookPages(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none"
                    placeholder="Ex: 512"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateBook}
                  disabled={!newBookTitle.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Créer
                </button>
                <button
                  onClick={() => setShowNewBookModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal nouvelle note */}
        {showNewNoteModal && selectedBook && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-800 p-6 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-white mb-4">Nouvelle note - {selectedBook.title}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 mb-2">Titre *</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none"
                      placeholder="Ex: Révolution cognitive"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 mb-2">Page</label>
                    <input
                      type="number"
                      value={notePage}
                      onChange={(e) => setNotePage(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none"
                      placeholder="Ex: 42"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Contenu *</label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={10}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:border-purple-500 focus:outline-none resize-none"
                    placeholder="Écrivez vos notes ici..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateNote}
                  disabled={!noteTitle.trim() || !noteContent.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setShowNewNoteModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
