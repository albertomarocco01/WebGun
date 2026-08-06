# P.4h — Il pilota: la credenziale che è sopravvissuta al numero, e i certificati scaduti

You are a build engineer working on the **pilot project** `C:\Users\Utente\Desktop\fornodoro` (pizzeria «Forno d'Oro»), the realistic site that Web Gun's five agents produced. You are the **sole writer of that repo** while three other chats work in parallel on the regia (decision D17/D18). Model: **Opus 5 · effort high**.

Everything you write in the repos is in **Italian** (this prompt is English; nothing else you write is). Commit granularly with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the shape of a script, the wording of a document, which of two adequate fixes to apply — you decide, you write down what you decided and why, and you keep going. **Never stop to ask.** The only things you may not do are listed under «What you may never do».

## The finding that produced this package

P.4g (2026-08-06) delivered well, and the direction verified it: five gates green on build `vhj8fi1hxQrFTJFWHKPlb`. But the direction's collaudo found something no single chat could have found, because it needs three sources at once.

**Source 1 — your own predecessor's handoff.** `docs/handoff/14-p4g-prerequisiti.md` §1 contains both these rows:

| # | Cosa | Stato |
|---|---|---|
| **27** | il seed di sviluppo portava due account con `password123` sul percorso di produzione | **chiuso** |
| **44** | la guardia del seed non copre una produzione **appena creata** | **aperto** |

**Source 2 — the debt register, n°44, measured by P.4g's own tribunal.** On a freshly created production `auth.users` and `ordini` are empty *exactly as after a `supabase db reset`*, so the guard stays silent and the two accounts **do enter**: reproduced in a rolled-back transaction, `INSERT 0 2`, and `encrypted_password = crypt('password123', encrypted_password)` is **true** on the two accounts born — the committed password really opens them, and `Rosa Amato` is born `titolare` and active.

**Source 3 — launchpad's gate, relaunched by the direction, which cannot read prose:**

```
FAIL  nessun segreto nel pacchetto che parte
  [block] supabase/seed/90-solo-sviluppo.sql:128: credenziale cablata in un seed
  [block] supabase/seed/90-solo-sviluppo.sql @ 967f2b4f (2026-08-06)
  [block] supabase/seed.sql @ b1df9572 (2026-08-04)
```

Put together, the direction's verdict, which is not negotiable and which you start from:

> **n°27 is not closed. It was renumbered.** What P.4g closed — measured, and the measures hold — is the *documented production path*: `docs/PRODUZIONE.md` + `scripts/crea-titolare.mjs` no longer read any file containing a password, and the account they create really signs in. What survived is the hazard itself: the credential is still in a tracked file and in the history, and there are still two CLI commands that carry that file to a remote database where nothing stops it.
>
> A debt that changes number without changing risk is bookkeeping, not a fix. The register must say so again.

This is not a reprimand of P.4g — its own tribunal is what found n°44 and n°45, and it correctly left the decision to the direction because the fix touches a gate's contract. **The decision is now taken and it is below.**

## The decision (D18 §2): strada (a), after one measured attempt

The debt register's n°44 offers the direction two roads:

- **(a)** the development seed leaves `sql_paths` and is applied by an explicit script; then `supabase db reset` alone no longer reproduces the development state — which changes an operative line in `CLAUDE.md`, schema-forge's gate contract, and handoff `12`;
- **(b)** it stays as it is and the defence is procedure: `docs/PRODUZIONE.md` §2 forbids the two commands by name.

**The direction chooses (a).** A defence made of prose does not stop a finger, and the house constitution puts security above convenience. But before paying (a)'s price, **measure whether a fail-closed discriminator exists**, because if one does it is strictly better: it keeps `db reset` working *and* it fails safe.

### The measurement to do first, before writing anything

n°44 states that «no signal inside Postgres distinguishes a freshly reset development database from a freshly created production one», and it proves two candidates dead (`current_user` is `postgres` and `rolsuper` is false in both). That is two candidates, not a proof of the general claim — and this house's own recurring lesson is that *a limit of the tool is not a property of the world*.

Test at least these, on the local stack, and reason about what each returns on hosted Supabase (do **not** connect to a hosted project — reason from the documented/known configuration and say which half is measured and which is inferred):

1. `current_setting('app.settings.jwt_secret', true)` — the local stack ships a **well-known public demo secret**. If the value equals the demo secret, you are provably on a demo stack; if it is anything else, or null, you are not. This is the strongest candidate because it is *fail-closed by construction*: unknown → refuse.
2. `current_setting('app.settings.jwt_exp', true)` and the other `app.settings.*` GUCs the local `config.toml` sets.
3. The presence/absence of roles, extensions or schemas that only the hosted platform creates.
4. `inet_server_addr()`, `inet_server_port()`, and whether the connection is loopback.
5. Anything else you think of. Write down every candidate and its measured result, including the dead ones — the dead ones are the value of this section for whoever asks again.

**If a discriminator exists**, implement it as the guard at the top of `90-solo-sviluppo.sql`, strictly fail-closed (*unknown means refuse*, never *unknown means proceed*), with a comment saying what it proves and what it does not. Then you still do (a) as well, because a guard inside a file that a remote command applies is a second line, not the first. Belt and braces: this is the one place in the pilot where a mistake creates two accounts with a published password on a live site.

**If no discriminator exists**, say so with the measurements pasted and do (a) alone.

### What (a) costs, and how to pay it honestly

`90-solo-sviluppo.sql` leaves `[db.seed].sql_paths`. Development state is then produced by an explicit command — `npm run seed-sviluppo`, or whatever shape you judge best; you decide and you write down why. The consequences, all of which are yours to carry through:

- **`supabase db reset` alone no longer reproduces the development state.** Every place that says or assumes it does must change: the pilot's `README`/`docs`, `docs/handoff/12-flow-sentinel.md`, `docs/flussi-critici.md` §Assunzioni, and anything else `grep` finds. Find them by grepping, not by memory.
- **The E2E battery must still be 22/22.** That is the non-negotiable constraint P.4g was given and you inherit it: whatever you change, `flow-sentinel`'s gate ends green with 22 tests passed, and you paste it.
- **schema-forge's gate** applies migrations to a clean database and then seeds. If (a) breaks its contract, you do **not** weaken the gate: you make the project satisfy it, or — if the contract genuinely cannot be satisfied — you stop, write the tension in the verbale under «Tensioni col contratto di schema-forge», and implement the strongest thing that does not touch the gate. The gate belongs to another chat's perimeter this week; you may **read** it, you may not edit `agenti/schema-forge/scripts/`.
- **n°45's prescription for launchpad stands**: the publication gate must refuse a runbook containing `--include-seed` or `db reset --linked`. That is launchpad's to implement, not yours — put it in «Proposte a valle» and make sure the runbook you write (below) does not contain those strings.

### And the register tells the truth again

Rewrite the entries so a reader who arrives cold gets the real state: **n°27 restricted, not closed** (with what *is* closed, measured, and what is not), n°44 and n°45 updated to whatever your work leaves standing. If your work genuinely closes them, close them with the measure — before and after. A voice closed in words is worth less than a voice left open.

## The second half: the certificates have expired

The launchpad gate, relaunched by the direction on 2026-08-06, refuses the pilot's publication also for this:

```
FAIL  verdetti dichiarati dagli agenti a monte
  [block] docs/handoff/07-schema-forge.md: piu' vecchio del codice che certifica
  [block] docs/handoff/08-vetrina-crafter.md: piu' vecchio del codice che certifica
  [block] docs/handoff/10-gestionale-crafter.md: piu' vecchio del codice che certifica
  [block] docs/handoff/12-flow-sentinel.md: piu' vecchio del codice che certifica
  [block] docs/handoff/13-speed-demon.md: piu' vecchio del codice che certifica
  [block] docs/handoff/14-p4g-prerequisiti.md: nessuna riga `Gate: VERDE|ROSSO` leggibile
```

Two different defects, and the second is the more interesting.

**The five stale handoffs** are the declared cost of parallel chats: the certificates exist and expired because P.4g kept working after the upstream agents had signed. There is nothing to blame and something to do: **relaunch the four gates yourself, from the pilot's root, after your seed work is finished**, and redate each handoff with the real output of the run you actually did. Do not redate a line whose run you did not execute. The commands, and the trap:

```
node <regia>/agenti/schema-forge/scripts/verify.mjs
node <regia>/agenti/gestionale-crafter/scripts/verify.mjs
node <regia>/agenti/vetrina-crafter/scripts/verify.mjs   --url http://localhost:3621
node <regia>/agenti/flow-sentinel/scripts/verify.mjs     --url http://localhost:3621
node <regia>/agenti/speed-demon/scripts/verify.mjs       --url http://localhost:3621
```

**One thing you must know about a neighbour before you run those.** P.7d is fixing the two CRITICAL and the twelve HIGH the tribunal found in those very four gates, in another chat, this week. **The gates will get stricter under you.** If a gate that was green this morning refuses the pilot this evening, do not assume you broke something: read the gate's message, check `git log` on that skill, and say in the verbale whether the new red is *your* regression or *their* new rule catching something that was always true. A gate that starts refusing a project it used to accept is the system working; a chat that hides that red is the system failing. Relaunch the gates **at the end** of your work, once, on the versions that exist then — and paste the regia commit (`git -C <regia> rev-parse --short HEAD`) next to the outputs, so the runs are attributable.

The trap, measured by the direction on 2026-08-06 and worth more than the time it saves you: **speed-demon's gate calls Lighthouse through `npx`, which takes the node of the `PATH`, not the interpreter that launched `verify.mjs`.** On this machine the system node is 20.12.2, where `URL.parse` does not exist, so the `canonical` audit dies, the `seo` category gets no score and the gate correctly blocks. Before that one:

```
export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"
```

«Launching the gate with Node 24» and «having Node 24 in the PATH» are not the same thing. The other four run fine with the system node.

**The missing `Gate:` line in handoff 14** is your predecessor's own document, and it is the more interesting defect because P.4g wrote a *transversal* handoff — not a link in the 07→08→10→12→13 chain — and in doing so wrote one that the downstream contract cannot read. Fix the document. Then answer the question it raises, in the verbale: **should a transversal package write a handoff at all, and if so what does its `Gate:` line certify** — there is no single gate that covers "the prerequisites package"? Your answer becomes a proposal to the direction, not a change to anyone's contract.

## The third half: the deploy runbook exists but nobody wrote it

Three more of launchpad's refusals share one cause — `docs/deploy.md` does not exist:

- `debito-bloccante`: n°4, n°12 and n°17 declare they block the deploy and **the runbook does not name them**;
- `ambiente`: without the runbook nobody knows which roots end up in the package;
- `runbook-firmato`: there is nothing to sign.

Write it, from launchpad's own template (`agenti/launchpad/resources/templates/`) — read the skill, follow its `piano` procedure. Content requirements, beyond the template:

- it **names n°4, n°12 and n°17** by number, says what each one is, and prescribes the mitigation at the proxy/edge layer (rate limiting on the two public RPCs and on `/accedi`; the `X-Forwarded-Host` question for n°12). These are the four true blockers left between the pilot and its public and **none of them closes from inside the pilot's code** — that is your predecessor's §7 finding and it is correct;
- it does **not** contain the strings `--include-seed` or `db reset --linked` (n°45);
- it declares the environment variables of production and where each comes from;
- the `service_role` key **never enters the repo**, in any form, in any file, in any example.

**Leave it unsigned.** The signature on a deploy runbook authorizes the only irreversible act in this pipeline, and it belongs to Alberto in person (`DECISIONI.md` §6). The gate must correctly report `MANC runbook-firmato` when you are done, and your verbale says so as an intended outcome and not an oversight. Write the signature line with the placeholder shape the gates reject, so nobody can mistake it for a signature.

## The minor entries

Close or restrict, each with a before/after measure: **n°46** (`engine-strict` can be turned off with a flag) and **n°47** (`min-release-age` does not exist for pnpm). Read the whole register once more and treat every entry that your work touches. Any entry you leave open, leave open **with the reason**, not with silence.

## The last thing, and only if it survives a measurement

Launchpad's gate reports `MANC impronta-artefatto`: `next.config.ts` declares no `generateBuildId`, so the build fingerprint is random and cannot be tied to a commit. The fix looks obvious and is not: **P.5-P2 is auditing that very prescription in another chat right now**, and P.5's builder already found that its own prescribed snippet broke a real client build, and that a fingerprint written as a literal SHA declares the *wrong* commit at the very next commit — worse than a random one, which at least admits it doesn't know.

So: apply a `generateBuildId` only if you can measure that it survives the condition it exists for. A provider builds from a **fresh clone at a given commit**, often `--depth 1`, sometimes with no `.git` directory at all. Reproduce that locally — clone the pilot shallow into a temp directory, build, read `.next/BUILD_ID` — and adopt only the shape that survives. If no shape survives, **do not adopt one**: write the measurement in the verbale and leave the step `MANC`. A fingerprint that lies is worse than a fingerprint that is missing.

## Scope fence (D17/D18 — three other chats are running right now)

You may write:

- `C:\Users\Utente\Desktop\fornodoro\**` — everything. You are its **sole writer** this week.
- In the regia, **only** your own verbale: `agenti/schema-forge/PILOTA-SEED-2026-08-06.md`. Nothing else.

You may NOT write, in the regia: `agenti/launchpad/**` (P.5-P2), `agenti/site-doctor/**` (P.6-P2), `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/scripts/**` and their `STATO.md` (P.7d), `CANTIERE.md`, `README.md`, `DECISIONI.md`, `CLAUDE.md`, `HOWTORUN.md`, `scripts/`. Proposals for those go in your verbale under «Proposte per la direzione».

**Never `git add -A`, never `git add .`, never `commit -a`.** Stage by name, in both repos. On a busy `index.lock`: wait, don't delete it.

**Machine constraints, hard:** the Supabase stack on **7621/7622** is yours and it is the **only one** allowed to be up (16 GB; three stacks saturate the commit and Windows kills the IDE windows with `0xE0000008`). Docker Desktop already fell once during a `db reset` under this load — if it happens, `wsl --shutdown` and restart; volumes survived last time. The pilot's app on **3621** is watched by another chat: when you take it down, bring it back up, and prefer to rebuild-and-restart in one go rather than leaving it down while you work.

## What you may never do

- **No deploy, no account, no domain, no DNS, nothing published.** Not even free, not even as a test.
- **The `service_role` key never enters the repo** — not in a file, not in an example, not in a comment, not in the runbook. It lives only in `e2e/`, read from a local uncommitted env file. (The direction verified that `.env.e2e.local` is correctly gitignored and that launchpad reports it as `issue`, not `block` — that is the intended shape; do not "fix" it.)
- Never weaken a gate to make the pilot pass. A gate belongs to another chat this week; a rule that disagrees with reality is a tension for the verbale.
- Do not touch `C:\Users\Utente\Desktop\Informatica` for any reason.
- Do not stop to ask. Decide, write it down, keep going.

## Verbale and delivery

`agenti/schema-forge/PILOTA-SEED-2026-08-06.md`, Italian, with outputs **pasted** and not summarized (the direction has annotated three previous verbali for replacing outputs with tables and arrows):

1. the discriminator hunt — every candidate, its measured result, and which half is measured vs inferred;
2. what strada (a) cost, place by place, with the greps that found the places;
3. the register before → after, entry by entry, with n°27's restoration explained;
4. the five gates relaunched, outputs pasted, and the handoffs redated against those exact runs;
5. the runbook, and why it is deliberately unsigned;
6. the `generateBuildId` measurement and its verdict either way;
7. «Proposte per la direzione» and «Proposte a valle» (launchpad).

## Delivery gate — all of these, or the package is not delivered

- [ ] Discriminator hunt executed and written, at least five candidates, dead ones included
- [ ] Strada (a) implemented; every place that assumed `db reset` alone found by grep and updated
- [ ] **E2E battery 22/22**, pasted — the constraint that outranks everything else here
- [ ] Register truthful: n°27 restricted with its measure, n°44/n°45/n°46/n°47 resolved or explicitly left open with a reason
- [ ] The credential no longer reachable by any documented command against a remote database — stated as a measured claim, with the measure
- [ ] Five gates relaunched from the pilot's root (speed-demon **with the PATH exported**), outputs pasted, handoffs 07/08/10/12/13 redated against those runs
- [ ] Handoff 14 fixed, with a readable `Gate:` line, and the question about transversal handoffs answered in the verbale
- [ ] `docs/deploy.md` written, naming n°4/n°12/n°17, free of the two forbidden CLI strings, **unsigned by design**
- [ ] `generateBuildId` adopted only if measured to survive a shallow clone; otherwise declared and left
- [ ] launchpad's gate relaunched at the end: it will still be **ROSSO** — say exactly which refusals survive and whose each one is
- [ ] Nothing published; `service_role` nowhere in the repo
- [ ] Verbale committed; app on 3621 **left alive**; the Supabase stack **left up**
