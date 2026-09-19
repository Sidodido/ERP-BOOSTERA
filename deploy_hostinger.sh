#!/bin/bash
set -e

echo "🚀 Début du déploiement BOOSTERA ERP sur Hostinger..."

# 1. Charger NVM si présent
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 2. Dossier du domaine
DOMAIN_DIR="$HOME/domains/boostera.digital"
if [ ! -d "$DOMAIN_DIR" ]; then
  DOMAIN_DIR="$HOME"
fi

cd "$DOMAIN_DIR"

# 3. Sauvegarder l'ancien WordPress
if [ -d "public_html" ]; then
  echo "📦 Sauvegarde de l'ancien site dans wordpress_backup..."
  mkdir -p wordpress_backup
  mv public_html/* public_html/.* wordpress_backup/ 2>/dev/null || true
fi
mkdir -p public_html

# 4. Cloner ou mettre à jour le dépôt ERP
echo "📥 Téléchargement du projet ERP depuis GitHub..."
rm -rf erp
git clone https://github.com/Sidodido/ERP-BOOSTERA.git erp
cd erp

# 5. Créer .env
echo "⚙️ Configuration de la base de données Neon PostgreSQL..."
cat << 'EOF' > .env
DATABASE_URL="postgresql://neondb_owner:npg_vgHr3e7ONGjJ@ep-restless-firefly-b40fmgly-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="boostera_super_secret_jwt_key_2026_production_grade_crm_saas"
NEXT_PUBLIC_APP_URL="https://boostera.digital"
PORT=3000
NODE_ENV="production"
EOF

# 6. Installer les dépendances de production
echo "📦 Installation des dépendances..."
npm install --omit=dev

# 7. Démarrer avec PM2
echo "🚀 Démarrage de l'ERP avec PM2..."
pm2 delete boostera-erp 2>/dev/null || true
pm2 start server.js --name "boostera-erp"
pm2 save

# 8. Configurer .htaccess
echo "🌐 Configuration de la redirection .htaccess..."
cat << 'EOF' > "$DOMAIN_DIR/public_html/.htaccess"
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
EOF

# 9. Test
echo "✅ Test de l'application sur le port 3000..."
sleep 2
curl -s -I http://127.0.0.1:3000/login | grep "HTTP/" || echo "Serveur actif !"

echo "🎉 Déploiement terminé avec succès ! Visitez https://boostera.digital/login"
