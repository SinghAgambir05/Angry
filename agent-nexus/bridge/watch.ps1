# Agent Nexus — Windows inbox watcher
# Usage:
#   1. Start Nexus: npm run dev (or npm start) in agent-nexus/
#   2. powershell -ExecutionPolicy Bypass -File bridge/watch.ps1
#   3. Drop .md handoffs into %USERPROFILE%\AgentNexus\inbox

param(
  [string]$Api = "http://localhost:8787/api/bridge/ingest",
  [string]$AgentId = "agent-chatgpt",
  [string]$WatchDir = "$env:USERPROFILE\AgentNexus\inbox"
)

New-Item -ItemType Directory -Force -Path $WatchDir | Out-Null
Write-Host "Agent Nexus bridge watching: $WatchDir"
Write-Host "Posting as agent: $AgentId → $Api"

$watcher = New-Object System.IO.FileSystemWatcher $WatchDir, "*.md"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
  Start-Sleep -Milliseconds 500
  $path = $Event.SourceEventArgs.FullPath
  if (-not (Test-Path $path)) { return }
  try {
    $body = Get-Content -Raw -Path $path
    $key = "bridge." + [System.IO.Path]::GetFileNameWithoutExtension($path)
    $payload = @{
      agentId = $using:AgentId
      kind = "handoff"
      body = $body
      contextKey = $key
      contextTitle = $key
    } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri $using:Api -Method Post -ContentType "application/json; charset=utf-8" -Body $payload | Out-Null
    Move-Item -Force $path ($path + ".done")
    Write-Host "Ingested $path"
  } catch {
    Write-Warning "Failed $($path): $_"
  }
}

Register-ObjectEvent $watcher Created -Action $action | Out-Null
Register-ObjectEvent $watcher Changed -Action $action | Out-Null

Write-Host "Press Ctrl+C to stop."
while ($true) { Start-Sleep -Seconds 5 }
