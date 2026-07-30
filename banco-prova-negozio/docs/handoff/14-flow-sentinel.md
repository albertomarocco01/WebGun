# Handoff — Flow Sentinel (secondo passaggio)

> Progetto: **Bottega Nord**. Data: 2026-07-30, poche ore dopo l'handoff 12.
> Rilancio della batteria sopra le correzioni di `13-gestionale-crafter.md`, con
> un flusso in piu' e due difetti trovati che non c'entrano niente con quelle
> correzioni.
>
> Leggere prima: `12-flow-sentinel.md`, `13-gestionale-crafter.md`.

## 1. Cosa ho fatto

- **Flusso nuovo: `modifica-cliente`** (positivo), con la sua spec. Nasce
  insieme alla vista che lo rende percorribile: `aggiornaCliente` era orfana e
  ora ha una porta, e una scrittura su dati di persone senza spec e' esattamente
  il buco che questa batteria esiste per non lasciare. **Undici flussi**, non
  piu' dieci.
- **Riscritta la seconda spec di `sezioni-di-ruolo-negate-al-magazziniere`.**
  Fissava il menu non filtrato come comportamento corrente, e aveva scritto per
  iscritto: *«il giorno in cui il menu verra' filtrato, questo test diventa
  rosso: e' il segnale che il difetto e' stato chiuso e che la spec va
  aggiornata»*. E' andata cosi'. Ora asserisce le quattro voci che il
  magazziniere deve vedere, l'assenza delle due negate, **e** il rifiuto vero
  raggiunto scrivendo l'indirizzo — perche' il link tolto non e' una difesa.
- **`accesso-staff` asserisce anche `auth.identities`**, il residuo §3.1
  dell'handoff 12: un residuo chiuso senza asserzione torna al primo `db reset`.
- **Helper nuovi** in `e2e/helpers/db.ts`: `clientePerId`,
  `forzaTelefonoCliente`, `identitaDi`, e `SEED.clienteSenzaAccount`.

