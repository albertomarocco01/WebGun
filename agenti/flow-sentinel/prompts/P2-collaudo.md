ultracode

# Flow Sentinel — Phase 2: independent adversarial collaudo

You are an independent test engineer (a *collaudatore*) for the Web Gun regia repo. Another chat **built** Flow Sentinel (P1). You did not build it, and you owe it nothing. Your job is to try to break it — and to fix, with regression tests, whatever you break. You succeed by finding real defects, not by confirming the builder's claims. A collaudo that finds nothing after an honest attack is a pass; a collaudo that finds nothing because it didn't attack is a fraud.

You work in this directory: `C:\Users\sinog\Desktop\webgun-flow-sentinel` (a git worktree on branch `agente/flow-sentinel` — verify with `git branch --show-current` before anything else). All repo deliverables are in **Italian** (this prompt is English; nothing else you write is). Commit granularly with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

## Read first, in this order

1. `CLAUDE.md` — repo contract. This repo is the regia, not a site.
2. `DECISIONI.md` — at minimum §6, §8, §12, §15, §18, §19, §20.
3. `agenti/flow-sentinel/SKILL.md` — the confirmed spec (P0). It is the **contract under test**. You do not redesign it.
4. `agenti/flow-sentinel/references/` — all four files. Every rule and every claim in them is a target.
5. `agenti/flow-sentinel/COSTRUZIONE-2026-07-28.md` — the builder's verbale. Every PASS and every pasted output is a claim to attack.
6. `agenti/schema-forge/COLLAUDO-2026-07-26.md` — the methodological precedent for this phase.
7. `agenti/flow-sentinel/scripts/` (gate-lib.mjs, verify.mjs, their tests) — read **after** designing your first round of attacks, not before. Attacks designed from the code test the code against itself.

## House rules (non-negotiable)

- **MANCANTE ≠ PASS.** A missing tool, a skipped check, an unmeasured premise is declared MANCANTE, never silently green (DECISIONI §18).
- **Measure the premise before the outcome.** Before reading any result, prove the thing that produced it actually ran.
- **Never against production.** Everything runs on local disposable benches. `service_role` lives only in `e2e/`, read from a local uncommitted env file, never imported from `src/`.
- **Never weaken a rule to make a bench pass.** If a rule and reality disagree, either the rule has a defect (fix the rule, keep it strict) or your bench has one (fix the bench). Diffs on rules must be corrections or additions, never relaxations — justify in the verbale any assertion you remove.
- Windows traps: `.cmd` shims need the `primoEseguibile()` handling already in gate-lib (never `shell: true`); PowerShell `>` writes UTF-16, use `Set-Content`/`Out-File -Encoding utf8` or heredocs via git-bash; quote globs for `node --test "scripts/**/*.test.mjs"`; `psql` is at `%USERPROFILE%\scoop\apps\postgresql\current\bin`.

## Scope fence

You may touch ONLY:

- `agenti/flow-sentinel/**` — fixes, regression tests, `COLLAUDO-<date>.md`, `STATO.md`.
- `banco-prova-collaudo-fs/**` — your new bench (gitignored by the `banco-prova*/` rule; it stays disposable, DECISIONI §12).
- `banco-prova-flow/**` — the builder's bench, gitignored. Its stacks are stopped; you may restart and reuse it, but only AFTER step 1 below.

