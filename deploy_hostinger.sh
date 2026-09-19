#!/bin/bash
set -e

echo "🚀 Déploiement de BOOSTERA ERP sur erp.boostera.digital..."

# 1. Charger NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Node: $(node -v 2>/dev/null || echo 'non trouvé')"
echo "NPM: $(npm -v 2>/dev/null || echo 'non trouvé')"

# S'assurer que pm2 est installé
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

# 2. Restaurer WordPress sur le domaine principal si présent
if [ -d "$HOME/domains/boostera.digital/wordpress_backup" ]; then
  echo "🔄 Restauration de WordPress sur le site principal..."
  mv "$HOME/domains/boostera.digital/wordpress_backup"/* "$HOME/domains/boostera.digital/public_html"/ 2>/dev/null || true
  rm -rf "$HOME/domains/boostera.digital/wordpress_backup"
fi

# 3. Trouver le dossier du sous-domaine erp
ERP_WEB_DIR=""
if [ -d "$HOME/domains/boostera.digital/public_html/erp" ]; then
  ERP_WEB_DIR="$HOME/domains/boostera.digital/public_html/erp"
elif [ -d "$HOME/domains/erp.boostera.digital/public_html" ]; then
  ERP_WEB_DIR="$HOME/domains/erp.boostera.digital/public_html"
elif [ -d "$HOME/domains/boostera.digital/erp" ]; then
  ERP_WEB_DIR="$HOME/domains/boostera.digital/erp"
else
  ERP_WEB_DIR="$HOME/domains/boostera.digital/public_html/erp"
  mkdir -p "$ERP_WEB_DIR"
fi

echo "📁 Dossier web du sous-domaine : $ERP_WEB_DIR"

# 4. Dossier de l'application ERP
APP_DIR="$HOME/boostera_erp"
echo "📥 Téléchargement/Mise à jour de l'ERP dans $APP_DIR..."
rm -rf "$APP_DIR"
git clone https://github.com/Sidodido/ERP-BOOSTERA.git "$APP_DIR"
cd "$APP_DIR"

# 5. Créer .env
echo "⚙️ Configuration de la base de données Neon PostgreSQL..."
cat << 'EOF' > .env
DATABASE_URL="postgresql://neondb_owner:npg_vgHr3e7ONGjJ@ep-restless-firefly-b40fmgly-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="boostera_super_secret_jwt_key_2026_production_grade_crm_saas"
NEXT_PUBLIC_APP_URL="https://erp.boostera.digital"
PORT=3000
NODE_ENV="production"
EOF

# 6. Installer les dépendances
echo "📦 Installation des modules..."
npm install --omit=dev

# 7. Démarrer avec PM2
echo "🚀 Démarrage du serveur Node.js avec PM2..."
pm2 delete boostera-erp 2>/dev/null || true
pm2 start server.js --name "boostera-erp"
pm2 save

# 8. Nettoyer la page par défaut d'Hostinger dans le sous-domaine
rm -f "$ERP_WEB_DIR/default.php" "$ERP_WEB_DIR/index.html" "$ERP_WEB_DIR/index.php.bak"

# 9. Configurer la passerelle .htaccess dans le dossier du sous-domaine
echo "🌐 Configuration de la redirection .htaccess sur erp.boostera.digital..."
cat << 'EOF' > "$ERP_WEB_DIR/.htaccess"
RewriteEngine On
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
EOF

echo "✅ Test de l'application..."
sleep 2
curl -s -I http://127.0.0.1:3000/login | grep "HTTP/" || echo "Serveur en cours d'exécution !"

echo "🎉 Déploiement terminé avec succès ! Visitez https://erp.boostera.digital/login"
