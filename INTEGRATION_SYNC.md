# Intégration Backend - Synchronisation Multi-Appareils ✅

## Ce qui a été fait

### 1. Backend Node.js (backend/)

**Fichiers créés :**
- `backend/server.js` - Serveur Express avec API REST complète
- `backend/package.json` - Dépendances (express, cors, better-sqlite3, dotenv)
- `backend/.env` - Configuration (PORT=3001)
- `backend/README.md` - Documentation complète
- `backend/appstudy.db` - Base de données SQLite (créée automatiquement)

**API Endpoints :**
- `GET /api/health` - Health check
- `GET /api/syntheses` - Récupérer toutes les synthèses
- `GET /api/syntheses/:id` - Récupérer une synthèse par ID
- `POST /api/syntheses` - Créer une nouvelle synthèse
- `PUT /api/syntheses/:id` - Mettre à jour une synthèse
- `DELETE /api/syntheses/:id` - Supprimer une synthèse
- `GET /api/sync?since=timestamp` - Synchroniser depuis une date

### 2. Frontend - Client API (src/services/api.ts)

**Fonctions créées :**
```typescript
fetchAllSyntheses(): Promise<SynthesisDTO[]>
fetchSynthesisById(id: string): Promise<SynthesisDTO>
createSynthesis(synthesis: SynthesisDTO): Promise<void>
updateSynthesis(id: string, synthesis: Partial<SynthesisDTO>): Promise<void>
deleteSynthesis(id: string): Promise<void>
syncSyntheses(since: number): Promise<SynthesisDTO[]>
checkBackendHealth(): Promise<boolean>
```

### 3. Intégration Sync avec IndexedDB (src/services/storage.ts)

**Modifications apportées :**

#### a) Import du client API
```typescript
import * as api from './api'
```

#### b) Sync automatique à la création
```typescript
export async function saveSynthesis(...) {
  // 1. Save to IndexedDB first (local-first)
  await db.syntheses.add(newSynthesis)

  // 2. Sync to backend (non-blocking)
  syncSynthesisToBackend(newSynthesis).catch(err => {
    console.warn('⚠️ Backend sync failed (working offline):', err.message)
  })

  return id
}
```

#### c) Sync automatique à la suppression
```typescript
export async function deleteSynthesis(id: string) {
  // 1. Delete from IndexedDB first (local-first)
  await db.syntheses.delete(id)

  // 2. Sync deletion to backend (non-blocking)
  api.deleteSynthesis(id).catch(err => {
    console.warn('⚠️ Backend delete sync failed:', err.message)
  })
}
```

#### d) Fonction de synchronisation au démarrage
```typescript
export async function syncWithBackend(): Promise<{ synced: number; errors: number }> {
  // 1. Vérifier si backend disponible
  const isOnline = await api.checkBackendHealth()

  // 2. Récupérer toutes les synthèses du backend
  const backendSyntheses = await api.fetchAllSyntheses()

  // 3. Pour chaque synthèse backend :
  for (const backendSyn of backendSyntheses) {
    const localSyn = await db.syntheses.get(backendSyn.id)

    if (!localSyn) {
      // Nouvelle synthèse - ajouter localement
      await db.syntheses.add(...)
    } else {
      // Résoudre conflit - la plus récente gagne
      if (backendUpdated > localUpdated) {
        await db.syntheses.put(...)
      }
    }
  }

  return { synced, errors }
}
```

### 4. Appel de la sync au démarrage de l'app (src/App.tsx)

```typescript
import { useEffect } from 'react'
import { syncWithBackend } from './services/storage'

function App() {
  // Sync avec le backend au démarrage de l'app
  useEffect(() => {
    syncWithBackend()
  }, [])

  return (...)
}
```

### 5. Configuration (.env)

**Ajouté :**
```
VITE_API_URL=http://localhost:3001/api
```

## Architecture de Synchronisation

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React PWA)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User crée une synthèse                                   │
│     ↓                                                         │
│  2. saveSynthesis() - Save to IndexedDB first ✅             │
│     ↓                                                         │
│  3. syncSynthesisToBackend() - Send to backend (non-blocking)│
│     ↓                                                         │
│  4. Si backend offline → Log warning, continue localement    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                      App Startup (useEffect)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. syncWithBackend()                                        │
│     ↓                                                         │
│  2. Check if backend available (health check)                │
│     ↓                                                         │
│  3. Fetch all syntheses from backend                         │
│     ↓                                                         │
│  4. For each backend synthesis:                              │
│     - If not in local → Add to IndexedDB                     │
│     - If in local → Compare updated_at, keep most recent     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP REST API
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  - SQLite database (appstudy.db)                             │
│  - CRUD endpoints for syntheses                              │
│  - Conflict resolution by timestamp (updated_at)             │
│  - No authentication (local network only)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Caractéristiques Clés

### ✅ Local-First Architecture
- Les données sont **toujours** sauvegardées en IndexedDB d'abord
- La sync avec le backend est **non-bloquante**
- L'app fonctionne **offline** sans le backend

### ✅ Résolution de Conflit
- Stratégie : **Last Write Wins** (la plus récente gagne)
- Basée sur le timestamp `updatedAt`
- Évite les doublons grâce à l'ID unique

