# installa-skill.ps1 — espone le skill di `agenti/` a Claude Code.
#
# Claude Code carica le skill da `.claude/skills/`, ma la fonte di verita' e'
# `agenti/`. Due copie divergono (e' successo: la copia globale di code-maniac
# e' andata alla deriva rispetto a quella committata), quindi si linka.
# Junction e non symlink: non richiede permessi di amministratore.
# `.claude/skills/` e' in .gitignore, o git committerebbe gli stessi file due
# volte seguendo il link.
#
# USO, dalla radice del repo:  powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1
# Poi riavvia Claude Code.
#
# DESTINAZIONE DIVERSA (dal 2026-08-04, P.4-pre):
#   powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1 -Destinazione C:\percorso\progetto\.claude\skills
# Serve ai progetti generati, che vivono in repo separati (CLAUDE.md; CANTIERE.md
# D11): una chat operaia aperta sul repo del progetto carica le skill dal SUO
# `.claude/skills`, e senza questo parametro non ne vedrebbe nessuna.
# Le junction puntano SEMPRE a `WebGun/agenti/<nome>`, ovunque nascano: la fonte
# di verita' non si sposta, ed e' tutto il motivo per cui si linka invece di
# copiare (vedi sopra: due copie divergono, e' successo).
# Senza il parametro il comportamento e' identico a prima.
#
# `param()` DEVE restare la prima istruzione eseguibile del file: i commenti
# sopra vanno bene, un'assegnazione no. Con `$ErrorActionPreference` prima,
# PowerShell non esegue lo script con un parametro ignorato — muore in parsing.
param(
    [string]$Destinazione
)

$ErrorActionPreference = "Stop"

# Solo le skill VERE. I sei agenti scaffold (brief-smith, preventivo-smith,
# site-doctor, ai-specialist, cyber-shield, launchpad) non si installano finche'
# sono scheletri: una skill con quattro sezioni `TODO` nell'elenco di Claude Code
# e' rumore che si somiglia tutto, e la prima volta che ne invochi una scopri che
# non fa niente. Erano sette fino al 2026-07-30, quando speed-demon ha smesso di
# esserlo: il numero qui sopra si scala insieme all'array qui sotto.
# `gestionale-crafter` e' entrato in elenco il 2026-07-28, quando ha smesso di
# essere uno scaffold: SKILL.md completo, quattro reference, gate a 7 passi con
# 105 test, due collaudi su banchi reali.
# `flow-sentinel` e' entrato lo stesso giorno: costruito e collaudato in modo
# indipendente (108 test al 2026-07-30), verbali nel suo COSTRUZIONE-2026-07-28.md,
# COLLAUDO-2026-07-28.md e COLLAUDO-P3-2026-07-30.md.
# `speed-demon` e' entrato il 2026-07-30, e per due giorni e' stato il caso di
# scuola del difetto che questo file deve evitare: HOWTORUN.md e README.md
# dichiaravano «junction come le altre, da scripts/installa-skill.ps1» mentre
# l'elenco qui sotto non lo conteneva. Chi seguiva il manuale non installava
# niente e non lo sapeva, perche' lo script non ha modo di accorgersi di una
# skill che nessuno gli ha nominato. Quando una skill smette di essere uno
# scaffold, questa riga si tocca **insieme** ai due documenti.
# `vetrina-crafter` e' entrato il 2026-08-03, quando il suo gate a dieci passi ha
# chiuso VERDE 10/10 su `banco-prova-controtempo` — un sito vero, sopra uno schema
# prodotto eseguendo schema-forge. Costruita e sabotata lo stesso giorno: 122 test,
# 7 comandi su 7 esercitati, 22 classi di sabotaggio, tre difetti del gate trovati
# e chiusi. Verbale: agenti/vetrina-crafter/COSTRUZIONE-2026-08-03.md.
# `launchpad` e' entrato il 2026-08-06, quando il suo gate a nove passi ha chiuso
# VERDE 9/9 sul gemello pulito e ROSSO — coi motivi giusti — sul pilota
# `fornodoro`, che non si deve pubblicare. 87 test, 36 classi di sabotaggio
# tutte rosse. Verbale: agenti/launchpad/COSTRUZIONE-2026-08-06.md.
# Attenzione a cosa questo NON dice: nessun deploy e' mai stato eseguito da
# questa skill, e il collaudo avversario non e' stato fatto. Si installa perche'
# il gate gira e rifiuta; non perche' abbia gia' pubblicato qualcosa.
$skill = @("schema-forge", "gestionale-crafter", "vetrina-crafter", "flow-sentinel", "speed-demon", "launchpad", "code-inquisition")

# code-maniac NON e' in elenco di proposito: il README lo dichiara uno SNAPSHOT
# del repo di finzidev, quindi la fonte di verita' non e' questa cartella. Va
# installato dal suo repo con il proprio install.ps1. (Al 2026-07-28 la copia in
# `~/.claude/skills/code-maniac` e quella in `agenti/code-maniac` differiscono su
# 15 file: quale delle due sia quella buona lo decide il proprietario, non uno
# script.)

$radice = Split-Path -Parent $PSScriptRoot
# `$radice` resta la regia anche con `-Destinazione`: e' la sorgente delle
# junction, non il posto dove nascono.
$destinazione = if ([string]::IsNullOrWhiteSpace($Destinazione)) {
    Join-Path $radice ".claude\skills"
} else {
    $Destinazione
}
# La cartella puo' non esistere ancora — il repo di un progetto e' nuovo — e si
# crea come si e' sempre fatto per `.claude\skills`.
New-Item -ItemType Directory -Force -Path $destinazione | Out-Null
# Assoluto DOPO averla creata: `Resolve-Path` fallisce su un percorso che non
# c'e', e un `-Destinazione` relativo lascerebbe messaggi che non dicono dove
# sono finite le junction.
$destinazione = (Resolve-Path $destinazione).Path

Write-Host "destinazione: $destinazione"
Write-Host "sorgente:     $(Join-Path $radice 'agenti')"
Write-Host ""

foreach ($nome in $skill) {
    $sorgente = Join-Path $radice "agenti\$nome"
    if (-not (Test-Path $sorgente)) {
        Write-Host "SALTATA  $nome — $sorgente non esiste"
        continue
    }
    $link = Join-Path $destinazione $nome
    if (Test-Path $link) {
        Write-Host "GIA' C'E' $nome"
        continue
    }
    # il target DEVE essere un percorso assoluto: con uno relativo New-Item fallisce
    New-Item -ItemType Junction -Path $link -Target (Resolve-Path $sorgente).Path | Out-Null
    Write-Host "INSTALLATA $nome"
}

Write-Host ""
Write-Host "Riavvia Claude Code perche' le skill vengano rilette."
