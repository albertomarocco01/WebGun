# Case di Langa — banco di collaudo avversario di Speed Demon

**Non e' un progetto cliente.** E' il banco che mancava: un sito su cui Speed
Demon abbia qualcosa da ottimizzare. Il collaudo del 2026-07-30 e' avvenuto su
`banco-prova-negozio`, che partiva da 100/100 su due pagine di testo senza
immagini — quindi `plan` e `tune` non sono mai stati messi alla prova su un
guadagno vero, ed e' il punto 1 di `agenti/speed-demon/STATO.md`.

Dominio scelto apposta diverso dagli altri banchi (e-commerce, veterinaria,
accademia musicale): un'agenzia immobiliare vive di fotografie grandi, che sono
la prima causa di lentezza dei siti veri.

## Deroghe allo stack standard, motivate

Il `CLAUDE.md` di Web Gun impone Next.js + TypeScript + Tailwind + **Supabase**,
e ammette deroghe se motivate per iscritto qui.

**Niente Supabase.** Il gate di Speed Demon non tocca il database: legge un
contratto, rilancia il gate di Flow Sentinel, interroga l'HTTP dell'app e lancia
Lighthouse. Aggiungere un database a questo banco significherebbe accendere
Docker, migrare, seminare e mantenere uno schema per non farne usare niente a
cio' che si sta collaudando. Il prezzo si paga dove serve: il passo `rete-verde`
— l'unico che dipenderebbe da una batteria E2E su dati veri — **non si collauda
qui**, si collauda su `banco-prova-negozio`, che quella catena ce l'ha gia'
intera e verde.

Conseguenza da sapere leggendo i risultati: su questo banco `rete-verde` e'
**MANCANTE**, non verde. Non e' un dettaglio che si perdona — e' il motivo per
cui un gate verde su questo banco non esiste e non e' mai stato cercato.

**Niente Playwright.** Stesso motivo: senza flussi critici da proteggere non c'e'
una rete da tendere, e una batteria finta darebbe un verde che non significa
niente.

## I difetti sono voluti, e sono documentati

Questo banco contiene difetti piantati apposta, ciascuno con la sua nota nel
file che lo ospita. Non vanno corretti senza aver prima letto il verbale
`agenti/speed-demon/COLLAUDO-2026-07-30.md`: sono le prove.

| Dove | Difetto piantato | Cosa deve misurare |
|---|---|---|
| `src/app/page.tsx` | fotografia da 6,2 MB in un `img` nudo, senza dimensioni | LCP e CLS veri, materiale per `plan` e `tune` |
| `src/components/CalcolatoreRata.tsx` | piano di ammortamento calcolato in modo sincrono durante l'idratazione | TBT vero |
| `src/app/immobili/page.tsx` | `canonical` che punta a `/` invece che a se stessa | se `seo-meta` verifica la verita' del canonical o solo la sua presenza |
| `src/app/agenzia/page.tsx` | nessun `title` nella testa, un `<title>` dentro un'icona SVG nel corpo | se `metatagDaHtml` distingue il titolo del documento da quello di un'immagine |
| `src/app/riservata/page.tsx` | rotta che rimanda a `/contatti` | se il gate accorge che sta misurando un'altra pagina (difesa prescritta in `references/misurazione.md` §256) |
| `docs/performance.md` | scritto **attenendosi al template** di Speed Demon | se il gate sa leggere il contratto che il suo template insegna a scrivere |

## Come si rialza

```bash
npm install
npm run foto          # rigenera public/foto/ (gitignorato, ~21 MB di rumore)
npm run build
npx next start -p 3200
```

Porta **3200**: la 3000 e' il portfolio personale della macchina, la 3001 e la
3100 sono di `banco-prova-negozio`. Un gate che indovina la porta misura l'app
di un altro, ed e' gia' successo in questa casa.
