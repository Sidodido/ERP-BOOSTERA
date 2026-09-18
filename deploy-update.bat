@echo off
chcp 65001 > nul
cls
echo ================================================================
echo           BOOSTERA ERP — MISE A JOUR ET DEPLOIEMENT RAPIDE
echo ================================================================
echo.
echo Ce script met a jour automatiquement le code source, la base de donnees
echo et les modules de l'ERP Boostera.
echo.

:: Verification de Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Git n'est pas installe ou n'est pas dans le PATH.
    pause
    exit /b 1
)

echo [1/4] Recuperation des dernieres modifications depuis GitHub (git pull)...
git pull origin main
if %errorlevel% neq 0 (
    echo [AVERTISSEMENT] Conflit potentiel ou modifications locales. Tentative de rebase...
    git stash
    git pull --rebase origin main
    git stash pop
)

echo.
echo [2/4] Verification des dependances (bun install)...
call bun install

echo.
echo [3/4] Mise a jour du schema de la base de donnees (Prisma)...
call bunx prisma generate
call bunx prisma db push

echo.
echo [4/4] Finalisation du deploiement...
echo ================================================================
echo   SUCCES : L'ERP BOOSTERA EST A JOUR ET PRET A ETRE UTILISE !
echo ================================================================
echo.
echo Pour relancer le serveur de developpement : bun run dev
echo.
pause
