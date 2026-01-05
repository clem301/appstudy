# Système Multi-Utilisateurs - AppStudy

## Vue d'ensemble

L'application supporte maintenant plusieurs utilisateurs (jusqu'à 5) qui peuvent partager le même appareil tout en gardant leurs données séparées.

## Fonctionnalités

### 1. Gestion des utilisateurs

- **Création** : Maximum 5 utilisateurs par appareil
- **Changement** : Menu déroulant en haut à droite de la page Home
- **Profils** : Chaque utilisateur a un nom et une couleur d'avatar unique
- **Stockage** : Toutes les données sont séparées par userId

### 2. Composants ajoutés

#### `src/types/user.ts`
```typescript
interface User {
  id: string
  name: string
  avatar?: string
  color: string
  createdAt: Date
  lastActive: Date
}
```

#### `src/services/userService.ts`
Fonctions principales:
- `initializeUsers()` - Crée un utilisateur par défaut au premier lancement
- `getCurrentUser()` - Récupère l'utilisateur actif
- `switchUser(userId)` - Change d'utilisateur
- `createUser(name)` - Crée un nouvel utilisateur
- `getCurrentUserId()` - Helper pour obtenir l'ID de l'utilisateur actif

#### `src/components/UserSwitcher.tsx`
- Menu déroulant avec liste des utilisateurs
- Bouton pour ajouter un nouvel utilisateur
- Modal de création d'utilisateur
- Avatar avec initiale et couleur

### 3. Modifications de la base de données

**Version 6** de IndexedDB avec:
- Nouvelle table `users`
- Champ `userId` ajouté à toutes les tables:
  - `syntheses`
  - `flashcards`
  - `tasks`
  - `books`
  - `bookNotes`
  - `projects`
  - `personalEvents`

### 4. Modifications à faire dans storage.ts

Toutes les fonctions suivantes doivent être mises à jour pour:
1. Ajouter le `userId` lors de la création
2. Filtrer par `userId` lors de la lecture

#### Fonctions à modifier:

**Synthèses:**
- ✅ `saveSynthesis()` - Ajout userId
- ✅ `getAllSyntheses()` - Filtre userId
- ⚠️ `getSynthesisBySubject()` - À modifier
- ⚠️ `updateSynthesis()` - À modifier
- ⚠️ `deleteSynthesis()` - À modifier

**Flashcards:**
- ⚠️ `saveFlashcard()` - À modifier
- ⚠️ `getAllFlashcards()` - À modifier
- ⚠️ `getFlashcardsBySynthesis()` - À modifier
- ⚠️ `getFlashcardsDueForReview()` - À modifier
- ⚠️ `updateFlashcard()` - À modifier
- ⚠️ `deleteFlashcard()` - À modifier

**Books:**
- ⚠️ `saveBook()` - À modifier
- ⚠️ `getAllBooks()` - À modifier
- ⚠️ `updateBook()` - À modifier
- ⚠️ `deleteBook()` - À modifier

**Book Notes:**
- ⚠️ `saveBookNote()` - À modifier
- ⚠️ `getAllBookNotes()` - À modifier
- ⚠️ `getBookNotesByBookId()` - À modifier
- ⚠️ `updateBookNote()` - À modifier
- ⚠️ `deleteBookNote()` - À modifier

**Projects:**
- ⚠️ `saveProject()` - À modifier
- ⚠️ `getAllProjects()` - À modifier
- ⚠️ `updateProject()` - À modifier
- ⚠️ `deleteProject()` - À modifier

**Personal Events:**
- ⚠️ `savePersonalEvent()` - À modifier
- ⚠️ `getAllPersonalEvents()` - À modifier
- ⚠️ `updatePersonalEvent()` - À modifier
- ⚠️ `deletePersonalEvent()` - À modifier

**Stats:**
- ⚠️ `getStats()` - À modifier pour filtrer par userId

### 5. Pattern de modification

Pour chaque fonction `save*`:
```typescript
// Avant
export async function saveSomething(data: Omit<Thing, 'id' | 'createdAt'>): Promise<string> {
  const id = `thing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const newThing = {
    ...data,
    id,
    createdAt: new Date(),
  }
  await db.things.add(newThing)
  return id
}

// Après
export async function saveSomething(data: Omit<Thing, 'id' | 'createdAt'>): Promise<string> {
  const id = `thing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const userId = await getCurrentUserId()
  const newThing = {
    ...data,
    id,
    userId,
    createdAt: new Date(),
  }
  await db.things.add(newThing as any)
  return id
}
```

Pour chaque fonction `getAll*`:
```typescript
// Avant
export async function getAllThings(): Promise<Thing[]> {
  return await db.things.orderBy('createdAt').reverse().toArray()
}

// Après
export async function getAllThings(): Promise<Thing[]> {
  const userId = await getCurrentUserId()
  return await db.things.where('userId').equals(userId).reverse().sortBy('createdAt')
}
```

### 6. Interface utilisateur

**Page Home:**
- UserSwitcher ajouté en haut à droite
- Au changement d'utilisateur, la page recharge pour afficher les données du nouvel utilisateur

**Couleurs disponibles:**
1. Purple-blue (#667eea)
2. Pink (#f093fb)
3. Blue (#4facfe)
4. Green (#43e97b)
5. Rose (#fa709a)
6. Yellow (#feca57)

### 7. Workflow utilisateur

1. **Premier lancement**: Un "Utilisateur 1" est créé automatiquement
2. **Ajout d'un utilisateur**:
   - Clic sur l'avatar en haut à droite
   - "Ajouter un utilisateur"
   - Entrer le nom
   - Créer
3. **Changement d'utilisateur**:
   - Clic sur l'avatar en haut à droite
   - Sélection de l'utilisateur dans la liste
   - L'application recharge avec les données du nouvel utilisateur

### 8. Migration des données existantes

Les données existantes (sans userId) resteront dans la base mais ne seront pas affichées. Pour les migrer:

```typescript
// Script de migration (à exécuter dans la console une seule fois)
async function migrateToMultiUser() {
  const users = await db.users.toArray()
  if (users.length === 0) return

  const defaultUserId = users[0].id

  // Migrer toutes les données sans userId
  const syntheses = await db.syntheses.toArray()
  for (const syn of syntheses) {
    if (!(syn as any).userId) {
      await db.syntheses.update(syn.id, { userId: defaultUserId } as any)
    }
  }

  // Répéter pour flashcards, books, bookNotes, projects, personalEvents...
}
```

### 9. Limitations

- **Maximum 5 utilisateurs** par appareil
- **Pas de synchronisation** entre appareils (local-first)
- **Pas de mot de passe** - Simple séparation de données
- **Suppression d'utilisateur** supprime toutes ses données de façon irréversible

### 10. Prochaines étapes

1. ✅ Créer le type User
2. ✅ Créer userService.ts
3. ✅ Créer UserSwitcher.tsx
4. ✅ Mettre à jour la structure de la base de données
5. ✅ Ajouter UserSwitcher à la page Home
6. ⚠️ Mettre à jour toutes les fonctions dans storage.ts
7. ⚠️ Tester la création et le changement d'utilisateur
8. ⚠️ Ajouter la gestion des utilisateurs dans les paramètres
9. ⚠️ Implémenter la suppression d'utilisateur
10. ⚠️ Script de migration pour les données existantes
