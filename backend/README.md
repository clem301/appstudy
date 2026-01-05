# Backend AppStudy - Serveur de synchronisation

Backend Node.js simple pour synchroniser les synthèses entre appareils (téléphone et PC).

## Installation

```bash
cd backend
npm install
```

## Configuration

Le fichier `.env` contient la configuration du serveur :

```
PORT=3001
```

## Démarrage

```bash
npm start
# ou pour le mode développement
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

## Architecture

- **Express.js** - Serveur HTTP
- **SQLite** (better-sqlite3) - Base de données locale
- **CORS** - Permet les requêtes depuis le frontend

## Base de données

Les données sont stockées dans `backend/appstudy.db` (SQLite).

### Table `syntheses`

| Colonne | Type | Description |
|---------|------|-------------|
| id | TEXT | ID unique de la synthèse |
| title | TEXT | Titre de la synthèse |
| subject | TEXT | Matière (ex: Physique) |
| chapter | TEXT | Chapitre (ex: Énergie) |
| date | INTEGER | Timestamp de création du cours |
| raw_text | TEXT | Texte brut extrait par OCR |
| html | TEXT | Synthèse HTML générée |
| source_images | TEXT | JSON array des images sources (base64) |
| page_count | INTEGER | Nombre de pages scannées |
| word_count | INTEGER | Nombre de mots dans la synthèse |
| flashcards_generated | INTEGER | 0 ou 1 (boolean) |
| tags | TEXT | JSON array des tags |
| created_at | INTEGER | Timestamp de création |
| updated_at | INTEGER | Timestamp de dernière modification |
| device_id | TEXT | ID de l'appareil source |

## API Endpoints

### Health Check
```
GET /api/health
```
Vérifie que le serveur fonctionne.

### Récupérer toutes les synthèses
```
GET /api/syntheses
```
Retourne toutes les synthèses triées par date décroissante.

### Récupérer une synthèse par ID
```
GET /api/syntheses/:id
```

### Créer une nouvelle synthèse
```
POST /api/syntheses
Content-Type: application/json

{
  "id": "syn_...",
  "title": "...",
  "subject": "Physique",
  "chapter": "Énergie",
  "date": "2025-12-10T...",
  "rawText": "...",
  "html": "<div>...</div>",
  "sourceImages": ["data:image/jpeg;base64,..."],
  "pageCount": 10,
  "wordCount": 5000,
  "flashcardsGenerated": false,
  "tags": ["énergie", "mécanique"],
  "deviceId": "device_123"
}
```

### Mettre à jour une synthèse
```
PUT /api/syntheses/:id
Content-Type: application/json

{ ... champs à mettre à jour ... }
```

### Supprimer une synthèse
```
DELETE /api/syntheses/:id
```

### Synchroniser les synthèses modifiées
```
GET /api/sync?since=1733875200000
```
Retourne toutes les synthèses modifiées après le timestamp `since`.

## Synchronisation Frontend

Le frontend se synchronise automatiquement :

1. **Au démarrage** - Récupère toutes les synthèses du backend
2. **À la création** - Envoie la nouvelle synthèse au backend
3. **À la suppression** - Supprime la synthèse du backend
4. **Résolution de conflit** - La synthèse la plus récente (`updated_at`) gagne

## Offline-First

L'app fonctionne en mode **local-first** :

- ✅ Toutes les opérations fonctionnent sans le backend
- ✅ Les données sont d'abord sauvegardées en IndexedDB (local)
- ✅ La synchronisation avec le backend est non-bloquante
- ⚠️ Si le backend est indisponible, l'app continue de fonctionner localement

## Utilisation multi-appareils

1. **Démarrer le backend sur PC** :
   ```bash
   cd backend
   npm start
   ```

2. **Configurer l'URL du backend** dans `.env` du frontend :
   ```
   VITE_API_URL=http://192.168.1.100:3001/api  # IP locale du PC
   ```

3. **Scanner un cours sur téléphone** - La synthèse est automatiquement envoyée au backend

4. **Consulter sur PC** - Au démarrage de l'app, les synthèses sont synchronisées depuis le backend

## Logs

Le serveur affiche :
- ✅ Initialisation de la base de données
- 🚀 Démarrage du serveur
- 📊 Chemin de la base de données
- ✅ Opérations CRUD réussies
- ❌ Erreurs éventuelles

## Sécurité

⚠️ **Version actuelle = développement local uniquement**

Pour une utilisation en production, ajouter :
- Authentification (JWT tokens)
- Validation des données d'entrée
- Rate limiting
- HTTPS
- Hébergement cloud (Render, Railway, Fly.io)

## Coûts

- **Hébergement local** : Gratuit (serveur sur PC)
- **Hébergement cloud** : ~$5-10/mois (Render, Railway)
- **Stockage** : ~10 MB par synthèse de 10 pages (images base64 incluses)

## Troubleshooting

### Le backend ne démarre pas
```bash
# Vérifier Node.js
node --version  # Doit être >= 18

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### CORS error
Vérifier que `cors()` est bien activé dans `server.js` :
```javascript
app.use(cors())
```

### Synthèses ne se synchronisent pas
1. Vérifier que le backend est démarré : `GET http://localhost:3001/api/health`
2. Vérifier la configuration `VITE_API_URL` dans `.env` du frontend
3. Regarder la console du frontend pour les logs de sync

### Base de données corrompue
```bash
# Supprimer et recréer la base
rm backend/appstudy.db
npm start  # Recréera automatiquement les tables
```
