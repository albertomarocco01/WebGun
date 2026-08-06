# P.7d — I quattordici: i due CRITICAL e i dodici HIGH del tribunale

You are a maintenance engineer for the Web Gun regia repo, `C:\Users\Utente\Desktop\WebGun`, branch `main`. Model: **Opus 5 · effort high**. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is).

Commit granularly — **one defect, one commit** — with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the shape of a fixture, which of two adequate fixes to apply, how to build a probe — you decide, you write it down, you keep going. **Never stop to ask.**

## Why this package exists

On 2026-08-06, P.7c pointed `/code-inquisition` at the `scripts/` of the four historic skills. The report is `INQUISIZIONE-GATE-2026-08-06.md` in the repo root: **46 distinct defects**, from a rite that threw away nothing — 0 fabricated citations out of 47 rilievi, 4 wrong citations recorded, 1 actively contradicted, 4 downgraded, 2 promoted.

The number that gives the package its weight: **the same day, on the same files, relaunched by the verifiers — ESLint 0, semgrep 0 on the thirteen files where the defects live, gitleaks 0, batteries 465/465 green.** Every deterministic guardian in the house declared clean four gates that a project can turn green without deserving it.

P.7c closed **one** of the 46 — the four never-remeasured battery counts — and declared the other 45, with proof and a proposed order, in the four `STATO.md`. It did not close them because each one changes the behaviour of a gate, and each wants a test that falsifies it: closing them by hand without re-measuring would be exactly what the report reproaches the code for. That was the right call, and this package is its consequence.

**Your scope: the two CRITICAL and the twelve HIGH.** The MEDIUM and LOW go to a later package, except where noted below.

## The recurring shape — read this before the list

The report's own finding, and the thing you should carry into every fix:

> The recurring shape is not «the gate computes wrong». It is **«the gate lets itself be convinced»**: nine of the ten gravest rilievi are cases where a rule doesn't fire, the step stays green, and the detail prints a number that reads like coverage happened — `azioni server: 1`, `13 file di spec`, `schemi esposti: public`. It is exactly the defect the house rule — *a missing tool is MANCANTE, not PASS* — exists to prevent, arriving through a door the rule wasn't watching: not the absent tool, but **the premise that was never counted**.

So for each defect, the fix is rarely just a stricter regex. Ask also: **what number should this step print so that a reader can tell coverage from silence?** A step that examined zero objects and prints `pass` is the disease; a step that prints `0 oggetti esaminati` and goes `skipped` is the cure. Where a fix of that shape is available, prefer it — and say in the commit why.

## The fourteen, and how to prove each

Read the report's own entry for each (`INQUISIZIONE-GATE-2026-08-06.md`) — it carries the exact file, line, and the proof the verifier executed. Reproduce that proof **before** you fix, and re-measure after. Do not fix a defect you did not first reproduce.

### The two CRITICAL

**C1 — `where`/`which` resolve the executable from the current directory, which is the audited project.** All four gates: `schema-forge/verify.mjs:83`, `gestionale-crafter/verify.mjs:89`, `flow-sentinel/verify.mjs:102`, `speed-demon/verify.mjs:93`. A `supabase.cmd` planted in the audited project's root wins over the real shim (measured); a fake `supabase` carries five steps, a fake `node` carries the RLS audit — six of nine. Four attacks on the rilievo, all repelled.

This is the gravest thing in the house because it is **remote-ish code execution by the thing that is supposed to be judging the code**. Whoever hands you a repository to audit chooses which binaries your gate runs.

Fix it once and fix it in all four. The proof that closes it is a **sabotage**: a scratch directory containing a `supabase.cmd` that prints a marker, the gate run from there, and the marker **absent** from the output after the fix and present before. No Postgres required — this is about which executable got resolved.

**C2 — a declared critical flow can never be executed and the flow gate stays VERDE 7/7.** `flow-sentinel/gate-lib.mjs:503`:

```js
export const batteriaHaEseguito = (esito) =>
  esito.passati > 0 || esito.falliti.length > 0;
```

A global OR. Thirteen specs skipped with a motive plus one trivial passing test → seven green steps. Closed for 100% skipped, open at 92% — and speed-demon reads only `esito.ok`, so the false green propagates downstream.

The fix is not a threshold. The question is per-flow: **each declared flow must have at least one spec that actually ran**, and the step must print how many of the declared flows were exercised, not how many spec files exist. Prove it with a real Playwright JSON report shaped like the real thing — the P1 lesson: *a test that doesn't resemble the real input tests the fixture, not the rule.*

### The twelve HIGH

Take them in this order — it groups by mechanism, so one fix often carries the next:

