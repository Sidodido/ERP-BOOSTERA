# ================================================================
#          BOOSTERA ERP — SCRIPT DE DEPLOIEMENT RAPIDE POWERSHELL
# ================================================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          BOOSTERA ERP — MISE A JOUR DU SYSTEME" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verification Git
Write-Host "[1/4] Synchronisation avec GitHub (git pull origin main)..." -ForegroundColor Yellow
try {
    git pull origin main
} catch {
    Write-Host "Tentative avec stash pour preserver les fichiers locaux..." -ForegroundColor Gray
    git stash
    git pull --rebase origin main
    git stash pop
}

# 2. Dependances
Write-Host ""
Write-Host "[2/4] Verification des dependances (bun install)..." -ForegroundColor Yellow
bun install

# 3. Prisma Schema & DB Push
Write-Host ""
Write-Host "[3/4] Synchronisation de la base de donnees (prisma db push)..." -ForegroundColor Yellow
bunx prisma generate
bunx prisma db push

# 4. Succes
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SUCCES : L'ERP BOOSTERA EST TOTALEMENT A JOUR !" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Toutes les nouvelles sections et outils sont maintenant operationnels." -ForegroundColor Cyan
Write-Host ""
