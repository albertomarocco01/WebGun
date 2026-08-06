ultracode

# Launchpad — P.5 fase 2: collaudo avversario indipendente

You are an independent test engineer (*collaudatore*) for the Web Gun regia repo. Another chat **designed and built** launchpad in a single package (P0+P1 merged, decision D17) on 2026-08-06. You did not build it and you owe it nothing. Your job is to **break it**, and to fix — with regression tests — whatever you break.

A collaudo that finds nothing after an honest attack is a pass. A collaudo that finds nothing because it didn't attack is a fraud.

Working directory: `C:\Users\Utente\Desktop\WebGun` (the regia). Branch `main`. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is). Model: **Opus 5 · effort high**.

Commit granularly, Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — a domain for your bench, a provider to imitate, the shape of a fixture — you decide, you write down what you decided and why, and you keep going. Never stop to ask. The only thing you may not decide is anything irreversible (§ below).

## The one thing this package may never do

**Nothing gets published.** No account created anywhere, no repository linked to any provider, no domain, no DNS record, no deploy — not even a free one, not even "just to test". The first real deploy is P.3 of this skill and **Alberto authorizes it in person** (`DECISIONI.md` §6). Attacking a deploy skill without deploying is precisely the hard part of this mandate, and it is the mandate.

Corollary you will need: everything about a provider must be attacked through **its documented contract** — the files it reads, the environment variables it sets, the build command it runs — reproduced locally. Reproducing a provider's documented behaviour on your own machine is allowed and encouraged; touching a provider is not.

## Read first, in this order

1. `CLAUDE.md` — repo contract. This repo is the regia, not a site.
2. `DECISIONI.md` — at minimum §6 (irreversible → human), §12, §18 (MANCANTE ≠ PASS), §19, §20, §25, §27.
3. `CANTIERE.md` — decisions **D14** (autonomy), **D17** (four parallel chats), **D18** (this wave), and rows P.5 / P.6 / P.4g / P.4h. This tells you who else is working right now.
4. `agenti/launchpad/SKILL.md` — **the contract under test**. You do not redesign it.
5. `agenti/launchpad/references/` — all four. Every rule and every claim is a target. `verifica-deterministica.md` §6 and §8 especially: §6 is the *justification* for the gate reading instead of measuring, §8 is the list of "which step could be green on a deploy that must not happen".
6. `agenti/launchpad/COSTRUZIONE-2026-08-06.md` — the builder's verbale. **Every pasted output in it is a claim, and a claim is a target.**
7. `agenti/launchpad/STATO.md` — §"Cosa non è mai stato provato" is the builder's own honest list. Do not stop there: that list is what the builder *knew* it hadn't proven.
8. `agenti/flow-sentinel/prompts/P2-collaudo.md` — the methodological precedent for this phase (a different skill, same rite).
9. `agenti/launchpad/scripts/` — read **after** designing your first round of attacks, not before. Attacks designed from the code test the code against itself.

## Scope fence (D17/D18 — three other chats are running right now)

You may write ONLY:

- `agenti/launchpad/**` — fixes, regression tests, `COLLAUDO-2026-08-06.md`, `STATO.md`.
- `banco-prova-collaudo-lp/**` — your bench (gitignored by the `banco-prova*/` rule, disposable, `DECISIONI.md` §12).

You may **read** anything. You may NOT write: the pilot `C:\Users\Utente\Desktop\fornodoro` (**P.4h owns it in writing and is changing its seed right now** — read it if you like, and expect it to move under you), `agenti/site-doctor/**` (P.6-P2 is in it), `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/**` (P.7d is in them), `CANTIERE.md`, `README.md`, `HOWTORUN.md`, `DECISIONI.md`, `CLAUDE.md`, `scripts/`. Proposals for those go in your verbale under «Proposte per la direzione».

**Never `git add -A`, never `git add .`, never `commit -a`.** Stage by name. On a busy `index.lock`: wait, don't delete it.

Ports: **3182** for the app of your bench. Under 49152 (WinNAT reserves 57464-57963). **Do not start a Supabase stack**: this machine holds one, it belongs to the pilot, and P.4h is using it. Launchpad's gate does not need a database — if you think it does, that itself is a finding.

## What you already know, measured by the direction (do not re-derive, do verify)

The direction relaunched the gate on the pilot on 2026-08-06 after P.4g's delivery. Result, pasted:

```
GATE LAUNCHPAD: ROSSO (4 falliti, 3 verifiche mancanti su 9 passi)
OK    si pubblica un commit, non un working tree
FAIL  verdetti dichiarati dagli agenti a monte
FAIL  bloccanti dichiarati nel registro del debito
FAIL  nessun segreto nel pacchetto che parte
MANC  variabili d'ambiente dichiarate e non committate
OK    la build si rifa' uguale su un'altra macchina
MANC  l'impronta dell'artefatto e' derivata dal commit
MANC  runbook firmato da un umano, sul contenuto
FAIL  contratto d'uscita (handoff)
```