1. **H1 + H2 + L1 — arguments reach `cmd.exe /c` unfiltered.** `speed-demon/gate-lib.mjs:974` filters only spaces; `&` and `%VAR%` pass. `gestionale-crafter/verify.mjs:353` has not even that, and `validaConfig` checks `adminRoot` with `!== undefined` — not even a type check. `cmd /c shim.cmd … /&ver` executes `ver`, **status 0**. And L1 comes with it: the comment «we do not use `shell: true`» is a false guarantee in four files, because `cmd.exe /c` **is** a shell. Fix the mechanism and fix the comment: a comment that promises a property the code doesn't have is worse than no comment.
2. **H4 — a page path in the contract can be an absolute URL, and Lighthouse measures another site.** `speed-demon/gate-lib.mjs:77`. `## \`home\` — https://example.com/` → the gate measures example.com and prints a score for the client's site. `//evil.example.com/` too. `stessaPagina` never compares against `baseUrl`. This is the same family as C1 — the audited project chooses what the gate measures.
3. **H3 — the `service_role` rule is a literal regex.** `gestionale-crafter/audit-lib.mjs:195`. `const key = process.env.SB_ADMIN_KEY` in a declared Supabase client module → rule 3 = 0, rule 4 = 0. The canonical name on the same file → 1 `block`. The fix has to reason about *what the value is*, not what it's called.
4. **H5 + M17 — a field separator inside a policy expression shifts the columns.** `schema-forge/rls-audit.mjs:34` and `:126`. `with check (true)` becomes invisible: 7 fields → 2 findings including the block; 8 fields with `\x1f` in `qual` → **0 findings**. No arity check anywhere: `riga()` accepts 8 fields as it would accept 3. M17 is its twin in `prosrc` and the two were found by two councils that couldn't see each other — the report's only cross-confirmation. Fix both; an arity check is the cheapest half.
5. **H6 + H7 — the server-action audit is blind twice.** `export const x = async () => {}` → `funzioniEsportate = []`, `findings = 0`, and the gate prints «azioni server: 1». And a guard's name inside a string counts as a call: `throw new Error("richiediStaff() non e ancora agganciata")` → no finding. Note the cruelty of the second: the sentence that triggers the defect is exactly the one you write when taking note of the hole.
6. **H8 — the `a11y` and `tsc` steps measure with the audited project's own configuration.** `gestionale-crafter/verify.mjs:337`. Zero active rules exits 0 → `pass`. There is no `resources/config` in this skill, while schema-forge and flow-sentinel do the opposite (`--no-config-lookup --config <skill>`). The fix exists in the house already — copy the sibling's shape, don't invent one.
7. **H9 — `"rotta": ""` makes any route exist.** `gestionale-crafter/verify.mjs:194`. `join("C:/prog","src/app/admin","")` is a directory that exists, so `regolaEntitaAncorate` returns `[]` and the step prints «N tabelle nei tipi». Also true when `rotta` is absent entirely. Related and worth carrying: **M8**, `dentroProgetto` doesn't contain anything — a `../` in the route erases the «route does not exist» block. Same function family, fix together.
8. **H10 + H11 + H12 + M14 + M15 + M16 — nothing has a timeout, and the gates are mute by construction.** `grep timeout` across the four skills finds **one** limit in total (`flow-sentinel/verify.mjs:297`). Measured: speed-demon against a server that accepts and never answers — **45 seconds, zero lines, killed**; flow-sentinel against the same server returns in 15,2 s with a readable RED, and the difference is that single `AbortSignal.timeout`. Plus: 15 `psql` calls with neither `timeout` nor `connect_timeout` (hung past 40 s); speed-demon nesting the whole flow gate with no limit (two silent processes); `supabase db reset` where `conRitentativo` **never starts** because it waits for a return that never comes; and `npx --yes lighthouse`, unpinned, downloaded at run time, resolved from the audited project's `node_modules/.bin`.

   **Treat this as one family and finish it.** A timeout family fixed at four call sites out of six is not fixed — that is why the three MEDIUMs are in your scope and the others are not. Every process call and every fetch gets a declared limit, and when the limit fires the gate prints **which step, which command, how long** and goes `skipped` (a missing measurement), never `pass`. Pin Lighthouse to a version and stop installing at run time; `gestionale-crafter` already uses `--no-install` on the same shape.

If while fixing one of the fourteen you find that a MEDIUM or LOW is *inside the same function you are rewriting*, fix it and say so. Do not go hunting for the others: they are the next package's, and a package that quietly swells is a package nobody can verify.

## What you may not do, and what «done» means here

**No live database, no Docker, no Supabase stack, no bench with a real Postgres.** The only stack on this machine is the pilot's, it belongs to another chat (P.4h) and this machine holds one at a time (16 GB). This is not a limitation of your proofs — almost every one of the fourteen lives in a pure library or in executable resolution, and the honest proof is a hostile input, not a live server. Where a gate step needs a database, build a **fake project directory** rich enough to drive the gate to the step under test and let the database-dependent steps report `MANCANTE`: that is correct behaviour and does not weaken your proof of the step you are testing.