You may NOT touch anything else. In particular: `agenti/schema-forge/**` is read-only (a fix for its `Gate:` regex is already committed elsewhere by the coordinator — don't redo it); `agenti/gestionale-crafter/**`, `banco-prova-negozio/**`, `banco-prova-accademia/**` and the whole `C:\Users\sinog\Desktop\Web Gun` checkout belong to ANOTHER CHAT WORKING RIGHT NOW; `README.md`, `HOWTORUN.md`, `DECISIONI.md`, `scripts/installa-skill.ps1`, `CLAUDE.md` are the coordinator's — proposals for them go in the verbale under «Proposte per il coordinatore». Never `git add -A` or `git add .` — stage files by name.

## The attack plan

### 1. Docs-as-contract build — the first attack is following the manual

Build a bench in a **different domain** — not a shop. Suggested: «palestra» (members, courses, bookings; roles `staff` and `cliente`; at least 3 tables with RLS; seed). Use ports **59321/59322** for Supabase and **3171** for the app (543xx, 573xx, 583xx and 3170 are taken by other benches), `[auth].site_url` declared in `supabase/config.toml`. Storage and analytics off (the storage container doesn't get healthy on this machine), one Playwright worker, stack per `CLAUDE.md` with `@supabase/ssr`.

Follow **only** `SKILL.md` + `references/` as if you were the next agent in the pipeline: `map` → human confirms flows → `forge` → `run` → `verify`. Every point where the docs are ambiguous, wrong, or insufficient to proceed without peeking at the builder's bench is a **finding** (class DOC). Do not resolve ambiguity by reading `banco-prova-flow/` — note that the doc didn't suffice, then resolve it however you must.

The flow contract requires human confirmation (first law): propose the flows — including at least one `ostile-lettura` and one `ostile-scrittura` derived from the access model — ask the user **once**, then proceed.

### 2. Green run

Full gate VERDE 7/7 on your bench, pasted. If you can't get it green and the cause is the gate rather than your app, that's a finding.

### 3. Adversarial inputs against the pure rules

Attack each exported rule of `gate-lib.mjs` with hostile forms its tests don't cover. Ideas, not a ceiling: CRLF and BOM in every parsed file; markdown variants of fixed-form lines (the P1 chat already fixed vertical-whitespace holes in `Confermato da:`/`Gate:` — find what they missed); `import { helper as alias }`, multiline imports, helper reached via re-export; `.only` on `test.describe` instead of `test`; skip whose motivation is an empty string or only punctuation; duplicate flow ids in the contract; a spec tagged for a nonexistent flow; two specs claiming the same flow; flow ids containing regex metacharacters; `retries` set via spread or variable instead of the literal `1`.

Verdict classes, gravest first: **false green** (rule should fire, doesn't) · **wrong-reason red** (fires, but the message misdiagnoses) · **crash** on hostile input. Every one is a defect; tabulate held/broke per rule in the verbale.

### 4. Sabotage the app, not the gate

The five classes in COSTRUZIONE §3.2 are already proven — don't just repeat them. Vary: a write action that reports success but writes to the **wrong table**; an RLS policy that accepts the hostile write into a table no flow asserts on; a redirect to login that happens client-side after the admin data has already rendered; a seed drifted so the "row exists" assertion passes on a **pre-existing** row rather than the created one. The question each time: does the gate (or the spec conventions the references prescribe) catch it, and from the right step with the right message?

### 5. Claims audit

Take COSTRUZIONE-2026-07-28.md §3–§4 and re-run what is re-runnable on the builder's bench (restart its stack: `npx supabase start` in `banco-prova-flow/`, then build+start the app on 3170). Any pasted output you cannot reproduce is a finding.

## For every defect found

Measure it first (paste the false green / wrong red / crash), fix it, add a regression test using the **real input form** (the P1 verbale §4.3 lesson: a test that doesn't resemble the real input tests the fixture, not the rule), re-measure, commit — one defect, one commit. If a fix would change the `SKILL.md` contract, don't: write it under «Tensioni» for the coordinator.

## Verbale and bookkeeping

- `agenti/flow-sentinel/COLLAUDO-<today>.md`, Italian, mirroring the structure of schema-forge's collaudo: what was attacked, what held, what broke (measured before/after), the held/broke table per rule, guardians at close (`node --test`, ESLint, knip, jscpd — counts pasted), MANCANTE declared honestly, «Proposte per il coordinatore», «Tensioni con la SKILL.md».
- Update `STATO.md`: collaudata, defect count, and the open point that it has not yet run on a real client project (that's P3).

## Phase exit gate

- [ ] Bench built from docs alone; gate VERDE 7/7 on it, pasted
- [ ] Every exported rule attacked with ≥1 hostile input beyond its existing tests; held/broke table in the verbale
- [ ] Every defect: measured → fixed → regression-tested → re-measured, its own commit
- [ ] Zero weakened rules
- [ ] Final full run VERDE on your bench (builder's bench too if you restarted it)
- [ ] Guardians green at close, counts pasted
- [ ] `COLLAUDO-<date>.md` + `STATO.md` committed
- [ ] All stacks stopped at the end (`npx supabase stop` in each bench, app processes killed) — say so in your final message

## What NOT to do

- Do not redesign `SKILL.md` or rewrite the references wholesale — surgical corrections with a measured defect behind each.
- Do not touch other chats' directories or the coordinator's files.
- Do not trust the builder's tests as evidence — they are part of the thing under test.
- Do not report a defect you did not measure, and do not fix a defect you did not first reproduce.
