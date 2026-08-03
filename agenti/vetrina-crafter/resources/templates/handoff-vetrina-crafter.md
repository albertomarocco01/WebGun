# Handoff — Vetrina Crafter

> Template. Ogni `{{segnaposto}}` va sostituito: un file con `{{…}}` residui non è un
> handoff, e il passo `contratto-uscita` del gate lo boccia.
>
> **Destinazione:** `docs/handoff/<n>-vetrina-crafter.md` del progetto generato, dove
> `<n>` è il numero **successivo all'ultimo handoff già presente** in `docs/handoff/`.
> La numerazione è progressiva **per progetto**, non fissata per agente: nei progetti
> passati questa pipeline ha prodotto `07-schema-forge`, `12-flow-sentinel`,
> `14-flow-sentinel`, `15-speed-demon`. Chi cerca un numero fisso non lo trova, e chi
> lo inventa scavalca l'handoff di qualcun altro: si guarda la cartella e si conta.
>
> **Handoff da leggere prima di compilare questo:** quello di **schema-forge** (tabelle,
> policy per l'anonimo, tabella dei contenuti, seed) e, se è già passato, quello di
> **gestionale-crafter** (quali slot esistono e chi li cura). E `docs/PROGETTO.md`, che
> dice quali deroghe di stack esistono.

Questo handoff è l'unico posto in cui resta scritto **perché il sito pubblico è fatto
così**: quali pagine sono state firmate, da dove arriva ogni pezzo di contenuto, e —
la riga che nessun altro documento porta — **cosa è diventato visibile a chiunque**.

## 1. Cosa ho fatto

- **Contratto**: `docs/vetrina.md` — {{N}} pagine dichiarate, {{N}} slot,
  `Confermato da: {{CHI}}` il {{DATA}}.
- **{{N}} pagine costruite** (tabella §3), ognuna con il suo stato vuoto e il suo
  `not-found` dove la rotta è dinamica.
- **Cucitura**: `src/components/ui/` — {{N}} primitive ({{ELENCO}}), dichiarate in
  `vetrina.config.json`.
- **Client dei dati**: `{{src/lib/supabase/public.ts}}`, l'unico del sito pubblico, con
  la **chiave anonima**.
- **Lettore dei contenuti**: `{{src/modules/contenuti/leggi.ts}}` — legge i soli slot
  pubblicati.
- File toccati: {{ELENCO_PERCORSI}}.
- `docs/DEBITO-TECNICO.md` aggiornato con {{COSA_RESTA_O_NULLA}}.

I comandi con cui si rifà tutto, nell'ordine:

```bash
# 1. il gate misura una BUILD DI PRODUZIONE di questo progetto, su una porta dedicata
npm run build
npm run start -- -p {{PORTA}}        # 3000 e' dove sta gia' quasi sempre qualcos'altro

# 2. i controlli statici da soli, senza app accesa (utili durante la costruzione)
node {{PERCORSO_WEBGUN}}/agenti/vetrina-crafter/scripts/vetrina-audit.mjs

# 3. il gate di questo agente, dieci passi
node {{PERCORSO_WEBGUN}}/agenti/vetrina-crafter/scripts/verify.mjs --url http://127.0.0.1:{{PORTA}}
```

## 2. Modello assunto

{{IN_ITALIANO_SEMPLICE: quali pagine esistono, cosa mostra ciascuna, che gerarchia
hanno, cosa NON esiste e perché.}}

Confermato da: {{UMANO (nome, ruolo) | ORCHESTRATORE}} il {{DATA}}.

Assunzioni prese perché il brief non rispondeva (default scelto → conseguenza se è
sbagliato):

| Assunzione | Default scelto | Conseguenza se è sbagliata |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

<!--
In modalita' pipeline lo Specchio della vetrina non sparisce: il modello assunto si
SCRIVE qui, cosi' un errore di comprensione resta leggibile invece di sparire dentro un
commit di pagine (`DECISIONI.md` §6).

Due domande pero' non si assumono mai, nemmeno in pipeline, e se sono arrivate fin qui
senza risposta questo handoff non si scrive: QUALI DATI VEDE UN ANONIMO e SE ESISTE UN
PERCORSO DI SCRITTURA PUBBLICO. Sono le due che non si annullano.
-->

## 3. Pagine costruite

| Pagina (`id`) | Rotta | Fonti | Aggiornamento | Stato vuoto | Note |
|---|---|---|---|---|---|
| `{{home}}` | `{{/}}` | {{`tabella:piante` · `slot:home-hero`}} | {{ISR 600}} | {{cosa si vede se non c'è niente}} | {{}} |

La colonna **Stato vuoto** non è burocrazia: una lista senza righe è la condizione
normale di un sito appena consegnato, e una pagina che in quel caso mostra il vuoto è
una pagina rotta il primo giorno. Se una cella dice «non gestito», è un residuo e va
in §8.

## 4. Cosa è diventato pubblico

| Tabella o vista | Colonne che un anonimo riceve | Chi l'ha autorizzato |
|---|---|---|
| `{{piante}}` | {{elenco esatto}} | {{nome, ruolo}} ({{DATA}}) |

Percorsi di scrittura aperti al pubblico: {{ELENCO_O_NESSUNO}}.

<!--
E' la sezione che questo handoff ha e gli altri no, e sta qui e non in fondo perche' e'
l'unica informazione irreversibile della consegna: un dato pubblicato e' di chi l'ha
copiato, indicizzato o messo in cache, e nessuna correzione lo riporta indietro.

«Colonne che un anonimo riceve» si compila leggendo il MODELLO DI ACCESSO
dell'handoff di schema-forge, non solo le query. Misurato in P1 sul banco, e cambia
cosa va scritto qui:

  - una colonna selezionata e non disegnata NON arriva al browser su una pagina resa
    interamente sul server: di un Server Component viaggia l'uscita, non i suoi dati
    (zero occorrenze nell'HTML servito e nel payload RSC). Arriva pero' appena quella
    riga passa a un Client Component come prop, che e' un cambio di una riga;
  - ma la CHIAVE ANONIMA STA NEL BUNDLE, e con quella chiunque chiede a PostgREST le
    colonne che il `grant` e la policy concedono — anche quelle che nessuna pagina
    seleziona. Misurato: `?select=id,created_at,in_evidenza` risponde.

Quindi in questa tabella si scrivono DUE cose diverse e non una: le colonne che la
pagina fetcha (dalle query) e le colonne che l'anonimo PUO' leggere (dalle policy).
Se le seconde sono piu' delle prime, la differenza e' pubblicata lo stesso, e il gate
non la vede: e' la riga che rende questa sezione l'unica difesa che esista.
-->

## 5. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

Deroghe registrate anche in `docs/PROGETTO.md` e `docs/DEBITO-TECNICO.md`:
{{ELENCO_O_NESSUNA}}

<!--
Una deroga che vale sempre e va scritta anche qui, con il suo rientro previsto: i
componenti UI sono scritti a mano perche' **Fly UI non esiste** (`DECISIONI.md` §21).
Stanno dietro la cucitura `src/components/ui/` proprio perche' il giorno in cui una
libreria arrivera' si riscriva il corpo di quei file e non le pagine. Rientro previsto:
«alla nascita di una libreria di componenti della pipeline».
-->

## 6. Cosa si aspetta chi viene dopo

- **Gestionale Crafter** (se non è ancora passato) — gli slot che il sito legge sono
  {{ELENCO_CHIAVI}}, sulla tabella `{{site_content}}`: la vista di modifica deve usare
  **le stesse chiavi**, o il cliente modificherà righe che nessuna pagina mostra.
- **Flow Sentinel** — i flussi pubblici che questa vetrina apre sono {{ELENCO}}
  (navigazione del catalogo, apertura di una scheda, {{modulo di contatto}}). È il punto
  di partenza del suo `map`, non la sua conclusione. Dati di seed su cui i flussi
  reggono: {{QUANTE_RIGHE_IN_QUALI_TABELLE}}.
- **Speed Demon** — le pagine da misurare sono già dichiarate in `docs/vetrina.md` con
  la loro fonte: `docs/performance.md` parte da lì e non dal routing. `title` e
  `description` esistono già e la loro origine è dichiarata per pagina; **`canonical`,
  `robots`, `sitemap.ts` e Open Graph non sono stati scritti**: sono suoi.
- **Site Doctor** (quando esisterà) — non sono stati fatti, e sono suoi: cookie e
  consenso, `robots.txt`, `sitemap`, favicon, Open Graph, hreflang, contrasti.
  Verificato qui solo ciò che `eslint-plugin-jsx-a11y` sa vedere.
- **Cyber Shield** — la superficie pubblica è {{ELENCO}}; ogni percorso di scrittura
  della §4 è aperto a una sessione anonima e **non ha difese dagli abusi**.
- **Launchpad** — non si pubblica su gate rosso, né su questo né su quelli a monte.

## 7. Richieste rimaste aperte

Un permesso, una colonna o una tabella che mancano non si aggirano: si chiedono.

| A chi | Cosa serve | Perché | Stato |
|---|---|---|---|
| {{schema-forge}} | {{...}} | {{quale pagina non si può fare senza}} | {{aperta/chiusa}} |

<!--
Le tre richieste che questa vetrina produce piu' spesso, e che vale la pena riconoscere
subito invece di risolverle di nascosto:
  - una POLICY DI LETTURA PER L'ANONIMO che non c'e': la pagina risponde, e' viva ed e'
    vuota. Il passo `contenuti-vivi` la trova contando le righe leggibili impersonando
    il ruolo anonimo — e questo e' il modo n°1 in cui un sito pubblico sopra la RLS
    fallisce in silenzio;
  - la TABELLA DEI CONTENUTI che non esiste: senza, i testi finiscono nel codice e il
    cliente telefona a noi per cambiare una parola (`DECISIONI.md` §24);
  - una COLONNA che serve alla pagina e che nessuno ha previsto (uno slug, un ordine,
    una foto di copertina).
La quarta, che non e' una richiesta ma il suo contrario: una colonna che l'anonimo
PUO' leggere e non dovrebbe. Si segnala qui con la stessa serieta'.
-->

## 8. Residui del gate e problemi noti

**Gate: {{VERDE|ROSSO}}** ({{N}} falliti, {{N}} verifiche mancanti su 10 passi) —
rilanciato il {{DATA}} con `{{COMANDO}}`.

> Questa riga **la verifica il gate stesso**, ultimo passo (`contratto-uscita`): se
> dichiara un verdetto diverso da quello dell'esecuzione in corso, il passo fallisce e
> dice quale dei due è quello vero. Un handoff che dice «tutto verde» mentre il gate
> chiude rosso è il modo in cui un difetto arriva a valle con un timbro sopra.
> Dichiarare ROSSO su un gate rosso **passa**: dichiarare non è fallire
> (`DECISIONI.md` §19). La forma è fissa: una riga che comincia con `Gate:` seguito da
> `VERDE` o `ROSSO`.

| Passo | Stato | Cosa resta | Rientro previsto |
|---|---|---|---|
| `contratto-vetrina` | {{pass/fail/skipped}} | {{}} | {{}} |
| `tipi` | {{}} | {{}} | {{}} |
| `cucitura-ui` | {{}} | {{}} | {{}} |
| `chiavi-e-client` | {{}} | {{}} | {{}} |
| `a11y-statica` | {{}} | {{}} | {{}} |
| `app-identita` | {{}} | {{}} | {{}} |
| `pagine-vive` | {{}} | {{}} | {{}} |
| `segnaposto-serviti` | {{}} | {{}} | {{}} |
| `contenuti-vivi` | {{}} | {{}} | {{}} |
| `contratto-uscita` | {{}} | {{}} | {{}} |

Verifiche mancanti (strumenti non eseguiti o input non letto): {{ELENCO_O_NESSUNA}}.

<!--
Una verifica mancante NON e' una verifica superata: se qui c'e' una riga, il gate e'
rosso e la riga `Gate:` qui sopra dice ROSSO. I due modi piu' probabili di trovarne una
su questo agente: `psql` non nel PATH (e allora `contenuti-vivi` non ha interrogato
niente, cioe' la Legge n°3 non e' stata verificata affatto) ed ESLint non installato
nella cartella della skill (e allora l'accessibilita' non l'ha guardata nessuno).
-->

Residuo di `code-maniac scan`: {{PULITO / ELENCO}}.
Esito di `node agenti/schema-forge/scripts/verify.mjs` sul progetto: {{VERDE/ROSSO/non
eseguito}} — la vetrina sta in piedi sulle policy di qualcun altro.
Esito di `/code-inquisition` sulla superficie che legge i dati: {{ELENCO_O_NON_ESEGUITO}}.

## 9. Cosa questo handoff NON dimostra

- **Non dimostra che le pagine siano quelle giuste.** Il gate legge la firma del
  contratto, non la sua verità. Un sito impeccabile delle pagine sbagliate passa dieci
  passi su dieci ed è comunque da buttare.
- **Non dimostra che quello che le pagine mostrano debba essere pubblico.** §4 è una
  dichiarazione con una firma accanto, non una misura. Il gate vede un dato in pagina;
  non sa se qualcuno voleva che ci fosse.
- **Non dimostra che il sito sia fatto bene.** Le pagine esistono, sono finite e leggono
  da dove dicono. Che siano chiare, utili e belle lo decide chi le guarda.
- **Non dimostra che i contenuti resteranno freschi.** Su una pagina generata
  staticamente, una modifica fatta dal cliente il giorno dopo non si vede finché
  qualcuno non ripubblica: la colonna `Aggiornamento` di §3 dice per quali pagine vale.
- **Non dimostra che il sito sia veloce, né che i flussi funzionino.** Il primo lo
  misura speed-demon su una build di produzione, il secondo lo prova flow-sentinel col
  browser. `tsc` verde vuol dire che i tipi tornano.
- **Non dimostra niente su come si vede.** Nessun passo ha aperto una finestra:
  telefono, viewport stretti, stampa, JavaScript disattivato, immagini che non arrivano.
- **Non dimostra che il sito regga il contenuto vero.** I numeri di §3 e §6 sono presi
  sul seed: {{QUANTE_RIGHE}}. Una lista che sta in piedi con dieci righe può diventare
  illeggibile con la lista vera.