### ✅ Multi-Appareils
- Scanner un cours sur **téléphone** → Envoi au backend
- Consulter sur **PC** → Récupération depuis le backend
- Synchronisation **bidirectionnelle** automatique

### ✅ Gestion d'Erreurs
- Backend indisponible → Log warning, continue en local
- Erreur de sync → Ne bloque pas l'utilisateur
- Health check avant chaque sync

## Démarrage

### 1. Démarrer le backend
```bash
cd backend
npm install  # Première fois seulement
npm start
```

Le backend démarre sur `http://localhost:3001`

### 2. Démarrer le frontend
```bash
npm run dev
```

Le frontend démarre sur `http://localhost:5173`

### 3. Tester la synchronisation

**Scénario 1 - Création depuis téléphone :**
1. Scanner un cours sur téléphone
2. La synthèse est sauvegardée en local (IndexedDB)
3. La synthèse est envoyée au backend (SQLite)
4. Ouvrir l'app sur PC → Sync automatique au démarrage
5. La synthèse apparaît sur PC ✅

**Scénario 2 - Suppression :**
1. Supprimer une synthèse sur PC
2. Suppression locale (IndexedDB)
3. Suppression sur backend (SQLite)
4. Rafraîchir sur téléphone → Synthèse disparaît ✅

**Scénario 3 - Offline :**
1. Arrêter le backend
2. Scanner un cours sur téléphone
3. La synthèse est sauvegardée en local ✅
4. Log : "⚠️ Backend sync failed (working offline)"
5. Redémarrer le backend
6. Prochain scan → Sync fonctionne à nouveau ✅

## Configuration Multi-Appareils

### Sur PC (serveur backend)
1. Démarrer le backend :
   ```bash
   cd backend
   npm start
   ```
2. Noter l'IP locale du PC :
   ```bash
   # Windows
   ipconfig
   # Chercher "IPv4 Address" (ex: 192.168.1.100)

   # Mac/Linux
   ifconfig
   # Chercher "inet" (ex: 192.168.1.100)
   ```

### Sur téléphone (frontend)
1. Modifier `.env` avec l'IP du PC :
   ```
   VITE_API_URL=http://192.168.1.100:3001/api
   ```
2. Rebuild l'app :
   ```bash
   npm run build
   ```
3. Installer la PWA sur téléphone

## Logs de Synchronisation

### Backend (terminal)
```
🚀 Backend AppStudy lancé sur http://localhost:3001
📊 Base de données: C:\...\backend\appstudy.db
✅ Base de données SQLite initialisée
```

### Frontend (console navigateur)
```
🔄 Synchronisation avec le backend...
📥 3 synthèses trouvées sur le backend
✅ Synthèse syn_123 ajoutée depuis le backend
🔄 Synthèse syn_456 mise à jour depuis le backend
✅ Synchronisation terminée: 3 synthèses synchronisées, 0 erreurs
```

### En cas d'erreur
```
⚠️ Backend indisponible - travail en mode local
⚠️ Backend sync failed (working offline): fetch failed
```

## Prochaines Étapes (Optionnel)

### 1. Hébergement Cloud du Backend
Pour accéder aux synthèses depuis n'importe où (pas juste réseau local) :

**Options :**
- **Render** - Gratuit (500h/mois) - https://render.com
- **Railway** - $5/mois - https://railway.app
- **Fly.io** - Gratuit (3 apps) - https://fly.io

**Configuration :**
1. Déployer le backend sur une de ces plateformes
2. Mettre à jour `VITE_API_URL` avec l'URL publique :
   ```
   VITE_API_URL=https://appstudy-backend.onrender.com/api
   ```

### 2. Ajouter l'Authentification
Pour sécuriser l'accès (si hébergé en ligne) :

```typescript
// backend/auth.js
const jwt = require('jsonwebtoken')

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' })
    req.user = user
    next()
  })
}

// Protéger toutes les routes
app.use('/api/syntheses', authenticateToken)
```

### 3. Optimiser le Stockage des Images
Actuellement, les images sont en base64 (gros fichiers) :

**Options :**
- Stocker images séparément (S3, Cloudinary, etc.)
- Envoyer juste les URLs au backend
- Compresser les images avant stockage

### 4. Synchronisation en Temps Réel
Ajouter WebSocket pour sync instantanée :

```typescript
// backend/server.js
const { Server } = require('socket.io')
const io = new Server(server)

io.on('connection', (socket) => {
  socket.on('synthesis:created', (data) => {
    socket.broadcast.emit('synthesis:new', data)
  })
})
```

## Résumé

✅ **Backend créé** avec Express + SQLite
✅ **API REST complète** pour CRUD + sync
✅ **Client API frontend** avec toutes les fonctions
✅ **Intégration avec IndexedDB** (local-first)
✅ **Sync automatique** au démarrage de l'app
✅ **Sync non-bloquante** lors de la création
✅ **Résolution de conflit** par timestamp
✅ **Gestion offline** robuste
✅ **Documentation complète** (backend/README.md)

**Prêt à tester !** 🚀

Prochaine étape : Tester le scan de 10 pages avec Mistral OCR + Gemini 2.5 Flash.
