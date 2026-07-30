# estrai-docx.ps1 — rigenera `webgun_content.txt` da `Web Gun.docx`.
#
# `Web Gun.docx` e' il documento madre della pipeline e lo si modifica in Word;
# `webgun_content.txt` esiste solo perche' un .docx e' binario e git non lo sa
# confrontare (DECISIONI.md §3). Finche' la copia di testo si scriveva a mano,
# la coppia si e' spezzata senza che nessuno se ne accorgesse: al 2026-07-30 il
# .docx dichiarava Gestionale Crafter e Flow Sentinel «[Ce l'ho]» e il .txt li
# dichiarava ancora «[Da creare]» — cioe' l'unico dei due file che si puo'
# leggere in un diff era quello sbagliato. Da qui in poi il .txt non si tocca:
# si rilancia questo.
#
# USO, dalla radice del repo:  powershell -ExecutionPolicy Bypass -File scripts/estrai-docx.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$radice = Split-Path -Parent $PSScriptRoot
$docx = Join-Path $radice "Web Gun.docx"
$uscita = Join-Path $radice "webgun_content.txt"

$zip = [System.IO.Compression.ZipFile]::OpenRead($docx)
try {
    $voce = $zip.GetEntry("word/document.xml")
    if (-not $voce) { throw "$docx non contiene word/document.xml: non e' un .docx" }
    $lettore = New-Object System.IO.StreamReader($voce.Open(), [System.Text.Encoding]::UTF8)
    $xml = $lettore.ReadToEnd()
    $lettore.Dispose()
} finally { $zip.Dispose() }

# Un paragrafo per riga. NON un run per riga: Word spezza un run a meta' parola
# quando ci passa sopra il correttore, e il .txt tracciato ne portava la cicatrice
# (`// BUTCHER DA METTE` / `REEEEEEEE` su due righe).
$xml = $xml -replace '<w:tab[^>]*/>', "`t"
$xml = $xml -replace '<w:br[^>]*/>', "`n"
$xml = $xml -replace '</w:p>', "`n"
$testo = [System.Net.WebUtility]::HtmlDecode(($xml -replace '<[^>]+>', ''))

$righe = $testo -split "`n" | Where-Object { $_.Trim() -ne "" }
[System.IO.File]::WriteAllText($uscita, ($righe -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "webgun_content.txt rigenerato: $($righe.Count) righe da $(Split-Path -Leaf $docx)"
