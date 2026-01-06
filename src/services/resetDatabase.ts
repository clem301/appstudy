import { db } from './storage'
import { initializeUsers, getCurrentUserId } from './userService'

/**
 * Réinitialise complètement la base de données
 * À utiliser uniquement en développement ou pour migration
 */
export async function resetDatabase(): Promise<void> {
  try {
    console.log('🗑️ Suppression de toutes les données...')

    // Supprimer toutes les données
    await Promise.all([
      db.users.clear(),
      db.syntheses.clear(),
      db.flashcards.clear(),
      db.tasks.clear(),
      db.books.clear(),
      db.bookNotes.clear(),
      db.projects.clear(),
      db.personalEvents.clear(),
    ])

    // Nettoyer le localStorage
    localStorage.removeItem('appstudy_current_user_id')

    console.log('✅ Base de données vidée')
    console.log('👥 Création des utilisateurs par défaut...')

    // Attendre un peu pour que la BDD soit bien vidée
    await new Promise(resolve => setTimeout(resolve, 100))

    // Réinitialiser les utilisateurs
    await initializeUsers()

    console.log('✅ Base de données réinitialisée avec Clément et Alex')

    // Attendre que les utilisateurs soient bien enregistrés
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('🔄 Rechargement de la page...')

    // Recharger la page
    window.location.reload()
  } catch (error) {
    console.error('❌ Erreur lors du reset:', error)
  }
}

/**
 * Migre toutes les données existantes sans userId vers l'utilisateur actuel
 */
export async function migrateDataToCurrentUser(): Promise<void> {
  try {
    const userId = await getCurrentUserId()
    console.log(`📦 Migration des données vers l'utilisateur: ${userId}`)

    // Migrer les projets
    const projects = await db.projects.toArray()
    let migratedProjects = 0
    for (const project of projects) {
      if (!(project as any).userId) {
        await db.projects.update(project.id, { userId } as any)
        migratedProjects++
      }
    }
    console.log(`✅ ${migratedProjects} projets migrés`)

    // Migrer les flashcards
    const flashcards = await db.flashcards.toArray()
    let migratedFlashcards = 0
    for (const card of flashcards) {
      if (!(card as any).userId) {
        await db.flashcards.update(card.id, { userId } as any)
        migratedFlashcards++
      }
    }
    console.log(`✅ ${migratedFlashcards} flashcards migrées`)

    // Migrer les synthèses
    const syntheses = await db.syntheses.toArray()
    let migratedSyntheses = 0
    for (const syn of syntheses) {
      if (!(syn as any).userId) {
        await db.syntheses.update(syn.id, { userId } as any)
        migratedSyntheses++
      }
    }
    console.log(`✅ ${migratedSyntheses} synthèses migrées`)

    // Migrer les livres
    const books = await db.books.toArray()
    let migratedBooks = 0
    for (const book of books) {
      if (!(book as any).userId) {
        await db.books.update(book.id, { userId } as any)
        migratedBooks++
      }
    }
    console.log(`✅ ${migratedBooks} livres migrés`)

    // Migrer les notes de livres
    const bookNotes = await db.bookNotes.toArray()
    let migratedNotes = 0
    for (const note of bookNotes) {
      if (!(note as any).userId) {
        await db.bookNotes.update(note.id, { userId } as any)
        migratedNotes++
      }
    }
    console.log(`✅ ${migratedNotes} notes de livres migrées`)

    // Migrer les événements personnels
    const events = await db.personalEvents.toArray()
    let migratedEvents = 0
    for (const event of events) {
      if (!(event as any).userId) {
        await db.personalEvents.update(event.id, { userId } as any)
        migratedEvents++
      }
    }
    console.log(`✅ ${migratedEvents} événements personnels migrés`)

    console.log('✅ Migration terminée! Rechargement de la page...')
    window.location.reload()
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
  }
}

// Exposer les fonctions globalement pour debug
if (typeof window !== 'undefined') {
  (window as any).resetDatabase = resetDatabase
}