**Comando unico per rilanciare** (l'app dev deve essere accesa):

```
E2E_BASE_URL=http://127.0.0.1:3001 npx playwright test
```

## 2. Esito

**Batteria: 16 test su 16 verdi**, zero al secondo tentativo, zero flaky.
**Gate: VERDE 7/7** — 11 flussi (6 positivi · 3 ostili in lettura · 2 ostili in
scrittura), 11 file di spec, 8 flussi con asserzione sul database.

```
node ../agenti/flow-sentinel/scripts/verify.mjs --url http://127.0.0.1:3001
```

## 3. Il difetto che conta, e non e' del codice di nessuno

### 3.1 `service_role` ha perso i permessi mentre nessuno guardava — corretto

Al primo rilancio: **nove test rossi**, tutti con lo stesso messaggio.

```
Error: ruoloDi(11111111-...-111111111002): permission denied for table staff

$ curl .../rest/v1/staff?select=ruolo -H "apikey: sb_secret_..."
403 {"code":"42501","message":"permission denied for table staff",
     "hint":"Grant the required privileges to the current role with:
             GRANT SELECT ON public.staff TO service_role;"}
```

Nel progetto non era cambiata **una riga di applicazione**. Era cambiato
l'ambiente sotto: la CLI Supabase e' passata da **2.95.4 a 2.110.0**, e con lei
i privilegi di default.

```sql
select defaclacl from pg_default_acl;   -- proprietario `postgres`
PRIMA:  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
         service_role=arwdDxtm}
ADESSO: {postgres=arwdDxtm, anon=Dxtm, authenticated=Dxtm, service_role=Dxtm}
```

`Dxtm` e' TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: niente `select`, `insert`,
`update`, `delete`.

**Perche' `anon` e `authenticated` sono sopravvissuti e `service_role` no.**
`20260728120400_permessi_espliciti.sql` aveva imparato meta' lezione: su Supabase
i `grant` erano no-op perche' il default concedeva gia' tutto, quindi cio' che
contava era il `revoke`, e la migrazione aveva scritto «prima togli ai **due
ruoli del client**, poi riconcedi cio' che serve». Riconcedendo uno per uno,
`anon` e `authenticated` hanno permessi **scritti**. `service_role` non e' un
ruolo del client, non compariva in quella migrazione, e aveva tutto per grazia
del default. Cambiato il default, non gli e' rimasto niente.

Corretto con `supabase/migrations/20260730120000_permessi_service_role.sql`, che
li scrive. **Nessun `alter default privileges`**: rimetterlo restaurerebbe la
magia implicita che ha appena smesso di funzionare. Una tabella nuova nascera'
senza permessi per `service_role`, la batteria diventera' rossa e qualcuno
scrivera' la riga — rumoroso, ed e' il modo giusto.

**Chi poteva vederlo.** Nessuno degli altri gate: non c'e' niente di sbagliato
nel codice ne' nello schema, e infatti `schema-forge` e `gestionale-crafter`
chiudono verdi anche adesso. Lo vede solo chi **usa** la chiave, e in questa
pipeline la usa un solo strumento: le asserzioni di effetto della batteria. E'
la stessa forma del difetto del seed di due ore prima — l'ambiente e' vero solo
per chi ci entra dentro.

Vale la pena scriverlo perche' e' la classe piu' insidiosa: **un progetto fermo
si rompe da solo.** Nessun commit, nessuna modifica, nessun avviso.

## 4. Il difetto trovato dentro la batteria, mentre la si estendeva

**`identitaDi` accusava il seed di un buco che non c'era.** L'asserzione nuova
su `auth.identities` era rossa con `Received: 0` mentre il database aveva
quattro righe:

```
select count(*) from auth.identities;              → 4
GET /auth/v1/admin/users?page=1                    → identities = 0
GET /auth/v1/admin/users/<id>                      → identities = 1
```

`listUsers` **non idrata `identities`**: le carica solo `getUserById`. La
diagnosi puntava sul seed, che era corretto. Chiuso con due chiamate — lista per
trovare l'id, poi la scheda piena — e il perche' scritto sopra la funzione.

E' il secondo giro di seguito in cui la batteria produce un rosso che punta
nella direzione sbagliata (il primo fu `storageState` vuoto, handoff 12 §4.1).
Sono i piu' cari: un rosso che accusa l'innocente si chiude «sistemando»
l'innocente.

## 5. Cosa risulta chiuso dei difetti dell'handoff 12

| Difetto | Stato |
|---|---|
| §3.1 seed senza `auth.identities` | **chiuso** e asserito in `accesso-staff` |
| §3.2 menu che promette e nega, rifiuto muto | **chiuso**, asserito in entrambe le meta' |
| §3.3 nessun `error.tsx` | **chiuso** — ma nessun clic ci arriva, vedi §6 |
| §3.4 campi nascosti creduti sulla parola | **ridotto**: `sku`/`size` non viaggiano piu', le righe toccate si contano. L'`id` resta creduto |
| §3.5 due azioni orfane | **chiuse**: una collegata con spec, una tolta |
| §4.2 `ultimoAccesso` riporta l'errore come `{}` | **chiuso** |

## 6. Cosa si aspetta chi viene dopo

- **Speed Demon**: rete tesa, 16 test. Rilancia il comando della §1 dopo ogni
  modifica; il gate va rilanciato con `--url`, non a mano.
- **Cyber Shield**: comincia da §3.4 dell'handoff 12 nella sua forma ridotta —
  l'`id` nascosto su sei scritture. E dalla §3.1 qui sopra letta al contrario:
  se un ambiente puo' *togliere* permessi da solo, puo' anche restituirne.
- **Launchpad**: non pubblicare su gate rosso, e non prima di aver verificato
  che i permessi di `service_role` siano scritti anche nel progetto di
  destinazione.

## 7. Residui del gate e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi).

| Gravita' | Cosa | Perche' resta |
|---|---|---|
| nota | `[auth].site_url` dichiara la **3000**, l'app gira sulla **3001** | su questa macchina la 3000 e' di un altro progetto. Il gate va lanciato con `--url`; da P3 e' la batteria a diventare rossa se l'app e' quella sbagliata |
| nota | `error.tsx` esiste, nessun clic ci arriva | provocare un errore richiede di forgiare una richiesta. La pagina c'e', il flusso per raggiungerla no |
| nota | l'elenco dei flussi l'ha confermato l'**orchestratore** | modalita' pipeline: nessun flusso muove denaro, manda comunicazioni o cancella dati di produzione |
| nota | 6 strumenti di `code-maniac` non installati | **MANCANTI**, non `PASS`. Elenco in `docs/DEBITO-TECNICO.md` |

Verifiche mancanti dentro il gate dei flussi: nessuna.

**Cosa un gate verde NON dimostra**: `agenti/flow-sentinel/SKILL.md` §Cosa un
gate verde NON prova. Aggiunta di oggi, misurata: non dimostra che domani sara'
ancora verde **a parita' di codice**. L'ambiente e' un ingresso come gli altri, e
nessuno lo versiona.
