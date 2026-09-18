#!/bin/bash
# ================================================================
#          BOOSTERA ERP — SCRIPT DE DEPLOIEMENT LINUX / VPS
# ================================================================

echo "================================================================"
echo "          BOOSTERA ERP — MISE A JOUR DU SYSTEME"
echo "================================================================"
echo ""

# 1. Pull Git
echo "[1/4] Synchronisation avec GitHub (git pull origin main)..."
git pull origin main || {
    echo "Tentative avec stash..."
    git stash
    git pull --rebase origin main
    git stash pop
}

# 2. Dependencies
echo ""
echo "[2/4] Installation des dépendances (bun install)..."
bun install

# 3. Prisma Schema & DB Push
echo ""
echo "[3/4] Mise à jour du schéma de base de données (prisma db push)..."
bunx prisma generate
bunx prisma db push

# 4. Restart if PM2 is used
if command -v pm2 &> /dev/null; then
    echo ""
    echo "[4/4] Rechargement du service PM2..."
    pm2 reload erp || pm2 restart erp || echo "Aucun processus pm2 'erp' détecté."
fi

echo ""
echo "================================================================"
echo "  SUCCÈS : L'ERP BOOSTERA EST À JOUR !"
echo "================================================================"
