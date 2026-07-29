ultracode

# Flow Sentinel — Phase 1: Construction

You are building **Flow Sentinel**, the E2E testing agent of the Web Gun pipeline (Playwright against Next.js + Supabase apps). The design phase (P0) is DONE and human-confirmed: `agenti/flow-sentinel/SKILL.md` is the spec. Your job is to implement it — references, gate scripts with tests, a minimal proving bench — and to prove the gate works by running it for real.

You implement the spec. You do NOT redesign it. If you find a genuine defect in the spec, stop THAT item, record it in your report under "Spec issues", and keep building everything else.

## Read first, in this order (mandatory, before any file is written)

1. `CLAUDE.md` — repo contract (handoff rules, guardian rule)
2. `agenti/flow-sentinel/SKILL.md` — THE SPEC. Three laws, six commands, seven gate steps with stable ids. Human-confirmed 2026-07-28.
3. `agenti/flow-sentinel/STATO.md` — current state and the P0→P3 plan
4. `DECISIONI.md` — especially §6 (Specchio delegation in pipeline), §8 (linters get configured, the gate never gets downgraded), §15 (stable step ids + `--json` contract), §18 (measure the premise before reading the outcome), §19 (handoff must declare the gate verdict, and the gate checks it)
5. `agenti/schema-forge/` — the methodological precedent. Read: `STATO.md` (how a gate earns trust), `references/verifica-deterministica.md` (the `--json` contract you will mirror), `scripts/verify.mjs` (step structure, `formaEseguibile()` Windows shim handling, premise-measuring), `scripts/audit-lib.mjs` + its tests (pure-logic extraction pattern)
6. `agenti/code-maniac/references/costituzione.md` and `best-practices.md`

## House rules (non-negotiable)

- **Language:** this prompt is English; every deliverable is **Italian** — prose, references, code comments, CLI output, commit messages. Read `git log --oneline -30` for the commit voice: narrative one-liners, lowercase, no conventional-commit prefixes.
- **MANCANTE ≠ PASS.** A missing tool, an unreachable app, an unread input → the step is `skipped` (verifica mancante), never `pass`. A gate that is red for missing verifications stays red.
- **Measure the premise before the outcome** (DECISIONI §18): count spec files BEFORE running Playwright; check the app answers BEFORE reading test results; resolve the DB port from the project's `supabase/config.toml` — never a default port, never from the environment.
- **Stable ids** (DECISIONI §15): the seven step ids are `flussi-critici`, `spec-coverage`, `lint-spec`, `effetto-db`, `app-viva`, `playwright`, `contratto-uscita` — in this order. JSON keys in English (`ok`, `steps`, `status`, `detail`, `counts`, `contract`, `summary`), labels in Italian. A test must lock ids and order.
- **Handoff verdict** (DECISIONI §19): the `contratto-uscita` step compares the handoff's `Gate: VERDE|ROSSO` line against the verdict of the previous six steps. Declaring red on a red gate PASSES; divergence fails.
- **Pure logic separated from I/O shells** (schema-forge precedent): every gate rule lives in a pure, exported, tested function (e.g. `scripts/gate-lib.mjs`); `verify.mjs` stays a shell of steps. Every rule gets BOTH a firing test and a non-firing test. Test runner: `node --test "scripts/**/*.test.mjs"` (quote the glob — Node 24 treats bare paths as globs).
- **Windows traps already paid for** (do not rediscover them): `.cmd` shims need `formaEseguibile()`-style resolution (`where` + `cmd.exe /c <full path>`, NEVER `shell: true` — argument concatenation breaks paths with spaces); PowerShell `>` redirection writes UTF-16 (use Git Bash for redirects); `psql` lives in `%USERPROFILE%\scoop\apps\postgresql\current\bin` on this machine.
- **retries = 1, fixed.** A test passing on second attempt is `pass` but the detail names it, even on a green gate.
- **No production, ever.** Local Supabase + local app only.

## Scope fence

You may create/modify ONLY:
- `agenti/flow-sentinel/**` (references, scripts, resources, STATO.md, your report)
- `banco-prova-flow/**` (your proving bench — gitignored by the `banco-prova*/` rule, intentionally: DECISIONI §12, benches are disposable, reports remain)
- `.claude/skills/flow-sentinel` (junction only, see below)

