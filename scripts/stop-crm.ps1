param([switch]$StopDatabase)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$pidFile = Join-Path $runtimeDir "crm.pid"
Set-Location $projectRoot

$tunnelPidFile = Join-Path $runtimeDir "tunnel.pid"
if (Test-Path -LiteralPath $tunnelPidFile) {
  $tunnelPid = [int]([IO.File]::ReadAllText($tunnelPidFile).Trim())
  $tunnelProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $tunnelPid" -ErrorAction SilentlyContinue
  if ($tunnelProcess -and $tunnelProcess.Name -eq "cloudflared.exe") {
    Stop-Process -Id $tunnelPid -Force -ErrorAction SilentlyContinue
    Write-Host "Публичный туннель остановлен." -ForegroundColor Green
  }
  Remove-Item -LiteralPath $tunnelPidFile, (Join-Path $runtimeDir "public-url.txt") -Force -ErrorAction SilentlyContinue
}

$demoPidFile = Join-Path $runtimeDir "demo.pid"
if (Test-Path -LiteralPath $demoPidFile) {
  $demoPid = [int]([IO.File]::ReadAllText($demoPidFile).Trim())
  $demoProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $demoPid" -ErrorAction SilentlyContinue
  if ($demoProcess -and $demoProcess.Name -eq "node.exe" -and $demoProcess.CommandLine -like "*next*start*3001*") {
    Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue
    Write-Host "Демонстрационная CRM остановлена." -ForegroundColor Green
  }
  Remove-Item -LiteralPath $demoPidFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $pidFile) {
  $serverPid = [int]([IO.File]::ReadAllText($pidFile).Trim())
  $all = Get-CimInstance Win32_Process
  $root = $all | Where-Object { $_.ProcessId -eq $serverPid }
  if ($root -and $root.CommandLine -like "*$projectRoot*next*start*") {
    $ids = [System.Collections.Generic.List[int]]::new()
    $ids.Add($serverPid)
    do {
      $added = $false
      foreach ($process in $all) {
        if ($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)) {
          $ids.Add([int]$process.ProcessId)
          $added = $true
        }
      }
    } while ($added)
    $ordered = @($ids)
    [array]::Reverse($ordered)
    foreach ($id in $ordered) {
      Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "CRM остановлена." -ForegroundColor Green
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

if ($StopDatabase) {
  docker compose stop
  Write-Host "PostgreSQL остановлен. Данные сохранены." -ForegroundColor Green
}