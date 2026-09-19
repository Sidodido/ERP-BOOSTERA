$destination = "C:\Users\amatek\OneDrive\Bureau\erp-deploy.zip"
if (Test-Path $destination) {
    Remove-Item $destination -Force
}

Write-Host "Compression des fichiers en cours..."
Compress-Archive -Path ".next", "public", "src", "prisma", "package.json", "next.config.ts", "server.js", "tsconfig.json" -DestinationPath $destination -Force

$item = Get-Item $destination
$sizeMB = [math]::Round($item.Length / 1MB, 2)
Write-Host "Archive créée avec succès : $destination ($sizeMB Mo)"
