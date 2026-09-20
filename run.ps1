param([switch]$Live)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if ($Live -and -not $env:OPENROUTER_API_KEY) {
  $env:OPENROUTER_API_KEY = [Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'User')
}
$env:JEV_ENABLE_LIVE = if ($Live) { '1' } else { '0' }
node server.mjs
