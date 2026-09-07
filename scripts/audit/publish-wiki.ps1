# scripts/audit/publish-wiki.ps1 - publish the single consolidated audit report to the GitHub wiki.
#
# GitHub bootstraps a repo's wiki git remote LAZILY: the .wiki.git repo does not exist until the first
# page is created through the web UI (opening https://github.com/<owner>/<repo>/wiki once). Until then,
# any CLI push fails with "Repository not found" even with valid credentials and has_wiki=true.
#
# Usage:
#   1. (one-time) Open https://github.com/dimple0613/360-NFC-Valet-monorepo/wiki in a browser so GitHub
#      creates the wiki backing repo. (Wiki is already enabled: has_wiki=true.)
#   2. Run this script from the repo root:
#        .\scripts\audit\publish-wiki.ps1
#      It clones the wiki repo locally, copies audit/360-NFC-Valet-Monorepo-Audit.md as the Home page,
#      and pushes.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$reportMd = Join-Path $repoRoot "audit\360-NFC-Valet-Monorepo-Audit.md"
$wikiHome = "Home.md"
$wikiUrl = "https://github.com/dimple0613/360-NFC-Valet-Monorepo.wiki.git"

if (-not (Test-Path $reportMd)) { throw "Missing report: $reportMd (generate audit/360-NFC-Valet-Monorepo-Audit.md first)" }

# Use gh's auth so the push authenticates as dimple0613.
$gh = Get-Command gh -ErrorAction Stop
$token = (& $gh Source auth token).Trim()

$work = Join-Path $env:TEMP "360-nfc-valet-wiki"
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue

Write-Host "Cloning wiki repo..."
git -c credential.helper= clone "https://x-access-token:${token}@${($wikiUrl -replace 'https://','')}" $work
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Wiki repo not reachable yet. GitHub only creates it once a page is opened in the browser."
    Write-Host "Open  https://github.com/dimple0613/360-NFC-Valet-Monorepo/wiki  once, then re-run this script."
    exit 1
}

Copy-Item $reportMd -Destination (Join-Path $work $wikiHome) -Force

Push-Location $work
try {
    git add -A
    git -c user.name="dimple0613" -c user.email="dimple0613" commit -m "Publish consolidated 360 NFC Valet audit report"
    git push
    if ($LASTEXITCODE -eq 0) { Write-Host "Wiki updated: https://github.com/dimple0613/360-NFC-Valet-monorepo/wiki" }
    else { Write-Host "Push failed (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
}

Pop-Location