$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot "tools"
$target = Join-Path $toolsDir "cloudflared.exe"
New-Item -ItemType Directory -Force $toolsDir | Out-Null
Write-Host "Скачиваю официальный cloudflared для Windows..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $target
$signature = Get-AuthenticodeSignature -FilePath $target
if ($signature.Status -ne "Valid") {
  Remove-Item -LiteralPath $target -Force
  throw "Цифровая подпись cloudflared не прошла проверку. Файл удалён."
}
Write-Host "cloudflared установлен: $target" -ForegroundColor Green