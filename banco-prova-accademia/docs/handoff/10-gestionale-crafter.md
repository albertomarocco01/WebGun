# Handoff — Gestionale Crafter

> Progetto: **Accademia Rossini** (secondo banco di prova, dominio non e-commerce).
> Costruito il 2026-07-28 sopra `supabase/migrations/20260728150000_accademia.sql`.

## 1. Cosa ho fatto

- Radice del gestionale: `src/app/admin`
- Viste generate: `corsi`, `allievi`, `iscrizioni`, `contenuti`, `personale`
- Moduli di dominio: `src/modules/{corsi,allievi,iscrizioni,contenuti,personale,admin}`
- Porta d'ingresso: `src/app/accedi`
- Contenuti editabili dal cliente: `site_content`

## 2. Modello assunto

Una sede. Tre ruoli: **direttore** (tutto), **segreteria** (allievi, iscrizioni, contenuti),
**insegnante** (vede i propri corsi e i propri allievi, non scrive). Gli allievi non hanno
account: li registra la segreteria. Il ruolo si legge dalla tabella `staff`, che l'utente
non puo' riscrivere.

Confermato da: UMANO il 2026-07-28.

| Assunzione | Default | Conseguenza se e' sbagliata |
|---|---|---|
| una sola sede | nessun filtro d'ambito oltre alla RLS | con piu' sedi ogni query va riscritta con l'ambito dentro la condizione |
| l'insegnante non scrive niente | sola lettura sui propri corsi | se deve registrare le presenze servono policy nuove |

## 3. Entita' gestite ed entita' escluse

| Tabella | Vista | Chi puo' scrivere |
|---|---|---|
| `courses` | `corsi` | direttore |
| `students` | `allievi` | segreteria, direttore |
| `enrollments` | `iscrizioni` | segreteria, direttore |
| `site_content` | `contenuti` | segreteria, direttore |
| `staff` | `personale` | direttore (ruolo e stato solo via RPC) |

Escluse: nessuna — le cinque tabelle dello schema hanno tutte una vista.

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perche' |
|---|---|---|
| `insegna_il_corso()` in una funzione sola | due policy separate | due policy permissive si sommano in OR: l'insegnante vedrebbe i corsi di tutti |
| stato dell'iscrizione nella condizione dell'update | fidarsi del campo nascosto | il campo nascosto e' un dato del client: `ritirata` smetteva di essere terminale |
| `is_active` fuori dal `grant update` | lasciarlo fra i recapiti | e' l'interruttore che spegne una persona, non un recapito: chi era disattivato si riaccendeva da solo |

## 5. Cosa si aspetta chi viene dopo

- **Flow Sentinel**: accesso, creazione corso, iscrizione, avanzamento di stato, modifica contenuto, cambio ruolo. Utenti nel seed: `direzione@`, `segreteria@`, `violino@`, `piano@accademiarossini.it` (password `password123`).
- **Cyber Shield**: `src/modules/admin/guardia.ts`, le sei azioni server, e le funzioni `cambia_ruolo` / `cambia_stato_attivo`.
- Dal client **non** si fa: cambio di ruolo, attivazione/disattivazione, transizioni di stato illegali.

## 6. Richieste rimaste aperte verso schema-forge

| Cosa serve | Perche' | Stato |
|---|---|---|
| `is_active` fuori dal `grant update` + RPC di attivazione | l'interruttore di revoca era scrivibile dal suo stesso soggetto | **chiusa** (`20260728160000`) |
| policy dell'anagrafica ristretta a direzione e segreteria | l'insegnante leggeva `phone` e `auth_user_id` di tutti i colleghi | **chiusa** (`20260728160000`) |
| trigger di transizione su `enrollments` | la macchina a stati viveva solo nell'applicazione | **chiusa** (`20260728160000`) |

## 7. Residui del gate e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi) — rilanciato il 2026-07-28.

| Gravita' | Cosa | Perche' resta | Rientro previsto |
|---|---|---|---|
| Low | i messaggi d'errore di Postgres arrivano all'interfaccia (`throw new Error(error.message)`) | il tribunale non ha potuto stabilire se Next.js li rediga in produzione: serve una build vera | prima della consegna a un cliente |
| Info | `src/lib/supabase/client.ts` non ha consumatori | nessun componente `"use client"` in questo progetto | quando ne nascera' uno, si ricontrollano prima i grant per colonna |

Verifiche mancanti (strumenti non eseguiti): nessuna.

**Cosa il gate verde non dimostra**: `agenti/gestionale-crafter/SKILL.md` §Cosa un gate verde NON dimostra. Su questo banco e' stato misurato: sostituita la guardia della pagina del personale con una piu' debole, l'audit ha continuato a rispondere «nessun bloccante».
