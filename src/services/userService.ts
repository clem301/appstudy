import { supabase } from './supabase'
import { db } from './storage'

// Helper pour obtenir l'ID de l'utilisateur actuel (Authentifié via Supabase)
export async function getCurrentUserId(): Promise<string> {
  // Si Supabase n'est pas configuré, on est en mode "offline forcé"
  // On utilise un ID "guest" par défaut pour que l'app ne plante pas
  if (!supabase) {
    console.warn('Supabase non configuré, utilisation du mode invité')
    return 'user_guest'
  }
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    // Si pas de session, on ne devrait pas être là (App.tsx redirige vers Auth)
    // Mais par sécurité, on renvoie une erreur
    throw new Error('Aucun utilisateur connecté')
  }
  
  return session.user.id
}

// Fonction pour récupérer les données d'anciens comptes locaux vers le compte actuel
export async function recoverOldData(): Promise<number> {
  const currentUserId = await getCurrentUserId()
  console.log(`🛠️ Récupération des données pour ${currentUserId}...`)
  
  // Récupérer toutes les tables
  const tables = [
    db.syntheses, 
    db.flashcards, 
    db.books, 
    db.bookNotes, 
    db.tasks, 
    db.projects, 
    db.personalEvents
  ]
  
  let count = 0
  
  for (const table of tables) {
    // Tout ce qui n'est pas déjà au bon ID
    const items = await table.filter((item: any) => item.userId !== currentUserId).toArray()
    
    for (const item of items) {
      // Cloner et changer l'ID utilisateur
      const newItem = { ...item, userId: currentUserId }
      // Sauvegarder (écrasera ou ajoutera selon la clé primaire)
      // @ts-ignore - On sait ce qu'on fait, on force l'insertion
      await table.put(newItem)
      count++
    }
  }
  
  return count
}

// Fonctions dépréciées (gardées vides pour ne pas casser les imports ailleurs si oubli)
export async function initializeUsers(): Promise<void> {}
export async function getCurrentUser(): Promise<any> { return null }
export async function switchUser(id: string): Promise<any> { return null }
export async function getAllUsers(): Promise<any[]> { return [] }
export async function createUser(name: string): Promise<any> { return null }
export async function updateUser(id: string, updates: any): Promise<void> {}
export async function deleteUser(id: string): Promise<void> {}
export async function migrateToStandardId(current: string, target: string): Promise<void> {}
