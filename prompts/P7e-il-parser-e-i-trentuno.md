# P.7e — Il parser che non guarda dove si trova, e i trentuno che restano

You are a maintenance engineer for the Web Gun regia repo, `C:\Users\Utente\Desktop\WebGun`, branch `main`. Model: **Opus 5 · effort high**. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is).

Commit granularly — **one defect, one commit** — with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the shape of a fixture, which of two adequate fixes to apply, how to build a probe — you decide, you write it down, you keep going. **Never stop to ask.**

## How you commit, and why it is different this time

Three other chats are running **in this same folder, on this same branch, sharing the same git index**. On 2026-08-06 that cost the yard a commit: `ab978cd` — whose message speaks only of site-doctor's delegations — carries two of launchpad's files, because launchpad's chat had staged them 52 seconds earlier and the other chat's bare `git commit` swept the whole index. Nothing was lost, but `git log -- agenti/launchpad/scripts/gate-lib.mjs` now answers with a message about a favicon.

`git add` by name protects you from files another chat has **modified**. It does not protect you from files another chat has **staged**. So:

```
git commit -F - -- <i tuoi percorsi>
```

**Always with `-- <paths>`.** A pathspec-limited commit ignores the index entirely and takes the working-tree content of exactly those paths. Never a bare `git commit`, never `-A`, never `-a`. This is decision **D19** of `CANTIERE.md`; you are one of the four chats it exists for.

If `index.lock` is busy, wait — never delete it.

## Your write perimeter

```
agenti/schema-forge/**
agenti/gestionale-crafter/**
agenti/flow-sentinel/**
agenti/speed-demon/**
```

excluding each skill's `prompts/`. You **may** touch their `SKILL.md` this time, where a fix changes a declared contract — P.7d could not, and two of its fixes left the contract behind.

Plus your verbale: `PROCESSO-GATE-2-2026-08-06.md` in the repo root.

**Outside your perimeter, and not yours for any reason:** `CANTIERE.md`, `DECISIONI.md`, `prompts/`, `agenti/launchpad/**`, `agenti/site-doctor/**`, `agenti/code-maniac/**`, `agenti/code-inquisition/**`, `agenti/bugbay/**`, the `banco-prova-*` folders, `Web Gun.docx`, and **the pilot repo `C:\Users\Utente\Desktop\fornodoro` — you do not open it in write mode, you do not run its gates, you do not touch its Supabase stack.** Another chat owns it this wave. No Docker. No stack.

---

## 1. n°50 — start here, and it is not in the referto

The direction reproduced this today, from the pilot's root, against the regia at `d147f52`:

```
GATE GESTIONALE: ROSSO (0 falliti, 1 verifiche mancanti su 7 passi)
MANC  tipi del progetto (tsc)
        tsconfig.json non interpretabile (Expected ':' after property name in JSON at position 472):
        non si sa con quali controlli `tsc` abbia misurato
```

The pilot's `tsconfig.json` is **655 bytes of valid JSON** — `JSON.parse` on the raw file succeeds. What fails is your own stripper, `agenti/gestionale-crafter/scripts/progetto-lib.mjs:137`:

```js
config = JSON.parse(String(testoTsconfig ?? "")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "));
```

`"@/*"` — the path alias that `create-next-app` writes into **every** Next project — contains `/*`. The regex reads it as a comment opening and runs to the first `*/`, which lives inside `"**/*.ts"` in `include`. Seventy characters of valid JSON vanish; the reported error position matches to the character.

**Measure the blast radius and write it in the verbale.** The step is `MANCANTE` — never `pass`, so nothing false ever went green — but the gate of `gestionale-crafter` is **red on every project this house generates**, because the alias is in the default scaffold. It arrived with P.7d's H8 fix, i.e. while closing the tribunal's fourteen.

**The fix is not "handle strings too".** Read the comment that sits above the code: it says JSONC tolerance is there because *«`create-next-app` non ne mette ma altri strumenti sì»*. A tolerance added for a case that does not occur broke the case that always occurs. So:

