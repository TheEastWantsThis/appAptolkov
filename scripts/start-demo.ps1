$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$logDir = Join-Path $runtimeDir "logs"
New-Item -ItemType Directory -Force $runtimeDir, $logDir | Out-Null
Set-Location $projectRoot

& (Join-Path $PSScriptRoot "start-crm.ps1")
if ($LASTEXITCODE -ne 0) { throw "Не удалось подготовить локальный сервер." }

foreach ($entry in @(
  @{ Pid = "tunnel.pid"; Name = "cloudflared.exe" },
  @{ Pid = "demo.pid"; Name = "node.exe" }
)) {
  $pidPath = Join-Path $runtimeDir $entry.Pid
  if (Test-Path -LiteralPath $pidPath) {
    $processId = [int]([IO.File]::ReadAllText($pidPath).Trim())
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($process -and $process.Name -eq $entry.Name) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Пересоздаю изолированную демонстрационную базу..." -ForegroundColor Cyan
docker compose exec -T postgres dropdb -U apotolkov --if-exists --force apotolkov_demo
docker compose exec -T postgres createdb -U apotolkov apotolkov_demo
if ($LASTEXITCODE -ne 0) { throw "Не удалось создать демонстрационную базу." }

$previousDatabaseUrl = $env:DATABASE_URL
$previousAuthSecret = $env:AUTH_SECRET
$previousTrustHost = $env:AUTH_TRUST_HOST
try {
  $env:DATABASE_URL = "postgresql://apotolkov:apotolkov_dev@localhost:5432/apotolkov_demo?schema=public"
  $secretFile = Join-Path $runtimeDir "demo-secret.txt"
  if (-not (Test-Path -LiteralPath $secretFile)) {
    $secretBytes = New-Object byte[] 48
    $random = New-Object Security.Cryptography.RNGCryptoServiceProvider
    $random.GetBytes($secretBytes)
    $random.Dispose()
    [IO.File]::WriteAllText($secretFile, [Convert]::ToBase64String($secretBytes))
  }
  $env:AUTH_SECRET = [IO.File]::ReadAllText($secretFile).Trim()
  $env:AUTH_TRUST_HOST = "true"

  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "Миграции демо-базы завершились с ошибкой." }
  npm run db:seed
  if ($LASTEXITCODE -ne 0) { throw "Seed демо-базы завершился с ошибкой." }

  $nextBin = Join-Path $projectRoot "node_modules\next\dist\bin\next"
  $nextBinArgument = "`"$nextBin`""
  $demoOut = Join-Path $logDir "demo-out.log"
  $demoError = Join-Path $logDir "demo-error.log"
  $demo = Start-Process -FilePath "node.exe" -ArgumentList @($nextBinArgument, "start", "--hostname", "127.0.0.1", "--port", "3001") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $demoOut -RedirectStandardError $demoError -PassThru
  [IO.File]::WriteAllText((Join-Path $runtimeDir "demo.pid"), [string]$demo.Id)
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  $env:AUTH_SECRET = $previousAuthSecret
  $env:AUTH_TRUST_HOST = $previousTrustHost
}

$demoReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3001/login" -TimeoutSec 3
    if ($response.StatusCode -eq 200) { $demoReady = $true; break }
  } catch {}
}
if (-not $demoReady) { throw "Демонстрационная CRM не запустилась. Проверьте .runtime\logs\demo-error.log." }

$cloudflared = Join-Path $projectRoot "tools\cloudflared.exe"
if (-not (Test-Path -LiteralPath $cloudflared)) {
  & (Join-Path $PSScriptRoot "install-cloudflared.ps1")
}
$tunnelOut = Join-Path $logDir "tunnel-out.log"
$tunnelError = Join-Path $logDir "tunnel-error.log"
$publicUrlFile = Join-Path $runtimeDir "public-url.txt"
Remove-Item -LiteralPath $tunnelOut, $tunnelError, $publicUrlFile -Force -ErrorAction SilentlyContinue
$tunnel = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--protocol", "http2", "--url", "http://127.0.0.1:3001") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelError -PassThru
[IO.File]::WriteAllText((Join-Path $runtimeDir "tunnel.pid"), [string]$tunnel.Id)

$publicUrl = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  $tunnelLog = ""
  if (Test-Path -LiteralPath $tunnelOut) { $tunnelLog += [IO.File]::ReadAllText($tunnelOut) }
  if (Test-Path -LiteralPath $tunnelError) { $tunnelLog += [IO.File]::ReadAllText($tunnelError) }
  $urlMatch = [regex]::Match($tunnelLog, 'https://[-a-z0-9]+\.trycloudflare\.com')
  if ($urlMatch.Success) { $publicUrl = $urlMatch.Value; break }
  if ($tunnel.HasExited) { break }
}
if (-not $publicUrl) { throw "Не удалось получить публичную ссылку. Проверьте .runtime\logs\tunnel-error.log." }
[IO.File]::WriteAllText($publicUrlFile, $publicUrl)
Write-Host ""
Write-Host "Безопасная демо-ссылка: $publicUrl" -ForegroundColor Green
Write-Host "Она использует отдельную базу только с искусственными данными." -ForegroundColor Green
Write-Host "Для остановки запустите STOP-CRM.cmd." -ForegroundColor Yellow