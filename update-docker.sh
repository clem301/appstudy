#!/bin/bash

echo "🔄 Mise à jour AppStudy (Docker)..."

# Sauvegarder la base de données
echo "💾 Sauvegarde de la base de données..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r backend/data "$BACKUP_DIR/"

# Pull les dernières modifications
echo "⬇️  Récupération des modifications..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du git pull"
    exit 1
fi

# Arrêter les conteneurs
echo "⏸️  Arrêt des conteneurs..."
docker-compose down

# Rebuild les images
echo "🏗️  Build des nouvelles images..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build Docker"
    exit 1
fi

# Redémarrer les conteneurs
echo "▶️  Démarrage des conteneurs..."
docker-compose up -d

# Attendre quelques secondes
sleep 5

# Vérifier le statut
echo "📊 Statut des conteneurs :"
docker-compose ps

# Afficher les logs
echo ""
echo "📝 Derniers logs :"
docker-compose logs --tail=20

echo ""
echo "✅ Mise à jour terminée avec succès !"
echo "💡 Pour voir les logs en temps réel : docker-compose logs -f"
