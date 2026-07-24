#!/usr/bin/env pwsh
# Code Maniac — installa TUTTO in un colpo:
#   1) copia la skill in ~/.claude/skills/code-maniac
#   2) installa i tre aiutanti (graphify, caveman, ponytail), saltando i già presenti
#
# Uso (dalla cartella del repo):
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
# Argomenti extra vengono passati a setup.mjs, es.:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 --skills-dir D:\skills
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $HOME '.claude\skills\code-maniac'

Write-Host "Code Maniac -> installo la skill in $dst" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /E /XD .git /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "copia fallita (robocopy exit $LASTEXITCODE)" }
$global:LASTEXITCODE = 0

Write-Host "Skill installata. Installo graphify, caveman, ponytail..." -ForegroundColor Cyan
node (Join-Path $dst 'scripts\setup.mjs') @args

Write-Host "Fatto. Riavvia Claude Code." -ForegroundColor Green
