import { db } from './storage'
import type { User } from '../types/user'

const CURRENT_USER_KEY = 'appstudy_current_user_id'

// Couleurs prédéfinies pour les utilisateurs
const USER_COLORS = [
  '#667eea', // Purple-blue
  '#f093fb', // Pink
  '#4facfe', // Blue
  '#43e97b', // Green
  '#fa709a', // Rose
  '#feca57', // Yellow
]

// Verrou pour éviter les appels parallèles
let initializingPromise: Promise<void> | null = null

export async function initializeUsers(): Promise<void> {
  // Si déjà en cours d'initialisation, attendre la fin
  if (initializingPromise) {
    console.log('⏳ userService - initializeUsers déjà en cours, attente...')
    return initializingPromise
  }

  console.log('🔧 userService - Début initializeUsers')

  // Créer la promesse d'initialisation
  initializingPromise = (async () => {
    try {
      const users = await db.users.toArray()
      console.log(`👥 userService - ${users.length} utilisateurs trouvés`)

      // Si aucun utilisateur n'existe, créer deux utilisateurs par défaut
      if (users.length === 0) {
        console.log('➕ userService - Création de Clément et Alex')
    const clement: User = {
      id: `user_${Date.now()}`,
      name: 'Clément',
      color: USER_COLORS[0], // Purple-blue
      createdAt: new Date(),
      lastActive: new Date(),
    }

    const alex: User = {
      id: `user_${Date.now() + 1}`,
      name: 'Alex',
      color: USER_COLORS[1], // Pink
      createdAt: new Date(),
      lastActive: new Date(),
    }

        await db.users.add(clement)
        await db.users.add(alex)
        console.log('✅ userService - Utilisateurs créés avec succès')

        // Clément est l'utilisateur actif par défaut
        localStorage.setItem(CURRENT_USER_KEY, clement.id)
      } else {
        console.log('✅ userService - Utilisateurs déjà existants, pas de création')
      }
    } catch (error) {
      console.error('❌ userService - Erreur dans initializeUsers:', error)
      throw error
    } finally {
      // Libérer le verrou une fois terminé
      console.log('🔓 userService - Libération du verrou')
      initializingPromise = null
    }
  })()

  return initializingPromise
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = localStorage.getItem(CURRENT_USER_KEY)

  if (!userId) {
    // Prendre le premier utilisateur disponible
    const users = await db.users.toArray()
    if (users.length > 0) {
      const user = users[0]
      localStorage.setItem(CURRENT_USER_KEY, user.id)
      return user
    }
    return null
  }

  const user = await db.users.get(userId)
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY)
    return null
  }

  // Mettre à jour lastActive uniquement si plus d'une minute s'est écoulée
  const now = new Date()
  const lastActive = user.lastActive ? new Date(user.lastActive) : new Date(0)
  const minutesSinceLastUpdate = (now.getTime() - lastActive.getTime()) / 60000

  if (minutesSinceLastUpdate > 1) {
    // Ne pas attendre la mise à jour pour éviter de bloquer
    db.users.update(userId, { lastActive: now }).catch(err => {
      console.warn('Erreur lors de la mise à jour lastActive:', err)
    })
  }

  return user
}

export async function switchUser(userId: string): Promise<User | null> {
  const user = await db.users.get(userId)
  if (!user) return null

  localStorage.setItem(CURRENT_USER_KEY, userId)
  await db.users.update(userId, { lastActive: new Date() })

  return user
}

export async function getAllUsers(): Promise<User[]> {
  return await db.users.orderBy('name').toArray()
}

export async function createUser(name: string): Promise<User> {
  const users = await db.users.toArray()
  const colorIndex = users.length % USER_COLORS.length

  const newUser: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    color: USER_COLORS[colorIndex],
    createdAt: new Date(),
    lastActive: new Date(),
  }

  await db.users.add(newUser)
  return newUser
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  await db.users.update(userId, updates)
}

export async function deleteUser(userId: string): Promise<void> {
  // Supprimer toutes les données de l'utilisateur
  await Promise.all([
    db.syntheses.where('userId').equals(userId).delete(),
    db.flashcards.where('userId').equals(userId).delete(),
    db.tasks.where('userId').equals(userId).delete(),
    db.books.where('userId').equals(userId).delete(),
    db.bookNotes.where('userId').equals(userId).delete(),
    db.projects.where('userId').equals(userId).delete(),
    db.personalEvents.where('userId').equals(userId).delete(),
  ])

  // Supprimer l'utilisateur
  await db.users.delete(userId)

  // Si c'était l'utilisateur actif, changer pour un autre
  const currentUserId = localStorage.getItem(CURRENT_USER_KEY)
  if (currentUserId === userId) {
    const remainingUsers = await db.users.toArray()
    if (remainingUsers.length > 0) {
      localStorage.setItem(CURRENT_USER_KEY, remainingUsers[0].id)
    } else {
      localStorage.removeItem(CURRENT_USER_KEY)
    }
  }
}

// Helper pour obtenir l'ID de l'utilisateur actuel
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Aucun utilisateur actif')
  }
  return user.id
}
