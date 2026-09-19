$tempDir = "$env:TEMP\clean_next"
$destination = "C:\Users\amatek\OneDrive\Bureau\dot-next.zip"

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $destination) { Remove-Item $destination -Force }

New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item -Path "C:\Users\amatek\OneDrive\Bureau\crm\.next\server" -Destination "$tempDir\server" -Recurse
Copy-Item -Path "C:\Users\amatek\OneDrive\Bureau\crm\.next\static" -Destination "$tempDir\static" -Recurse
Get-ChildItem -Path "C:\Users\amatek\OneDrive\Bureau\crm\.next" -File | ForEach-Object {
    Copy-Item $_.FullName -Destination $tempDir
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $destination, [System.IO.Compression.CompressionLevel]::Fastest, $false)

Remove-Item $tempDir -Recurse -Force

$item = Get-Item $destination
$sizeMB = [math]::Round($item.Length / 1MB, 2)
Write-Host "SUCCES: Archive créée sur le Bureau : $destination ($sizeMB Mo)"
