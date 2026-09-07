# scripts/audit/issues.ps1 - manage the audit backlog as GitHub issues, then
# auto pull/commit/push a finished task.
#
# The machine-readable backlog is audit/backlog.json (mirrors merged-audit.md sec 4).
#
# Usage (run from repo root; requires `gh` CLI authenticated with repo scope):
#   .\scripts\audit\issues.ps1 log
#       List open audit issues + backlog status.
#   .\scripts\audit\issues.ps1 sync
#       Create a GitHub issue (label "audit") for every open backlog item that has
#       none yet, and close any open issue whose backlog item is marked "closed".
#       Issue numbers are written back into audit/backlog.json.
#   .\scripts\audit\issues.ps1 close -Id M5 -Message "chore(audit): fix M5 lint debt"
#       Pull --rebase, stage/commit only audit/ + files for this task, push, then
#       close the GitHub issue and mark the backlog item closed.
#   .\scripts\audit\issues.ps1 push -Message "chore(audit): tenant-admin report" -Files audit/tenant-admin-audit.md,web/src/app/tenant-admin/_lib/valet-data.ts
#       Pull --rebase, stage the given paths, commit, push (no issue touched).
#       Omit -Files to stage everything under the repo (scoped -Files is preferred
#       so unrelated in-progress work is never swept into the commit).
#
# After a task completes, the happy path is: `sync` pushed the issue into GitHub,
# you finish the work, then `close -Id Mx -Message "..." -Files <paths>` commits,
# pushes (CI workflow runs the gate) and closes the issue in one step.

[CmdletBinding()]
param(
    [ValidateSet("log", "sync", "close", "push")]
    [string]$Command = "log",
    [string]$Id,
    [string]$Message,
    [string[]]$Files = @()
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $repoRoot

$backlogPath = Join-Path $repoRoot "audit\backlog.json"

function Get-Backlog {
    if (-not (Test-Path $backlogPath)) { throw "Missing $backlogPath" }
    Get-Content $backlogPath -Raw | ConvertFrom-Json
}

function Save-Backlog($backlog) {
    $backlog | ConvertTo-Json -Depth 6 | Set-Content $backlogPath -Encoding UTF8
}

function Get-OctoRepo {
    (gh repo view --json nameWithOwner --jq ".nameWithOwner").Trim()
}

function Ensure-Label {
    $labels = @(gh label list --json name --jq ".[].name" 2>$null)
    if (-not ($labels -contains "audit")) {
        gh label create "audit" --color "5319e7" --description "Audit backlog (audit/merged-audit.md sec 4)" | Out-Null
    }
}

function Get-OpenAuditIssues {
    @(gh issue list --label audit --state open --json number,title 2>$null | ConvertFrom-Json)
}

function New-IssueForItem($item) {
    $title = "[AUDIT $($item.id)] $($item.title)"
    $body = @"
Source: `audit/merged-audit.md` sec 4 and `audit/tenant-admin-audit.md` findings.

- Severity: $($item.severity)
- Backlog id: $($item.id)
- Status: open

Done means the fix is committed, pushed, and CI (`.github/workflows/ci.yml`) is green.
"@
    $created = gh issue create --title $title --label audit --body $body | Out-String
    $created.Trim()
}

function Sync-Issues {
    $backlog = Get-Backlog
    Ensure-Label
    $open = Get-OpenAuditIssues
    foreach ($item in $backlog.items) {
        $expectedTitle = "[AUDIT $($item.id)] $($item.title)"
        $match = $open | Where-Object { $_.title -eq $expectedTitle } | Select-Object -First 1
        if (($item.status -eq "closed") -or ($item.status -eq "done")) {
            if ($match) {
                gh issue close "$($match.number)" --comment "Backlog item marked done; fixing commit pushed." | Out-Null
                Write-Host "[$($item.id)] closed GitHub issue #$($match.number)"
            }
            continue
        }
        if ($null -eq $match) {
            $null = New-IssueForItem $item
            $open = Get-OpenAuditIssues
            $match = $open | Where-Object { $_.title -eq $expectedTitle } | Select-Object -First 1
            if ($null -ne $match) {
                Write-Host "[$($item.id)] created GitHub issue #$($match.number)"
            }
        }
        if ($null -ne $match) {
            $item.issue = $match.number
        }
    }
    Save-Backlog $backlog
}

function Close-Issue($id) {
    $backlog = Get-Backlog
    $item = $backlog.items | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if (-not $item) { throw "No backlog item with id '$id'" }
    if (-not $item.issue) { throw "Backlog item $id has no GitHub issue yet - run 'sync' first." }

    $item.status = "closed"
    Save-Backlog $backlog
    gh issue close "$($item.issue)" --comment "Backlog item marked done; fixing commit pushed." | Out-Null
    Write-Host "[$id] closed GitHub issue #$($item.issue)"
}

function Invoke-PullRebase {
    git pull --rebase --autostash origin master
    if (-not $?) { throw "git pull --rebase failed - resolve conflicts before pushing." }
}

function Invoke-CommitPush($files, $msg) {
    if ([string]::IsNullOrWhiteSpace($msg)) { throw "A -Message is required to commit and push." }
    $paths = @($files | Where-Object { $_ })
    if ($paths.Count -eq 0) {
        Write-Warning "No -Files given; staging all changes (git add -A). Prefer scoped -Files so unrelated work is never swept in."
        $paths = @(".")
    }
    Invoke-PullRebase
    git add -- @($paths)
    if (-not $?) { throw "git add failed." }
    git commit -m $msg
    if (-not $?) { Write-Warning "Nothing to commit (clean tree) - skipping commit." }
    elseif (git push origin master) { Write-Host "Pushed to origin/master." }
}

switch ($Command) {
    "log" {
        $backlog = Get-Backlog
        Write-Host ("Backlog: {0}" -f $backlog.source)
        Write-Host ("{0,-3} {1,-12} {2}" -f "Id", "Severity", "Title")
        foreach ($item in $backlog.items) {
            $issueRef = if ($item.issue) { "#$($item.issue)" } else { "no issue" }
            Write-Host ("{0,-3} {1,-12} {2}  -> {3} ({4})" -f $item.id, $item.severity, $item.title, $item.status, $issueRef)
        }
        Write-Host ""
        $open = Get-OpenAuditIssues
        Write-Host "Open GitHub issues (label audit): $($open.Count)"
        foreach ($o in $open) { Write-Host ("  #{0} {1}" -f $o.number, $o.title) }
    }
    "sync" { Sync-Issues }
    "close" {
        if (-not $Id) { throw "-Id is required (e.g. -Id M5)." }
        if ($Message) {
            Invoke-CommitPush $Files $Message
        }
        Close-Issue $Id
    }
    "push" {
        Invoke-CommitPush $Files $Message
    }
}

Pop-Location