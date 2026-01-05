#!/bin/bash

echo "🔄 Mise à jour AppStudy..."

# Arrêter l'application
echo "⏸️  Arrêt de l'application..."
pm2 stop appstudy-backend

# Sauvegarder la base de données
echo "💾 Sauvegarde de la base de données..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r backend/data "$BACKUP_DIR/"

# Pull les dernières modifications
echo "⬇️  Récupération des modifications..."
git pull origin main

# Vérifier s'il y a des changements
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du git pull"
    pm2 start appstudy-backend
    exit 1
fi

# Installer/mettre à jour les dépendances
echo "📦 Installation des dépendances..."
npm install

# Build le frontend
echo "🏗️  Build du frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build du frontend"
    pm2 start appstudy-backend
    exit 1
fi

# Mettre à jour le backend
echo "🔧 Mise à jour du backend..."
cd backend
npm install

# Redémarrer l'application
echo "▶️  Redémarrage de l'application..."
cd ..
pm2 restart appstudy-backend

# Vérifier le statut
pm2 status

echo "✅ Mise à jour terminée avec succès !"
echo "📊 Statut de l'application : pm2 logs appstudy-backend"