**Declare the consequence.** The four gates will **not** be relaunched against a live bench in this package. Say it, in the verbale and in each `STATO.md`, as a `MANCANTE` with a name: *the gates changed and were re-proven by battery and by sabotage on fake projects; the full run on a live bench is the closing act of the next package.* This is the precedent P.7c set on 2026-08-06 when it fixed the RLS-audit regexp without relaunching the gate, declared it, and the direction accepted it. Declared is the difference between a limit and a lie.

**Never weaken a rule to make something pass.** If a rule and reality disagree, either the rule has a defect (fix the rule, keep it strict) or your fixture has one. Diffs on rules are corrections or additions, never relaxations; any assertion removed is justified by name in the verbale.

**Do not change any `SKILL.md`.** These are gate-behaviour fixes. If a fix would need the contract to change, write it under «Tensioni» and implement the strongest thing that leaves the contract intact.

## Scope fence (D17/D18 — three other chats are running right now)

You may write ONLY:

- `agenti/schema-forge/**`, `agenti/gestionale-crafter/**`, `agenti/flow-sentinel/**`, `agenti/speed-demon/**` — but **not** their `SKILL.md`, and **not** anything under `prompts/`.
- `PROCESSO-GATE-2026-08-06.md` in the repo root — your verbale.

You may **read** anything. You may NOT write: `agenti/launchpad/**` (P.5-P2 is in it), `agenti/site-doctor/**` (P.6-P2 is in it), the pilot `C:\Users\Utente\Desktop\fornodoro` (P.4h owns it), `CANTIERE.md`, `README.md`, `HOWTORUN.md`, `DECISIONI.md`, `CLAUDE.md`, `scripts/`, `INQUISIZIONE-GATE-2026-08-06.md` (it is a report of what was found on a date; it does not get edited when things are fixed — your verbale records the fixes).

**Never `git add -A`, never `git add .`, never `commit -a`.** Stage by name. On a busy `index.lock`: wait, don't delete it.

**One thing you must know about a neighbour:** P.4h is going to relaunch all five gates against the pilot at the end of its work, using the versions you will have committed by then. A gate you make stricter may turn the pilot red. That is not a collision to avoid — it is the system working — but it means two things for you: commit each fix as soon as it is proven, so the neighbour never runs a half-finished gate; and if a fix of yours is likely to turn a *correct* project red, say so explicitly in the commit message so the neighbour can tell your change from its own regression.

## Verbale and bookkeeping

`PROCESSO-GATE-2026-08-06.md`, Italian, with outputs **pasted** and not summarized:

- one section per defect: the report's proof reproduced (before), the fix, the regression test in the real input form, the measurement after;
- a **table of the fourteen** with: reproduced yes/no, fixed yes/no, test added, and which skill;
- the sabotage of C1 in full (marker present before, absent after);
- the timeout family measured before and after against a deliberately slow server, with the seconds;
- battery counts before → after for each of the four skills (they start at **156 · 111 · 111 · 87**, measured by the direction on 2026-08-06);
- guardians at close: ESLint, knip, jscpd, semgrep, gitleaks — counts pasted;
- what stays `MANCANTE`, with names;
- «Proposte per la direzione»: above all, your judgement on **which of the 31 remaining MEDIUM/LOW deserve the next package and in what order** — you will have read the report more closely than anyone.

Then update the `STATO.md` of each of the four skills: which rilievi are closed, with the measure, and which stay open.

## Delivery gate — all of these, or the package is not delivered

- [ ] All fourteen reproduced **before** being fixed; any you cannot reproduce, declared as such with what you tried
- [ ] All fourteen fixed, each with a regression test in the real input form, each its own commit
- [ ] C1 closed in **all four** gates and proven by sabotage, marker before/after pasted
- [ ] C2 closed per-flow, not by a threshold, and the step prints how many declared flows were actually exercised
- [ ] The timeout family closed **completely** across the six call sites, with the slow-server measurement before and after
- [ ] Lighthouse pinned to a version and no longer installed at run time
- [ ] Zero weakened rules; zero `SKILL.md` touched
- [ ] Four batteries green, counts pasted, all higher than 156 · 111 · 111 · 87
- [ ] Gate della regia (`node scripts/verifica-regia.mjs`) **VERDE 5/5**
- [ ] Guardians green at close, counts pasted
- [ ] `PROCESSO-GATE-2026-08-06.md` + the four `STATO.md` committed
- [ ] No Docker started, no stack touched; say so explicitly
- [ ] No process of yours left alive
