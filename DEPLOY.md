# Guide de déploiement AppStudy

Ce guide détaillé vous aidera à déployer AppStudy sur un VPS avec un nom de domaine.

## Table des matières

1. [Préparation](#préparation)
2. [Choix du VPS](#choix-du-vps)
3. [Configuration du VPS](#configuration-du-vps)
4. [Déploiement de l'application](#déploiement-de-lapplication)
5. [Configuration du nom de domaine](#configuration-du-nom-de-domaine)
6. [Mise à jour de l'application](#mise-à-jour-de-lapplication)

## Préparation

### 1. Créer un compte GitHub

Si vous n'en avez pas déjà un, créez un compte sur [github.com](https://github.com).

### 2. Pousser le code sur GitHub

```bash
# Dans le répertoire du projet
git add .
git commit -m "Initial commit - AppStudy"

# Créer un nouveau dépôt sur GitHub (via l'interface web)
# Puis lier votre dépôt local au dépôt GitHub
git remote add origin https://github.com/VOTRE-USERNAME/appstudy.git
git branch -M main
git push -u origin main
```

### 3. Préparer les variables d'environnement

Avant de déployer, assurez-vous d'avoir :
- Votre clé API Mistral
- Votre clé API Gemini

## Choix du VPS

### VPS recommandés (pas chers)

| Provider | Prix/mois | Specs | Avantages |
|----------|-----------|-------|-----------|
| **Hetzner Cloud** | 4,51€ | 2 vCPU, 4GB RAM | Excellent rapport qualité/prix, data centers EU |
| **OVH VPS** | 3,50€ | 1 vCPU, 2GB RAM | Français, support FR |
| **DigitalOcean** | 6$ | 1 vCPU, 1GB RAM | Simple, bien documenté |
| **Contabo** | 5€ | 4 vCPU, 8GB RAM | Très bon rapport qualité/prix |

**Recommandation** : Hetzner Cloud CX22 (4,51€/mois) pour un bon compromis performance/prix.

### Créer votre VPS

1. Inscrivez-vous sur le provider choisi
2. Créez un nouveau serveur :
   - **OS** : Ubuntu 22.04 LTS (recommandé)
   - **Taille** : Minimum 2GB RAM
   - **Région** : Choisissez la plus proche de vous
3. Configurez l'accès SSH (clé SSH recommandée)
4. Notez l'adresse IP du serveur

## Configuration du VPS

### 1. Première connexion

```bash
ssh root@VOTRE_IP_VPS
```

### 2. Mise à jour du système

```bash
apt update && apt upgrade -y
```

### 3. Créer un utilisateur non-root (sécurité)

```bash
adduser appstudy
usermod -aG sudo appstudy
su - appstudy
```

### 4. Installer Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Vérifier l'installation
```

### 5. Installer PM2 (gestionnaire de processus)

```bash
sudo npm install -g pm2
```

### 6. Installer Nginx (serveur web)

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 7. Configurer le firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Déploiement de l'application

### Méthode 1 : Avec PM2 (Recommandé pour débuter)

#### 1. Cloner le projet

```bash
cd /var/www
sudo mkdir -p appstudy
sudo chown appstudy:appstudy appstudy
cd appstudy
git clone https://github.com/VOTRE-USERNAME/appstudy.git .
```

#### 2. Configurer les variables d'environnement

```bash
# Frontend
cp .env.example .env
nano .env
# Modifier VITE_API_URL=https://votredomaine.com

# Backend
cd backend
cp .env.example .env
nano .env
# Ajouter vos clés API :
# MISTRAL_API_KEY=sk-...
# GEMINI_API_KEY=AIza...
```

#### 3. Installer les dépendances et build

```bash
# Frontend
cd /var/www/appstudy
npm install
npm run build

# Backend
cd backend
npm install
```

#### 4. Démarrer l'application avec PM2

```bash
cd /var/www/appstudy
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Copier-coller la commande affichée
```

#### 5. Configurer Nginx

```bash
sudo nano /etc/nginx/sites-available/appstudy
```

Coller cette configuration (remplacer `votredomaine.com` par votre domaine) :

```nginx
server {
    listen 80;
    server_name votredomaine.com www.votredomaine.com;

    # Frontend - fichiers statiques
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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

### Méthode 2 : Avec Docker (Plus avancé)

#### 1. Installer Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Se déconnecter et reconnecter

# Installer Docker Compose
sudo apt-get install docker-compose-plugin
```

#### 2. Cloner et configurer

```bash
cd /var/www
sudo mkdir -p appstudy
sudo chown appstudy:appstudy appstudy
cd appstudy
git clone https://github.com/VOTRE-USERNAME/appstudy.git .

# Créer le fichier .env pour Docker
nano .env
```

Contenu du `.env` :

```env
MISTRAL_API_KEY=votre_clé_mistral
GEMINI_API_KEY=votre_clé_gemini
```

#### 3. Démarrer avec Docker

```bash
docker compose up -d
docker compose logs -f
```

## Configuration du nom de domaine

### 1. Acheter un nom de domaine

Registrars recommandés :
- **OVH** : .com à partir de 8€/an
- **Gandi** : Interface simple
- **Namecheap** : Prix compétitifs
- **Cloudflare** : .com à 9,77$/an

### 2. Configurer les DNS

Dans votre panel registrar, créer un enregistrement A :

```
Type : A
Nom : @ (ou laisser vide)
Valeur : IP_DE_VOTRE_VPS
TTL : 3600 (ou Auto)
```

Si vous voulez aussi `www.votredomaine.com` :

```
Type : CNAME
Nom : www
Valeur : votredomaine.com
TTL : 3600
```

**Attendre la propagation DNS** : 5 minutes à 24 heures.

### 3. Activer HTTPS avec Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votredomaine.com -d www.votredomaine.com
```

Suivre les instructions. Certbot configurera automatiquement SSL et le renouvellement automatique.

### 4. Vérifier le renouvellement automatique

```bash
sudo certbot renew --dry-run
```

## Mise à jour de l'application

### Avec PM2

```bash
cd /var/www/appstudy
./update.sh
```

Le script `update.sh` fait automatiquement :
- Sauvegarde de la base de données
- Pull des modifications depuis GitHub
- Installation des dépendances
- Build du frontend
- Redémarrage du backend

### Avec Docker

```bash
cd /var/www/appstudy
./update-docker.sh
```

### Mise à jour manuelle (PM2)

```bash
cd /var/www/appstudy

# Pull les modifications
git pull origin main

# Frontend
npm install
npm run build

# Backend
cd backend
npm install

# Redémarrer
pm2 restart appstudy-backend
```

## Commandes utiles

### PM2

```bash
pm2 status                    # Voir le statut
pm2 logs appstudy-backend     # Voir les logs
pm2 restart appstudy-backend  # Redémarrer
pm2 stop appstudy-backend     # Arrêter
pm2 delete appstudy-backend   # Supprimer
pm2 monit                     # Monitoring en temps réel
```

### Docker

```bash
docker compose ps             # Voir les conteneurs
docker compose logs -f        # Voir les logs en temps réel
docker compose restart        # Redémarrer
docker compose down           # Arrêter
docker compose up -d          # Démarrer
```

### Nginx

```bash
sudo nginx -t                 # Tester la config
sudo systemctl restart nginx  # Redémarrer
sudo systemctl status nginx   # Voir le statut
sudo tail -f /var/log/nginx/error.log  # Voir les erreurs
```

## Résolution de problèmes

### L'application ne répond pas

```bash
# Vérifier PM2
pm2 status
pm2 logs appstudy-backend

# Vérifier Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier le port
sudo netstat -tulpn | grep 3000
```

### Erreur 502 Bad Gateway

Le backend ne répond pas. Vérifier :

```bash
pm2 logs appstudy-backend
# ou
docker compose logs
```

### HTTPS ne fonctionne pas

```bash
sudo certbot certificates
sudo systemctl restart nginx
```

## Sauvegardes

### Automatiser les sauvegardes

Créer un script `/var/www/appstudy/backup.sh` :

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/appstudy/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /var/www/appstudy/backend/data "$BACKUP_DIR/"
echo "Sauvegarde créée dans $BACKUP_DIR"
```

Ajouter à cron (sauvegarde quotidienne à 2h du matin) :

```bash
chmod +x /var/www/appstudy/backup.sh
crontab -e
# Ajouter :
0 2 * * * /var/www/appstudy/backup.sh
```

## Sécurité

### Bonnes pratiques

1. **Ne jamais exposer les clés API** : Toujours utiliser des variables d'environnement
2. **Mettre à jour régulièrement** : `sudo apt update && sudo apt upgrade`
3. **Surveiller les logs** : `pm2 logs` ou `docker compose logs`
4. **Sauvegardes régulières** : Automatiser avec cron
5. **Utiliser SSH avec clés** : Désactiver l'authentification par mot de passe

### Désactiver l'authentification SSH par mot de passe

```bash
sudo nano /etc/ssh/sshd_config
# Modifier :
# PasswordAuthentication no

sudo systemctl restart sshd
```

## Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs (`pm2 logs` ou `docker compose logs`)
2. Consultez la documentation de votre VPS provider
3. Créez une issue sur GitHub

## Coûts estimés

- **VPS** : 3,50€ - 6€/mois
- **Nom de domaine** : 8€ - 12€/an
- **SSL** : Gratuit (Let's Encrypt)
- **Total première année** : ~60€
- **Total années suivantes** : ~50€/an

C'est tout ! Votre application AppStudy est maintenant en ligne et accessible depuis n'importe où.
