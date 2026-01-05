# AppStudy

**Progressive Web App pour la gestion de l'école à domicile en Belgique**

Une application moderne pour automatiser la création de synthèses de cours avec OCR et IA, générer des flashcards avec répétition espacée, et planifier les révisions pour les points hebdomadaires du mercredi après-midi.

## Fonctionnalités principales

- **Scanner de cours** : Upload de photos/PDF avec OCR via Mistral
- **Synthèses automatiques** : Génération de résumés structurés avec Gemini 2.5 Flash
- **Bibliothèque de synthèses** : Recherche, filtres par matière, export PDF
- **Notes de lecture** : Organisation de notes de livres avec synchronisation multi-appareils
- **Flashcards intelligentes** : Génération automatique + algorithme de répétition espacée (SM-2)
- **Planificateur** : Gestion des tâches focalisée sur le point du mercredi
- **Mode hors ligne** : Architecture local-first avec IndexedDB

## Stack technique

- **Frontend** : React 18 + TypeScript + Vite
- **Styling** : Tailwind CSS (système "Liquid Glass")
- **Animations** : Framer Motion
- **Routing** : React Router
- **État** : Zustand
- **Storage** : IndexedDB (Dexie.js)
- **Backend** : Node.js + Express + SQLite
- **APIs** : Mistral OCR + Gemini 2.5 Flash
- **PWA** : Service Worker + Manifest

## Installation locale

### Prérequis

- Node.js 18+ et npm

### Frontend

```bash
npm install
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### Backend

```bash
cd backend
npm install
npm run dev
```

Le serveur API sera accessible sur `http://localhost:3000`

### Configuration

1. Créer un fichier `.env` à la racine du projet :

```env
VITE_API_URL=http://localhost:3000
```

2. Créer un fichier `backend/.env` :

```env
PORT=3000
MISTRAL_API_KEY=votre_clé_mistral
GEMINI_API_KEY=votre_clé_gemini
```

## Build pour production

```bash
# Frontend
npm run build

# Backend
cd backend
npm run build
```

Les fichiers de production seront dans `dist/` (frontend) et `backend/dist/` (backend).

## Déploiement sur VPS

### Méthode 1 : Déploiement simple avec PM2

1. **Préparer le VPS** (Ubuntu/Debian recommandé)

```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2 globalement
sudo npm install -g pm2

# Installer Nginx
sudo apt-get install nginx
```

2. **Cloner le projet**

```bash
cd /var/www
sudo git clone https://github.com/votre-username/appstudy.git
cd appstudy
sudo npm install
sudo npm run build

cd backend
sudo npm install
```

3. **Configurer PM2**

Créer `ecosystem.config.js` à la racine :

```javascript
module.exports = {
  apps: [{
    name: 'appstudy-backend',
    cwd: './backend',
    script: 'src/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Démarrer l'application :

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

4. **Configurer Nginx**

Créer `/etc/nginx/sites-available/appstudy` :

```nginx
server {
    listen 80;
    server_name votredomaine.com;

    # Frontend (fichiers statiques)
    location / {
        root /var/www/appstudy/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/appstudy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. **Configurer SSL avec Certbot**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votredomaine.com
```

### Méthode 2 : Déploiement avec Docker (recommandé)

Créer `Dockerfile` à la racine :

```dockerfile
# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .

# Production
FROM node:20-alpine
WORKDIR /app

# Copier le frontend buildé
COPY --from=frontend-build /app/dist ./dist

# Copier le backend
COPY --from=backend-build /app/backend ./backend
WORKDIR /app/backend

EXPOSE 3000
CMD ["node", "src/server.js"]
```

Créer `docker-compose.yml` :

```yaml
version: '3.8'
services:
  appstudy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ./backend/data:/app/backend/data
    restart: unless-stopped
```

Déployer :

```bash
docker-compose up -d
```

## Mise à jour facile

### Avec Git + PM2

Créer un script `update.sh` :

```bash
#!/bin/bash
echo "🔄 Mise à jour AppStudy..."

# Pull les dernières modifications
git pull origin main

# Installer les dépendances si nécessaire
npm install

# Build le frontend
npm run build

# Redémarrer le backend
cd backend
npm install
pm2 restart appstudy-backend

echo "✅ Mise à jour terminée !"
```

Rendre exécutable :

```bash
chmod +x update.sh
```

Pour mettre à jour :

```bash
./update.sh
```

### Avec Docker

```bash
# Script update-docker.sh
#!/bin/bash
echo "🔄 Mise à jour AppStudy (Docker)..."

git pull origin main
docker-compose down
docker-compose build
docker-compose up -d

echo "✅ Mise à jour terminée !"
```

## Configuration du nom de domaine

1. Acheter un nom de domaine (ex: chez OVH, Gandi, Namecheap)
2. Dans votre registrar, créer un enregistrement A pointant vers l'IP de votre VPS :
   ```
   Type: A
   Nom: @
   Valeur: xxx.xxx.xxx.xxx (IP du VPS)
   TTL: 3600
   ```
3. Attendre la propagation DNS (quelques minutes à 24h)

## VPS recommandés pas chers

- **Hetzner Cloud** : à partir de 4,51€/mois (CX22 : 2 vCPU, 4GB RAM)
- **DigitalOcean** : à partir de 6$/mois (Basic Droplet)
- **OVH VPS** : à partir de 3,50€/mois (VPS Starter)
- **Contabo** : à partir de 5€/mois (Cloud VPS S)

## Sécurité

- Les clés API ne sont JAMAIS commitées dans Git
- Utiliser des variables d'environnement (`.env`)
- Activer HTTPS avec Certbot
- Configurer le firewall UFW :

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## Licence

Projet personnel - Tous droits réservés

## Support

Pour toute question : [Créer une issue](https://github.com/votre-username/appstudy/issues)