You may NOT touch: `banco-prova-negozio/**` and `agenti/gestionale-crafter/**` (another chat is working there RIGHT NOW), `agenti/schema-forge/**` (read-only precedent), `agenti/code-maniac/**`, `agenti/code-inquisition/**`, `bugbay` (snapshots), `README.md`, `HOWTORUN.md`, `DECISIONI.md`, `scripts/installa-skill.ps1`, `CLAUDE.md`. Changes these files WOULD need go in your report under "Proposte per il coordinatore" (e.g. the DECISIONI entries to add, the installer line for flow-sentinel).

Git: you are on branch `agente/flow-sentinel` (verify with `git branch --show-current`; if not, check it out — it exists). Commit granularly, Italian messages. Do NOT push, do NOT merge, do NOT touch other branches. If `git status` shows files outside your fence (e.g. `agenti/gestionale-crafter/*` untracked), LEAVE THEM ALONE and never `git add -A`.

## Deliverables

### 1. References (4 files, per the SKILL.md index)

- `references/flussi-critici.md` — what a critical flow is; positive vs hostile; the three flow types (`positivo`, `ostile-lettura`, `ostile-scrittura`) and what each must assert (positive → DB effect; hostile-write → refusal AND DB unchanged; hostile-read → route/UI refusal, there is no state to compare); how hostile flows are DERIVED from the access-model table of schema-forge's handoff (every «—» and «sola lettura» cell is an attack to attempt via browser); flow patterns for e-commerce (login, cart, checkout) and gestionale (login, one full CRUD, state advancement); the exact format of `docs/flussi-critici.md` (stable ids like `checkout-ospite`, type, steps, expected DB effect or refusal, `Confermato da:` line).
- `references/playwright.md` — selector policy (getByRole/getByLabel first, then testid, never brittle CSS); waiting on conditions, never `waitForTimeout`; auth via storage state with test users created by global-setup through the admin API (service_role from local env, never committed, never in the production seed); the DB-effect helper (`e2e/helpers/db.ts`, service_role ONLY here); the login-flow DB assertion pattern (e.g. `auth.users.last_sign_in_at` via admin client — the effetto-db rule must be SATISFIABLE for login, write the pattern that satisfies it); spec structure with `@flusso:<id>` tags; config (`retries: 1`, `forbidOnly: true`, trace on-first-retry).
- `references/verifica-deterministica.md` — the seven steps, what each measures as premise and reads as outcome, severity semantics (`block`/`issue`/`warn` within steps that produce findings), the full `--json` contract with an example document, MANCANTE ≠ PASS. Mirror the structure of schema-forge's homonymous reference.
- `references/sabotaggio.md` — the collaudo procedure: one planted defect per class (at minimum: a flow genuinely broken; a "UI lies" defect where the action reports success but writes nothing — THE trap that motivates the effetto-db law; a hostile route left open), the expected red for each, restore procedure, and the rule that sabotage runs at collaudo time, not on every gate run.

Every rule in every reference states its WHY in one sentence — house voice. No rule without a reason.

### 2. Gate scripts

- `scripts/verify.mjs` — the seven steps, stable ids, `--json` flag, exit code from a `verdetto()`-style function. App URL and DB resolved from the project (bench) `supabase/config.toml`; explicit `--url`/`--db-url` flags win; environment NEVER consulted.
- `scripts/gate-lib.mjs` (or equivalent) — pure rules: flussi-critici.md parsing (ids, types, `Confermato da:`), spec-tag extraction and coverage matching, `test.only`/unmotivated-skip detection, effetto-db static check (spec of a positive or hostile-write flow must import AND call the db helper; declare honestly in the finding message that this checks FORM, not semantics — the same honesty schema-forge uses for its RLS audit), handoff `Gate:` line comparison, Playwright JSON-report parsing (passed / failed / passed-on-retry with names).
- `scripts/*.test.mjs` — `node --test`, every rule firing + not-firing, ids/order locked, edge cases: zero spec files → MANCANTE; flussi-critici.md present but without `Confermato da:` → MANCANTE (an unconfirmed contract is no contract); spec with tag for an undeclared flow → orphan warning; CRLF and BOM must not break parsing (Windows).
- `package.json` in `agenti/flow-sentinel/` for the guardians (eslint, knip) — same setup style as `agenti/gestionale-crafter/package.json` if you need a reference, but do not modify theirs.

### 3. Resources

