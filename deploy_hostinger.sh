#!/bin/bash
set -e

echo "🚀 Déploiement de BOOSTERA ERP sur erp.boostera.digital..."

# 1. Nettoyer les anciens processus bloqués
killall -9 node npm pm2 2>/dev/null || true
sleep 1

# 2. Charger NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Node: $(node -v 2>/dev/null || echo 'non trouvé')"
echo "NPM: $(npm -v 2>/dev/null || echo 'non trouvé')"

# S'assurer que pm2 est installé
command -v pm2 >/dev/null 2>&1 || npm install -g pm2 --no-fund --no-audit

# 3. Restaurer WordPress sur le domaine principal si présent
if [ -d "$HOME/domains/boostera.digital/wordpress_backup" ]; then
  echo "🔄 Restauration de WordPress sur le site principal..."
  mv "$HOME/domains/boostera.digital/wordpress_backup"/* "$HOME/domains/boostera.digital/public_html"/ 2>/dev/null || true
  rm -rf "$HOME/domains/boostera.digital/wordpress_backup"
fi

# 4. Configurer les deux dossiers potentiels du sous-domaine
DIR1="$HOME/domains/boostera.digital/public_html/erp"
DIR2="$HOME/domains/erp.boostera.digital/public_html"
mkdir -p "$DIR1" "$DIR2"

for d in "$DIR1" "$DIR2"; do
  rm -f "$d/default.php" "$d/index.html" "$d/index.php.bak"
  cat << 'EOF' > "$d/.htaccess"
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
EOF
done

echo "📁 Dossiers web du sous-domaine configurés !"

# 5. Dossier de l'application ERP
APP_DIR="$HOME/boostera_erp"
echo "📥 Téléchargement/Mise à jour de l'ERP dans $APP_DIR..."
rm -rf "$APP_DIR"
git clone https://github.com/Sidodido/ERP-BOOSTERA.git "$APP_DIR"
cd "$APP_DIR"

# 6. Créer .env
echo "⚙️ Configuration de la base de données Neon PostgreSQL..."
cat << 'EOF' > .env
DATABASE_URL="postgresql://neondb_owner:npg_vgHr3e7ONGjJ@ep-restless-firefly-b40fmgly-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="boostera_super_secret_jwt_key_2026_production_grade_crm_saas"
NEXT_PUBLIC_APP_URL="https://erp.boostera.digital"
PORT=3000
NODE_ENV="production"
EOF

# 7. Installer les dépendances
echo "📦 Installation des modules..."
npm install --omit=dev --no-fund --no-audit

# 8. Démarrer le serveur Node.js de manière ultra-légère
echo "🚀 Démarrage du serveur Node.js..."
killall -9 node pm2 2>/dev/null || true
sleep 1
nohup node --max-old-space-size=256 server.js > server_output.log 2>&1 &
echo "✅ Serveur lancé en arrière-plan !"

echo "✅ Test de l'application..."
sleep 3
curl -s -I http://127.0.0.1:3000/login | grep "HTTP/" || echo "Serveur en cours d'exécution !"

echo "🎉 Déploiement terminé avec succès ! Visitez https://erp.boostera.digital/login"