Two of those refusals were **cross-checked by the direction and found true**, and they are your best starting evidence that the gate is worth attacking properly:

- `docs/handoff/14-p4g-prerequisiti.md` has **no `Gate: VERDE|ROSSO` line at all** (`grep -cE "^\**Gate" → 0`, while the other five handoffs all have one). The gate found a real hole in a document written by another chat the same day.
- The seed credential the gate blocks on (`supabase/seed/90-solo-sviluppo.sql:128`) is declared **closed** in the pilot's debt register as n°27 — and the same register's n°44 says that on a freshly created production those two accounts **do enter**. The gate, which cannot read prose, was right where the prose was wrong.

Your job is not to celebrate that. Your job is to find where the same gate is **wrong in the other direction**.

## The attack plan

Run it in this order. Each numbered block is a phase; do not skip a phase because the previous one found nothing.

### 1. Docs-as-contract — the first attack is following the manual

Build a bench **in a different domain from the pilot** (a pizzeria) and **different from anything in `agenti/launchpad/scripts/banco*`). Suggested: a small Next.js App Router site for a *studio dentistico* or a *scuola di musica* — your choice, write it down. It must be a plausible Web Gun output: `src/app`, `src/components`, `src/lib`, `docs/`, a `package.json`, a git history of more than one commit.

Then act as the next agent in the pipeline, using **only** `SKILL.md` + `references/`, without reading `scripts/`: run `piano` → `segreti` → `impronta` → `verify`. Every point where the docs are ambiguous, wrong, or insufficient to proceed without peeking at the implementation is a **finding (class DOC)**. Resolve it however you must, but record that the doc didn't suffice.

Deliverable of this phase: a bench where the gate goes **VERDE 9/9**, pasted. If you cannot get it green and the cause is the gate rather than your bench, that is the most valuable finding of the package — a gate no honest project can satisfy is a gate that will be bypassed.

### 2. The false-green hunt, step by step

Nine steps. For **each one**, ask the question the builder was supposed to ask and answer it with an executed attack, not an opinion:

> *What is the cheapest project I can construct that makes this step print `pass` while the property it names is false?*

Targets you should reach, at minimum — this is a floor, not a ceiling:

- **`radice-pulita`**: a working tree that is clean *because everything dangerous is gitignored*. A submodule with local changes. A detached HEAD. A commit that exists locally and on no remote (what does "publish a commit" mean if nobody else can fetch it?).
- **`catena-gate`**: a handoff whose `Gate: VERDE` line is inside a fenced code block, or inside a quotation of a *different* project's handoff. A handoff dated in the **future**. Five handoffs all fresher than the code because someone touched them with no re-run — freshness is measured, truth is not, and the reference says so; find where the *measured* half is also foolable.
- **`debito-bloccante`**: a debt register where a blocking entry is written with `n.4` or `#4` instead of `n°4`. A runbook that "names" the debt only inside a heading it never addresses. An entry that declares itself blocking in a table cell the parser reads as prose.
- **`segreti`**: the six families. Attack what is **not** among them: a key split across two lines by a template literal; a key base64'd once; a key inside a JSON file's minified single line; a key in a file whose extension makes the gate treat it as binary (the builder already fixed UTF-16 — find the next one); a key in a git **tag message** or a commit message rather than a file; a key in a submodule; a key in `.github/workflows/*.yml` as a default value. Also attack in the other direction: how expensive is a **false positive** on an innocent project? The builder measured one (`docs/PRODUZIONE.md` accused of committing the key it teaches not to commit) — find whether the fix left a sibling.
- **`ambiente`**: an `.env.production` that is gitignored but **committed in an earlier commit**. A variable declared in the runbook and absent from the provider list. A `NEXT_PUBLIC_` variable holding a service key (the builder claims the prefix absolves the *content*, not the name — falsify it).
- **`runtime-riproducibile`**: `engines.node` satisfied by the declaration and violated by the lockfile. A `packageManager` field naming a manager the lockfile contradicts. A dependency whose `engines` is stricter than the project's and is a **transitive** dep (the gate reads 455 package.json — find where it stops).
- **`impronta-artefatto`**: this is the step the builder is proudest of. `generateBuildId` returning a value derived from a commit that is **not HEAD**. A `generateBuildId` that reads an env var the provider does not set, so it silently falls back. A build id that matches HEAD because the build ran *before* the last commit and the two happen to agree.
- **`runbook-firmato`**: a signature line whose date is older than the last commit (the skill says a signature older than the content authorized a different content — is that *measured* or only *written*?). A signature with the placeholder shape `{{…}}`. A runbook signed by "Direzione lavori (per delega…)" — is delegated signature accepted, and should it be, for the one irreversible act in the pipeline? Answer that question with a measure and an argument; it is a genuine design tension and the direction wants your opinion in «Tensioni».
- **`contratto-uscita`**: an handoff that exists and is empty. One that documents a *different* project.