- `resources/templates/flussi-critici.md` — the contract template.
- `resources/templates/handoff-flow-sentinel.md` — with the `Gate:` line and the sections CLAUDE.md requires (cosa ho fatto / decisioni / cosa si aspetta il successivo / problemi noti), plus covered/uncovered flows and flaky-with-explanation.
- `resources/config/` — ESLint flat config for spec linting (the `lint-spec` step uses it via the skill path, and `forge` copies it into the project — same pattern as schema-forge's `.sqlfluff`).

### 4. Proving bench: `banco-prova-flow/`

Minimal Next.js (App Router, TypeScript) + local Supabase. It exists to prove the GATE, not to be a product — keep it small:

- One public page, one login page, one protected `/admin` area with ONE CRUD (e.g. `products`) and ONE state-machine action (e.g. order `in_attesa → confermato`).
- Schema: 2–3 tables with RLS (write them yourself; you are not schema-forge, but respect its non-negotiables: RLS on at birth, deny by default). Seed idempotent. Test users via Playwright global-setup + admin API.
- **Unique ports** in `supabase/config.toml`: other Supabase stacks run on this machine (54322 and 57322 are taken). Check `docker ps` and pick a free range (e.g. 58xxx) BEFORE `supabase start`.
- Five flows in `docs/flussi-critici.md` (write `Confermato da: UMANO (P0, 2026-07-28)` — the human confirmed this bench design in P0): `accesso-staff` (positivo), `crea-prodotto` (positivo), `avanza-stato-ordine` (positivo), `admin-negato-anon` (ostile-lettura), `scrittura-negata-cliente` (ostile-scrittura).
- Specs for all five, green against the healthy bench.

### 5. Proof runs (this is the phase's core — outputs go in the report verbatim)

1. **Green run:** gate VERDE 7/7 on the healthy bench. Paste the full output.
2. **Sabotage run** (per `references/sabotaggio.md`): plant the "UI lies" defect (make the create-product action report success without inserting) → the `playwright` step MUST go red because the effetto-db assertion fails, NOT because the UI changed. Restore, re-run, green again. Paste both outputs.
3. **MANCANTE runs:** three premises removed, one at a time — app not running → `app-viva` skipped (and `playwright` not falsely green); spec files deleted → MANCANTE, not pass; `flussi-critici.md` removed → MANCANTE. Paste outputs.
4. **Guardians:** ESLint 0 errors 0 warnings on `agenti/flow-sentinel/scripts`, knip clean, `node --test` all green — state the exact test count.

### 6. Bookkeeping

- Update `agenti/flow-sentinel/STATO.md`: measured numbers (test count, gate steps, proof-run results), open points ordered by gravity, what a green gate does NOT prove (honesty section — schema-forge's STATO is the model).
- Write `agenti/flow-sentinel/COSTRUZIONE-<date>.md` — the phase report: what was built, decisions taken (with reasons), the pasted proof outputs, spec issues found (if any), "Proposte per il coordinatore" (installer line, DECISIONI entries, README row update).
- Create the skill junction (DECISIONI §7): `New-Item -ItemType Junction -Path .claude/skills/flow-sentinel -Target (Resolve-Path agenti/flow-sentinel).Path` — absolute target or it fails.

## Phase exit gate (all boxes, PASS / FAIL / MANCANTE — report every one)

- [ ] 4 references written, zero `TODO` left, every rule has its why
- [ ] `verify.mjs` + pure lib + tests: `node --test` green (state count), ids and order locked by a test
- [ ] ESLint 0/0, knip clean on the agent's scripts
- [ ] Green run: VERDE 7/7 pasted
- [ ] Sabotage run: red for the RIGHT reason (effetto-db assertion), then green after restore — both pasted
- [ ] Three MANCANTE runs pasted (no app / no specs / no contract)
- [ ] `retries = 1` and second-attempt declaration visible in output
- [ ] Templates + ESLint config in `resources/`
- [ ] STATO.md updated with measured numbers and honest open points
- [ ] `COSTRUZIONE-<date>.md` written
- [ ] Junction created, skill invocable
- [ ] All commits on `agente/flow-sentinel`, Italian messages, nothing outside the fence touched

A single empty box = the phase is not closed. Close what you can, declare what you couldn't and why — a declared hole is recoverable, a hidden one costs ten times more three agents downstream.

## What NOT to do

- Do not redesign SKILL.md (spec issues → report, not edits)
- Do not add gate steps, commands, or config options beyond the spec — YAGNI
- Do not weaken a failing check to make the bench pass; fix the bench or report the spec issue
- Do not use `waitForTimeout`, `shell: true`, environment-variable DB fallbacks, or default ports
- Do not install the bench as anything permanent — it is disposable by design; the report carries the proof
- Do not run anything against remote/production Supabase