1. `JSON.parse` the **raw text first**. A valid `tsconfig.json` needs no stripping at all, and that is the overwhelming majority.
2. Only if that throws, strip comments — with a scanner that tracks whether it is **inside a string** (and inside an escape), not a regex. Then parse again.
3. If that also throws, then and only then `MANCANTE`, with the message it has today.

Tests, in the real input shape: the pilot's actual `tsconfig.json` verbatim as a fixture; a genuine JSONC file with a block comment **and** a `/*` inside a string in the same file; a `//` inside a string value (`"note": "a // b"` — the second regex has the same blindness, guarded only against `://`); a truncated file. **Reproduce the red before you fix it**, using the pilot's file content copied into a scratch dir — not by opening the pilot.

## 2. The shape behind n°50, and the audit it earns

n°50 is the **third instance in two days of one defect**:

| quando | dove | il delimitatore | dentro cosa si nascondeva |
|---|---|---|---|
| tribunale, 2026-08-05 | site-doctor | `<!--` | dentro un **attributo** |
| collaudo P.6-P2, 2026-08-06 | site-doctor | `</script>` letto come apertura | dentro un **tag** |
| P.4h, 2026-08-06 | gestionale-crafter | `/*` | dentro una **stringa** |

**Un parser scritto a mano che non rispetta il contesto che lo racchiude.** Three different skills, three different chats, three different weeks of code — and every battery green each time, because every fixture was modelled on the implementation instead of on the real input.

So, inside your four skills: find every place that scans a structured text with a regex — SQL, JSON, HTML, TOML, markdown, `.env`, git porcelain — and for each one, add **one hostile test where the delimiter appears inside a string, a comment, or an attribute**. Where the test goes red, fix it. Where it stays green, say so in the verbale with the file and the line: a scanner proven immune is worth as much as one repaired, and it is the only way this audit ends instead of repeating.

Where a real parser exists in the house's dependencies, prefer it to a regex, and say in the commit why you did or could not.

## 3. Il contrasto, e la lezione che vale più del contrasto

Decision **D21** of `CANTIERE.md`, measured by the direction today: of the nine conformity voices that site-doctor delegates to neighbours, **seven are empty**. Two land on you.

**`contrasti` is yours**, because speed-demon is the only gate in the house that opens a browser. Today `contrast` appears in **zero files** of `agenti/speed-demon/` — the gate reads `report.categories.accessibility.score` and never opens the individual audit. A site with insufficient contrast loses a couple of points out of a hundred and passes any reasonable threshold.

Fix: read `report.audits["color-contrast"]` explicitly, and let the step fail on that audit's own verdict, not on the category. Prove it with a Lighthouse JSON report where the category score is above threshold **and** `color-contrast` has failing items — that is the whole point, and a fixture where both fail proves nothing.

And then the general rule, which is worth more than the fix: **la soglia di una categoria non è la misura di un audit.** Audit all four of your gates for that shape — any step that concludes something about X by reading a score, a count, or a category that merely *contains* X. List them in the verbale with file and line, fix the ones where the delegation is provably weaker than the claim, and declare the ones where it is adequate.

`robots.txt`, `favicon`, Open Graph, JSON-LD and `sitemap.xml` are **not** yours — D21 assigns them to site-doctor, which already walks every page. Do not add them. If a comment or a document of yours claims you cover them, correct the claim.

## 4. M2, promosso in testa

P.7d put it out of the severity order and was right, and the direction has independent proof it is live: running launchpad's gate on the pilot today printed, among the four blocks that stop publication,

```
[block] docs/handoff/08-vetrina-crafter.md @ fff715b (2026-08-06):
        password dentro l'autorita' di un URL — password nell'URL `postgresql://…:…@….0.1`