For every attack: **measured before → fix → regression test using the real input form → measured after → its own commit.** A test that doesn't resemble the real input tests the fixture, not the rule.

### 3. Attack the remedies, not only the gate

The builder found its worst defect here: the fragment the skill *prescribes* (`generateBuildId` with `require` in an ESM `next.config.mjs`) broke a real client build. That class is not exhausted. Take **every** snippet, template and runbook step in `references/` and `resources/templates/` and execute it against your bench: `next.config.ts` **and** `.mjs` **and** `.js`; a project with `"type": "module"` and one without; a `next.config` that already exports a function; a project on Next 15 as well as 16 if you can install it. A skill that prescribes a remedy owns the remedy's defects.

### 4. Claims audit of the builder's verbale

Take `COSTRUZIONE-2026-08-06.md` §sabotaggio (36 classes) and §tribunale (32 rilievi) and re-run what is re-runnable. Any pasted output you cannot reproduce is a finding. Specifically verify: that the 36 sabotage classes each fail on **the step that claims to guard them** and not on an incidental one; and that the 105 tests do not contain a test that passes because the fixture was shaped around the implementation.

### 5. The two things the builder could not prove, and the honest half you can

`STATO.md` §"Cosa non è mai stato provato" lists seven. Six require a provider and stay untouched. The seventh — **`generateBuildId` on a provider's machine** — is the premise of Legge n°4 and you *can* attack its documented contract: the provider builds from a **fresh clone at a given commit**, often with `--depth 1`, sometimes with no `.git` at all. Reproduce that: clone your bench shallow into a temp dir, build, and see what the fingerprint says. If `generateBuildId` reads git and the provider strips git, the whole identity chain is a fiction on exactly the machine it was designed for. Measure it. This may be the single most valuable thing in this package.

## For every defect found

Measure it first (paste the false green / the wrong red / the crash), fix it, add a regression test in the real input form, re-measure, commit — one defect, one commit. If a fix would change the `SKILL.md` contract, **don't**: write it under «Tensioni con la SKILL.md» for the direction.

Never weaken a rule to make a bench pass. If a rule and reality disagree, either the rule has a defect (fix the rule, keep it strict) or your bench has one. Diffs on rules are corrections or additions, never relaxations — and any assertion you *remove* is justified by name in the verbale.

## Verbale and bookkeeping

- `agenti/launchpad/COLLAUDO-2026-08-06.md`, Italian: what was attacked, what held, what broke (measured before/after), a **held/broke table per step of the gate**, the DOC findings from phase 1, guardians at close (`node --test`, ESLint, knip, jscpd, semgrep, gitleaks — counts pasted), every MANCANTE declared honestly, «Proposte per la direzione», «Tensioni con la SKILL.md».
- `STATO.md`: P2 done, defect count, test count before → after, and the open points that survive.

## Phase exit gate — all of these, or the package is not delivered

- [ ] Bench built from docs alone, different domain; gate **VERDE 9/9** on it, pasted
- [ ] All nine steps attacked with ≥1 executed false-green attempt each; held/broke table in the verbale
- [ ] Every prescribed remedy executed against a real build, in at least two config shapes
- [ ] The shallow-clone attack on `generateBuildId` executed and its result stated, whichever way it goes
- [ ] Every defect: measured → fixed → regression-tested → re-measured, its own commit
- [ ] Zero weakened rules
- [ ] Final full run green on your bench; gate della regia (`node scripts/verifica-regia.mjs`) **VERDE 5/5**
- [ ] Guardians green at close, counts pasted
- [ ] `COLLAUDO-2026-08-06.md` + `STATO.md` committed
- [ ] **Nothing published. No account, no domain, no DNS, no deploy.** Say so explicitly in your final message
- [ ] No process of yours left alive; say which ports you opened and that you closed them

## What NOT to do

- Do not redesign `SKILL.md` or rewrite references wholesale — surgical corrections, a measured defect behind each.
- Do not touch the other three chats' directories, or the pilot's working tree.
- Do not trust the builder's tests as evidence: they are part of the thing under test.
- Do not report a defect you did not measure, and do not fix one you did not first reproduce.
- Do not stop to ask. Decide, write down the decision, keep going.
