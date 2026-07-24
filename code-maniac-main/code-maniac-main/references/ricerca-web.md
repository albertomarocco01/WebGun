# Ricerca Web — tecnologie moderne e ottimali

Il knowledge cutoff invecchia. Quando una scelta dipende da *cosa è corretto oggi* — una libreria, un tool, un pattern, un advisory di sicurezza — Code Maniac **verifica sul web** invece di indovinare dal ricordo. Nativo: `WebSearch` + `WebFetch`, dentro un subagent read-only.

> **Sempre considerata, eseguita con giudizio.** La ricerca web è un *checkpoint fisso* del flusso (ogni fase si chiede "serve verificare?"), ma **parte solo quando cambia una decisione**. "Sempre una ricerca" non significa tassare ogni fix banale con 5 ricerche — significa non dimenticarsi mai di verificare ciò che può essere obsoleto.

---

## Quando ricercare / quando NO (il gate, YAGNI applicato alla ricerca)

```
RICERCA SE (basta uno):
  • scegli un tool/dipendenza/framework da AGGIUNGERE (è corrente? manutenuto? esiste uno standard?)
  • il dominio è a movimento rapido (auth, crypto, modelli AI, librerie giovani, regole di sicurezza)
  • stai per pesare sicurezza/perf e servono advisory/versioni correnti
  • il knowledge cutoff è plausibilmente stale per QUESTA scelta

NON RICERCARE SE (basta uno):
  • la risposta è nota, stabile, evergreen (sintassi del linguaggio, GoF, SQL base)
  • è un fix banale / un dominio che non cambia
  • la decisione non dipende dalla recency

Regola: la ricerca costa token → si fa solo quando cambia una decisione.
```

---

## Dove si aggancia (4 punti, leggeri)

1. **`init`** — un controllo di *attualità* sullo stack rilevato ("versione/approccio corrente?"). Saltabile.
2. **Prima di aggiungere una dipendenza/tool** — attualità + manutenzione + esiste un'alternativa standard?
3. **Scelta di pattern/algoritmo** in domini veloci (auth, crypto, perf) — verifica contro la pratica corrente.
4. **Costituzione, sicurezza/perf** — quando la priorità 2 (sicurezza) o 7 (perf) è in gioco: advisory/CVE correnti.

Stesso motore per il comando `research` (esplicito) e per questi anchor (automatico).

---

## Disciplina token (come NON sprecare)

- **Gira in un subagent read-only** (Ricercatore-tech, vedi `orchestrazione-agenti.md` §6), **non nel thread principale**. Il subagent ritorna una **sintesi strutturata**, mai pagine grezze.
- Formato di ritorno (caveman tra macchine, chiaro per l'umano che decide):
  `VERDETTO: <X attuale / deprecato / sostituito da Y> · FONTI: <url,url> · RECENCY: <data> · RISCHIO: <gap>`
- **Tetto di default:** ≤3 ricerche + ≤2 fetch per domanda; si sale solo se la decisione è ancora bloccata.
- **Cache, non ri-ricerca:** ogni finding va in `docs/RICERCA.md` (registro) e, se graphify è attivo, come nodo nel grafo (`graphify save-result`). La prossima sessione lo riusa invece di ricercare di nuovo.

---

## Guardrail sulle fonti

- **Cita ogni affermazione con un URL.** Priorità: doc ufficiale > blog del manutentore > secondario reputato.
- **Filtro recency:** per domini veloci, fonti ≤ ~12 mesi; segnala ciò che è stale.
- **Fonti in conflitto → riporta il conflitto**, non scegliere in silenzio (come `pattern`: segnala, non decidere d'imperio).

---

## Mai far marcire il documento

I finding del web sono **time-sensitive**: vivono in `docs/RICERCA.md` (spazio utente), **mai** dentro i file `references/` versionati. Un reference che incorpora "la libreria X è la migliore nel 2025" marcisce. Il metodo sta nei reference; i fatti con scadenza stanno nel registro.

---

## Degradazione (offline / niente WebSearch)

`research` riporta: *"ricerca web non disponibile — decido sul knowledge cutoff e MARCO l'assunzione in `docs/RICERCA.md` come da verificare."* La skill resta pienamente funzionante offline; l'assunzione è tracciata come debito, non nascosta. Stessa filosofia di degradazione di graphify/ponytail/caveman (`skill-esterne.md`).

---

## Il registro: `docs/RICERCA.md`

Seminato a `init` dal template `resources/templates/RICERCA.md`. Una riga per finding: domanda · verdetto · fonti (URL) · recency · rischio · stato (confermato / da-verificare). È il peer di `DEBITO-TECNICO.md`, ma con semantica di *scadenza* (i fatti invecchiano), non di *scorciatoia*.
