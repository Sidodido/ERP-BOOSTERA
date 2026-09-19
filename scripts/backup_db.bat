@echo off
title Sauvegarde Automatique Base de Donnees ERP-BOOSTERA
echo =======================================================
echo    ERP BOOSTERA - SAUVEGARDE AUTOMATIQUE BASE DE DONNEES
echo =======================================================
echo Execution en cours...
cd /d "%~dp0\.."
bun run scripts/backup_db.ts
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Sauvegarde terminee avec succes dans le dossier \backups\
) else (
    echo.
    echo Une erreur est survenue lors de la sauvegarde.
)
echo.
pause
