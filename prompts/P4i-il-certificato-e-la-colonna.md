# P.4i — Il pilota prende il suo certificato, e il registro prende una colonna

You are a maintenance engineer for the **pilot project** `C:\Users\Utente\Desktop\fornodoro` (pizzeria «Forno d'Oro»), branch `master`. Model: **Opus 5 · effort high**. All deliverables are in **Italian** (this prompt is English; nothing else you write is).

Commit granularly — **one change, one commit** — with Italian narrative one-liners in the style of `git log --oneline -12`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the wording of a document, which of two adequate fixes, what mock content a page needs — you decide, you write it down, you keep going. **Never stop to ask.**

## Your write perimeter

```
C:\Users\Utente\Desktop\fornodoro\**      (sei l'unico proprietario in scrittura)
```

Plus **one** verbale in the regia: `C:\Users\Utente\Desktop\WebGun\agenti\site-doctor\PILOTA-CONFORMITA-2026-08-06.md`.

**Nothing else in the regia.** Not `CANTIERE.md`, not `DECISIONI.md`, not `prompts/`, not any skill's `scripts/` — three other chats are changing three skills right now, and a commit of yours in there would land in their history. When you commit inside the regia, use `git commit -F - -- <path>` with the pathspec, never a bare commit: the index is shared (decision **D19**).

**You own the Supabase stack.** It is up (api 7621, db 7622) and the app is alive on 3621. Nobody else starts one; you do not stop it. Only one stack fits on this machine.

**Nothing gets published.** No account, no domain, no DNS, no deploy — not even free, not even to test. `docs/deploy.md` stays **unsigned**: that signature is Alberto's in person and no one else's.

## La riga operativa che ti morde se la dimentichi

```
npx supabase db reset && npm run seed-sviluppo
```

Since P.4h, `db reset` alone no longer produces the development state — the dev seed left `sql_paths` behind four fail-closed guards. **The gate of schema-forge does a `db reset`**, so after running it the database has zero accounts and the E2E battery coins no session. Two commands in a row, not one. (The direction verified all of this today: after the gate, `auth.users=0`; a hand-run `psql -f` on the dev seed is refused with `P0001` and writes nothing; `npm run seed-sviluppo` restores `auth.users=2 · personale=2 · ordini=5 · righe_ordine=8 · voci_menu=11`.)

---

## 1. Il certificato di conformità — il pezzo grosso di questo pacchetto

The pilot has never had one. Run the **site-doctor** skill on it, for the first time, end to end: `perimetro` → `scansiona` → `certifica` → `handoff`. The skill is installed as a junction; the gate is `node <skill>/scripts/verify.mjs --url http://127.0.0.1:3621`.

Today, at regia `d147f52`, that gate says **ROSSO — 4 falliti, 3 mancanti su 9**, and every one of the four is a true thing about this site:

```
FAIL  informativa privacy raggiungibile
        nessun collegamento a un'informativa su 5 pagine
FAIL  dati raccolti dai moduli pubblici
        /ordina → "nome": dato personale (autocomplete="name"), nessuna base giuridica dichiarata
        /ordina → "telefono": dato personale (autocomplete="tel"), nessuna base giuridica dichiarata
        /ordina: raccoglie dati personali e non rimanda a nessuna informativa
FAIL  cosa il sito archivia nel browser
        localStorage in /ordina, e nessuna riga del certificato lo nomina
FAIL  contratto d'uscita (handoff)
MANC  certificato · lingua dichiarata · proprietà delle voci
```

Produce `docs/conformita.md` and close what can honestly be closed:

- **The privacy notice.** The skill generates a **draft** from a template (`informativa-bozza.md`). Its own collaudo judged that draft: *«adatta come scheletro da far riempire, non come informativa»*. Take it at its word. Write the page, link it from every page that collects anything, fill it with what is **true of this site** (which fields, why, where they go, that the database is local and the site is not published), and mark it, in the document and in the register, as **una bozza che vuole una revisione umana prima della pubblicazione**. Do not write, anywhere, that the pilot is GDPR-compliant. It is a pizzeria that has never been online, and the value here is that the chain produces the document at all.
- **The legal basis** for `nome` and `telefono` on `/ordina`: it is the execution of an order the person is asking for. Write it in the certificate in the form the gate reads.
- **`localStorage` on `/ordina`**: declare it — key, purpose, and whether it is essenziale. Be honest about the last one: the gate cannot contradict you, and that is exactly why a false answer there is worse than a red.
- **Lingua**: the site is monolingual Italian. Declare it so the step has something to compare against.

The site-doctor skill is **being changed next door this same wave** (it is taking over favicon, Open Graph, JSON-LD, `sitemap.xml` and `robots.txt` — decision D21). So: **cite the regia commit next to every run** (D18 §3), and if a rerun goes red on a step that was green an hour earlier, that is the system working — report it, do not hide it, and do not chase it. Your target is a certificate that is *true*, not a nine-out-of-nine.

## 2. Il registro prende una colonna — decisione D23 §2

`docs/DEBITO-TECNICO.md` has ~50 entries and the gate of launchpad reads which of them block the deploy **by recognising prose**. The launchpad collaudo bypassed two of those prose forms and added two more, and wrote the sentence that decided it: *l'elenco delle forme che il gate riconosce è aperto per costruzione*.

Migrate every entry to a fixed-form line:

```
Blocca il deploy: sì
```

`sì` or `no`, one line per entry, nothing else on it. Where the prose was ambiguous, decide, and say in the commit which way and why — **an entry whose prose you cannot resolve gets `sì`**: on this axis, guessing safe costs a red and guessing convenient costs a publication.

The launchpad gate that reads the new line is being written next door in this same wave. There will be a window where one of you sees a red the other has not shipped yet. That is D18 §3 again: cite the commit, report the red, keep going.

## 3. n°27 — la decisione, e il momento che conta

Decision **D24**. P.4h proposed *«la prima strada finché il repository resta in casa, la terza prima del giorno in cui esce»*, and the direction accepts it with a sharper trigger.

`password123` is in `supabase/seed/90-solo-sviluppo.sql`, tracked, and in **five points of the history**. P.4h made it unreachable by any documented command against a remote database — measured, and the direction re-measured it today. What it did not do, and could not, is remove it from what a clone carries.

**The trigger is not «before the repo leaves». It is the first `git push` to any remote** — because that is the instant at which the history stops being rewritable. Today `master` has no remote configured (the launchpad gate prints it). Write in the register, at n°27, in this form:

- what is closed, with the measure that proves it;
- what is not: the credential is in HEAD and in five commits, and every clone carries it;
- the trigger: **prima del primo `git push` verso un qualunque remoto**, the history gets rewritten — and until then the launchpad block is correct and must not be «resolved» by narrowing the window of history the gate reads.

Put the same three lines in `docs/deploy.md` as a precondition of publication. Do not sign it.

**M2 travels with it.** The launchpad gate blocks today on `docs/handoff/08-vetrina-crafter.md @ fff715b` — a handoff **committed today** that carries `postgresql://postgres:postgres@127.0.0.1:7622/postgres`, password and all. Mask it in HEAD (the neighbouring chats are making the gates stop writing such lines), and record that the copy in the history goes with n°27's rewrite. It is MEDIUM only while that password is `postgres` on loopback.

## 4. I certificati, e l'errore da non ripetere

Today the launchpad gate says:

```
FAIL  verdetti dichiarati dagli agenti a monte
      [block] 07 · 08 · 12 · 13 · 14: piu' vecchio del codice che certifica
      [block] 10: dichiara `Gate: ROSSO`
```

Five of six are stale **again**, and the cause is instructive: P.4h redated them, and *then* committed a code fix (`0a48fba`). The certificates were true for about two hours.

So the rule, and it is now a rule: **ridatare i certificati è l'ultimo atto del pacchetto.** Rerun the five gates after your last code commit, not before, and rewrite the `Gate:` lines then. Paste each output in full into the handoff it belongs to, with the regia commit next to it.

Two things you must not fix:

- **`10-gestionale-crafter.md` stays `Gate: ROSSO`.** The reason is `n°50`: the gate reads `tsconfig.json` as JSONC and its comment-stripper does not skip strings, so `"@/*"` opens a comment that closes inside `"**/*.ts"` and seventy characters of valid JSON disappear. The direction reproduced it today. **There is no honest fix on the pilot side** — do not touch `tsconfig.json` to please a broken parser. Another chat is fixing the gate this wave; if their fix lands before your last rerun, you will see it go green, and then you redate. If it does not, the handoff says ROSSO and says whose it is.
- **`docs/deploy.md` stays unsigned**, and the launchpad gate's `runbook-firmato` stays red. That red is Alberto's to clear.

## 5. Il vincolo che batte tutti gli altri

**E2E 22/22.** Whatever you change — the privacy page, the links from every page, the register, the seed — the flow-sentinel gate must come out **VERDE 7/7** with 22 passed, 0 failed, and its step must keep printing **13 flussi critici su 13 percorsi davvero dal browser**. If a new page or a new link breaks a selector, you fix the spec *and* say in the commit what changed in the app that made it necessary.

---

## Come chiudi

1. The five chain gates rerun **after your last code commit**, from the project root, by absolute path, each with the regia commit cited: schema-forge, vetrina-crafter, gestionale-crafter, flow-sentinel, speed-demon. Today's baseline at `d147f52`, measured by the direction: **9/9 · 10/10 · ROSSO (n°50) · 7/7 con 22 test · 7/7**. Remember `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` before speed-demon — Lighthouse via `npx` inherits the node of the **PATH** (v20.12.2 here), not the interpreter that launched the gate.
2. Site-doctor's gate rerun, with its own output pasted, and `docs/handoff/16-site-doctor.md` written.
3. Launchpad's gate rerun (`--url http://127.0.0.1:3621`), and for **every** surviving refusal, one line saying **whose it is**. Today: 4 falliti — `verdetti` (yours), `segreti` (the direction's, n°27), `runbook-firmato` (Alberto's), `contratto-uscita` (launchpad's own handoff, which does not exist until a publication does).
4. `docs/handoff/17-p4i-certificato-e-registro.md`: what you did, what you decided and why, what the next agent gets, what is left. With a `Gate:` line — a transversal handoff certifies *that the gates this package could have turned red did not*, and it must name them and paste them.
5. The verbale in the regia, committed with a pathspec.
6. Machine state at the end, written down: stack up, app alive on 3621 serving the build id you last built, database in the full development state, ports you opened and closed.

**Do not weaken a rule, a spec or a threshold to make something green.** If a gate turns red on correct work, that is a finding — write which, and whose.
