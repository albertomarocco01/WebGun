# {{n}} — site-doctor

Passaggio di consegne verso **launchpad** (e verso cyber-shield, quando
esisterà). Contratto del `CLAUDE.md`: cosa ho fatto, cosa ho deciso, cosa mi
aspetto dal successivo, cosa lascio aperto.

## 1. Cosa ho fatto

- Camminata la superficie pubblica: **{{n}} pagine**, da due sorgenti
  (collegamenti da `/` e `sitemap.xml`).
- Misurato: informativa privacy, campi dei moduli pubblici, cookie e
  archiviazione nel browser, origini di terzi, accessibilità dell'HTML servito,
  lingua e hreflang.
- Emesso `docs/conformita.md` — il **certificato di idoneità**, firmato.
- {{Generata la pagina dell'informativa in bozza e il collegamento nel piè di
  pagina / Nessun file generato: c'erano già.}}

## 2. Decisioni prese, con la motivazione

| # | Decisione | Perché | Se è sbagliata |
|---|---|---|---|
| {{1}} | {{…}} | {{…}} | {{…}} |

## 3. Il perimetro: chi guarda cosa

La tabella completa sta in `docs/conformita.md` §Voci di conformità e proprietà.
Qui il riassunto che serve a chi viene dopo:

- **Mie e misurate:** informativa privacy, basi giuridiche, cookie e
  archiviazione, consenso, accessibilità del sito pubblico, lingua e hreflang.
- **Delegate, con il file che le dichiara:** {{canonical, sitemap, robots,
  noindex, Open Graph, favicon, dati strutturati, contrasti → speed-demon
  (`docs/handoff/13-speed-demon.md`); accessibilità dell'area amministrativa →
  gestionale-crafter (`docs/handoff/10-gestionale-crafter.md`)}}.
- **SCOPERTE — nessuno le guarda:** {{antispam e limiti di frequenza sui moduli
  pubblici: sarebbero di cyber-shield, che non esiste}}.

Una voce scoperta non è un residuo minore: è una cosa che nessuno ha guardato e
che qualcuno leggendo questo documento potrebbe credere guardata. È scritta qui
per quello.

## 4. Cosa il sito mette nel browser di chi passa

| chiave | tipo | essenziale | dove è stata misurata |
|---|---|---|---|
| {{—}} | {{—}} | {{—}} | {{—}} |

Origini di terzi: {{nessuna}}. Un terzo non dichiarato è un bloccante, perché
quello che fa nel browser questo gate non lo può misurare.

## 5. Cosa si aspetta chi viene dopo

**Launchpad** — non pubblicare senza `docs/conformita.md` firmato e con la riga
`Gate: VERDE`. Il certificato è il tuo ingresso. Se il gate è rosso il sito
**non è idoneo**, e i motivi sono elencati al §7.

**Cyber-shield** (quando esisterà) — i percorsi di scrittura pubblici misurati
sono: {{/contatti}}. Antispam e limiti di frequenza sono dichiarati **scoperti**.

**Vetrina-crafter / gestionale-crafter** — le richieste aperte sono al §6: sono
richieste, non correzioni fatte di nascosto nel vostro codice.

## 6. Richieste ai vicini

| a chi | cosa | perché |
|---|---|---|
| {{—}} | {{—}} | {{—}} |

## 7. Problemi noti e residui

| # | Cosa | Gravità | Dove è scritto |
|---|---|---|---|
| {{1}} | {{…}} | {{…}} | `docs/DEBITO-TECNICO.md` n°{{…}} |

## 8. Guardiani

- `code-maniac scan`: {{pulito / residuo documentato in `docs/DEBITO-TECNICO.md`}}
- `/code-inquisition --focus security,reliability`: {{n rilievi, sorte di ciascuno}}
- I gate dei vicini sulla stessa build: {{schema-forge n/n · vetrina-crafter n/n ·
  gestionale-crafter n/n · flow-sentinel n/n · speed-demon n/n}}

Un certificato di idoneità firmato sopra un gate rosso a monte è una firma su
un'altra cosa.

## 9. Verdetto del gate

Il gate di site-doctor su questa esecuzione: **{{n}} passi**, {{n}} falliti,
{{n}} verifiche mancanti, {{n}} non applicabili.

Gate: {{VERDE}}

<!-- La riga qui sopra è di forma fissa e il gate la CONFRONTA col verdetto di
     questa esecuzione (`DECISIONI.md` §19). Se diverge, il passo
     `contratto-uscita` fallisce e dice quale dei due è quello vero.
     Se il gate è rosso, l'handoff si scrive lo stesso e dichiara ROSSO:
     dichiarare non è fallire. -->
