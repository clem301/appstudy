/**
 * Modèle pour les notes de livres
 */

export interface Book {
  id: string
  title: string
  author?: string
  coverImage?: string
  totalPages?: number
  currentPage?: number
  startedAt: Date
  finishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface BookNote {
  id: string
  bookId: string
  bookTitle: string // Dénormalisé pour faciliter l'affichage
  page?: number // Page du livre (optionnel)
  title: string // Titre de la note (ex: "Chapitre 3 - La révolution")
  content: string // Contenu de la note en markdown
  tags: string[]
  createdAt: Date
  updatedAt: Date
}
