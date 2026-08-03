param(
  [switch]$Public,
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$logDir = Join-Path $runtimeDir "logs"
New-Item -ItemType Directory -Force $runtimeDir, $logDir | Out-Null
Set-Location $projectRoot

$envFile = Join-Path $projectRoot ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath (Join-Path $projectRoot ".env.example") -Destination $envFile
  $secretBytes = New-Object byte[] 48
  $random = New-Object Security.Cryptography.RNGCryptoServiceProvider
  $random.GetBytes($secretBytes)
  $random.Dispose()
  $secret = [Convert]::ToBase64String($secretBytes)
  $envContent = [IO.File]::ReadAllText($envFile)
  $envContent = [regex]::Replace(
    $envContent,
    'AUTH_SECRET="[^"]*"',
    "AUTH_SECRET=`"$secret`""
  )
  [IO.File]::WriteAllText($envFile, $envContent, [Text.UTF8Encoding]::new($true))
  Write-Host "Создан .env с новым секретом авторизации." -ForegroundColor Green
}

function Test-CrmUrl {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/login" -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js не установлен. Установите Node.js 20.19 или новее."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop не установлен. Установите Docker Desktop и повторите запуск."
}

function Test-DockerReady {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  docker info 1> $null 2> $null
  $ready = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $previousPreference
  return $ready
}

if (-not (Test-DockerReady)) {
  $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $dockerDesktop)) {
    throw "Docker Desktop найден не был. Запустите или установите Docker Desktop."
  }
  Write-Host "Запускаю Docker Desktop..." -ForegroundColor Cyan
  Start-Process -FilePath $dockerDesktop | Out-Null
  $dockerReady = $false
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 2
    if (Test-DockerReady) {
      $dockerReady = $true
      break
    }
  }
  if (-not $dockerReady) {
    throw "Docker Desktop не запустился за 90 секунд. Откройте его вручную и повторите."
  }
}

Write-Host "Запускаю PostgreSQL..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "Не удалось запустить PostgreSQL." }

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
  Write-Host "Устанавливаю зависимости..." -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "Не удалось установить зависимости." }
}

Write-Host "Проверяю базу данных..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "Не удалось сгенерировать Prisma Client." }
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "Не удалось применить миграции." }

$userCount = docker compose exec -T postgres psql -U apotolkov -d apotolkov -tAc "SELECT COUNT(*) FROM users;"
if ($LASTEXITCODE -ne 0) { throw "Не удалось проверить пользователей в PostgreSQL." }
if ([int]$userCount.Trim() -eq 0) {
  Write-Host "Создаю администратора и демонстрационные данные..." -ForegroundColor Cyan
  npm run db:seed
  if ($LASTEXITCODE -ne 0) { throw "Seed завершился с ошибкой." }
}

$buildId = Join-Path $projectRoot ".next\BUILD_ID"
$sourcePaths = @(
  (Join-Path $projectRoot "src"),
  (Join-Path $projectRoot "prisma"),
  (Join-Path $projectRoot "public"),
  (Join-Path $projectRoot "package.json"),
  (Join-Path $projectRoot "next.config.ts")
)
$latestSource = Get-ChildItem -LiteralPath $sourcePaths -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
$buildIsStale = -not (Test-Path -LiteralPath $buildId) -or
  ($latestSource -and $latestSource.LastWriteTimeUtc -gt (Get-Item -LiteralPath $buildId).LastWriteTimeUtc)
if ($Rebuild -or $buildIsStale) {
  Write-Host "Собираю приложение. Это может занять несколько минут..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Production build завершился с ошибкой." }
}

if (-not (Test-CrmUrl)) {
  Write-Host "Запускаю CRM..." -ForegroundColor Cyan
  $stdout = Join-Path $logDir "crm-out.log"
  $stderr = Join-Path $logDir "crm-error.log"
  $nextBin = Join-Path $projectRoot "node_modules\next\dist\bin\next"
  $nextBinArgument = "`"$nextBin`""
  $server = Start-Process -FilePath "node.exe" -ArgumentList @($nextBinArgument, "start", "--hostname", "0.0.0.0", "--port", "3000") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  [IO.File]::WriteAllText((Join-Path $runtimeDir "crm.pid"), [string]$server.Id)
  $started = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-CrmUrl) {
      $started = $true
      break
    }
  }
  if (-not $started) {
    throw "CRM не запустилась. Проверьте .runtime\logs\crm-error.log."
  }
}

Write-Host ""
Write-Host "CRM работает: http://localhost:3000" -ForegroundColor Green
Write-Host "На телефоне в домашней сети используйте IP этого компьютера и порт 3000." -ForegroundColor Green

if ($Public) {
  $cloudflared = Join-Path $projectRoot "tools\cloudflared.exe"
  if (-not (Test-Path -LiteralPath $cloudflared)) {
    & (Join-Path $PSScriptRoot "install-cloudflared.ps1")
  }
  $tunnelPidFile = Join-Path $runtimeDir "tunnel.pid"
  $publicUrlFile = Join-Path $runtimeDir "public-url.txt"
  $existingTunnel = $null
  if (Test-Path -LiteralPath $tunnelPidFile) {
    $existingTunnelPid = [int]([IO.File]::ReadAllText($tunnelPidFile).Trim())
    $existingTunnel = Get-Process -Id $existingTunnelPid -ErrorAction SilentlyContinue
  }
  if (-not $existingTunnel) {
    $tunnelOut = Join-Path $logDir "tunnel-out.log"
    $tunnelError = Join-Path $logDir "tunnel-error.log"
    Remove-Item -LiteralPath $tunnelOut, $tunnelError, $publicUrlFile -Force -ErrorAction SilentlyContinue
    Write-Host "Создаю временную публичную ссылку..." -ForegroundColor Cyan
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--protocol", "http2", "--url", "http://localhost:3000") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelError -PassThru
    [IO.File]::WriteAllText($tunnelPidFile, [string]$tunnel.Id)
    $publicUrl = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Seconds 1
      $tunnelLog = ""
      if (Test-Path -LiteralPath $tunnelOut) { $tunnelLog += [IO.File]::ReadAllText($tunnelOut) }
      if (Test-Path -LiteralPath $tunnelError) { $tunnelLog += [IO.File]::ReadAllText($tunnelError) }
      $urlMatch = [regex]::Match($tunnelLog, 'https://[-a-z0-9]+\.trycloudflare\.com')
      if ($urlMatch.Success) {
        $publicUrl = $urlMatch.Value
        break
      }
      if ($tunnel.HasExited) { break }
    }
    if (-not $publicUrl) {
      throw "Не удалось получить публичную ссылку. Проверьте .runtime\logs\tunnel-error.log."
    }
    [IO.File]::WriteAllText($publicUrlFile, $publicUrl)
  } else {
    $publicUrl = if (Test-Path -LiteralPath $publicUrlFile) {
      [IO.File]::ReadAllText($publicUrlFile).Trim()
    } else {
      "Ссылка уже запущена; проверьте .runtime\logs\tunnel-error.log"
    }
  }
  Write-Host ""
  Write-Host "Публичная ссылка: $publicUrl" -ForegroundColor Green
  Write-Host "Для остановки запустите STOP-CRM.cmd." -ForegroundColor Yellow
}