```

A handoff **committed today** carries a database URL with its password, and that block is now part of what keeps the pilot from being publishable. It is MEDIUM only while the password is `postgres:postgres` on loopback; the referto records that it turns HIGH the first day a `--db-url` points at a non-local database, and the gates accept that without objection.

The masking already exists in-house at `vetrina-crafter/verify.mjs:378`. Carry it to every point where a gate of yours prints a connection URL into a handoff, a detail line, or a JSON output. The pilot's already-committed handoffs are **not** yours to edit — another chat owns that repo; your job is that no gate writes such a line again.

## 5. I trentuno

Take P.7d's proposed order from `PROCESSO-GATE-2026-08-06.md` §Proposte — four blocks, most-severe first. It is a good order and you should follow it, but it is a proposal and not a contract: if while working you find that one of them is graver or cheaper than it was judged, move it and **write why in the commit**.

Two of them come with a warning from the direction:

- **M5 (ReDoS on `IMPORT_HELPER_DB`, 4000 chars → 19.5 s)** is now a gate that stops with a message rather than a false green, because P.7d gave it a limit. Do not let that lower it out of the package: a gate that takes twenty seconds per flow on hostile input is a gate someone will run with a shorter timeout.
- **L8 (`righeDaPsql` back on default delimiters)** — the referto calls it harmless today and dangerous at first reuse. P.7d proposed neutralising the separators in SQL and did **not** apply it, because proving it wants a live Postgres and applying it blind would silence a fault that is currently noisy. That reasoning still stands and you have no stack either: **declare it MANCANTE with its reason**, do not apply it unproven.

The `translate` on the eleven RLS-audit free-text queries (§H5, "renderebbe impossibile la collisione invece che rumorosa") is in the same position — it wants a live bench. Declare it.

## 6. Il banco vivo — cosa è già chiuso, e da chi

P.7d's MANCANTE n°1 was: *the four gates were never rerun against a living project.* **The direction closed most of it today**, at regia `d147f52`, against the real pilot — live app on 3621, live Supabase, real database:

| gate | esito misurato dalla direzione, 2026-08-06 sera |
|---|---|
| schema-forge | **VERDE 9/9** — 7 migrazioni applicate su database pulito, pgTAP su 5 file |
| gestionale-crafter | **ROSSO** 0 falliti + 1 mancante — ed è **n°50**, cioè §1 di questo mandato |
| flow-sentinel | **VERDE 7/7** — 22 test, e il passo stampa **13 flussi critici su 13 percorsi davvero dal browser**, coi nomi: C2 chiuso, provato su un progetto vero |
| speed-demon | **VERDE 7/7** — 3 giri, `performance 99-100 · accessibility 100±0 · best-practices 100±0 · seo 100±0` su cinque pagine |

So: C1 and C2 hold on a real project, and the one red is a defect of the gate that you are about to fix. **You do not rerun these yourself** — the pilot belongs to another chat this wave. The closing rerun after your fixes is the direction's, at your return. Say that in the verbale as a declared MANCANTE with the name of who owns it; do not write it as if it were yours to do.

## 7. Come chiudi

1. Four batteries above **186 · 173 · 131 · 103** (measured by the direction today at `d147f52`; they are your floor, not your target). Note: those four `package.json` declare their tests with a **glob**, which needs Node 21+ — the PATH node on this machine is v20.12.2 and prints nothing at all. Run them with `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` (v24.18.1). Under Node 24 the reporter prints `ℹ tests N`, not `# tests N`: if your grep sees nothing, it is the reporter, not an empty battery.
2. Guardians on the changed code: ESLint, knip, jscpd, semgrep, gitleaks — each with its count, and every residue motivated next to its line.
3. `node scripts/verifica-regia.mjs` from the regia root: **VERDE 5/5**.
4. `code-maniac scan` and `/code-inquisition --scope diff` on the changed code where they are available; where they are not, **MANCANTE with its name**, never silence.
5. The verbale `PROCESSO-GATE-2-2026-08-06.md`: every defect with the output pasted **before and after**, the blast radius of n°50 in plain numbers, the full list of the hand-rolled scanners you audited (repaired and proven-immune alike), the category-delegation audit, and a section «Cosa resta MANCANTE, col suo nome».
6. The four `STATO.md` updated: what is closed, what remains, and what changed owner.

Do not weaken a rule to make a test pass. If a fix makes a correct project red, that is a finding about the project or about the rule — write which, in the commit message, and name it.
