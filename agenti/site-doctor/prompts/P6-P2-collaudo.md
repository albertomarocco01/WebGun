ultracode

# Site Doctor — P.6 fase 2: collaudo avversario indipendente

You are an independent test engineer (*collaudatore*) for the Web Gun regia repo. Another chat **designed and built** site-doctor in a single package (P0+P1 merged, decision D17) on 2026-08-06. You did not build it and you owe it nothing. Your job is to **break it**, and to fix — with regression tests — whatever you break.

A collaudo that finds nothing after an honest attack is a pass. A collaudo that finds nothing because it didn't attack is a fraud.

**This skill needs you more than the others did**, and its own `STATO.md` says so as its open point n°1: it is the only skill in the house born without a director's review between design and construction. The self-review that replaced it found 8 points; the sabotage — the first thing that *executes* instead of reading — found 3 more that the self-review had missed; the tribunal found 33. That ratio, 8 → 3 → 33, is the measure of what a self-review is worth. You are the correction.

Working directory: `C:\Users\Utente\Desktop\WebGun` (the regia). Branch `main`. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is). Model: **Opus 5 · effort high**.

Commit granularly, Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the domain of your bench, the shape of a fixture, which of two equally good fixes to apply — you decide, you write down what you decided and why, and you keep going. Never stop to ask.

## Read first, in this order

1. `CLAUDE.md` — repo contract. This repo is the regia, not a site.
2. `DECISIONI.md` — at minimum §12, §18 (MANCANTE ≠ PASS), §19, §20, §25.
3. `CANTIERE.md` — decisions **D14** (autonomy), **D17** (four parallel chats), **D18** (this wave), rows P.6 / P.5 / P.4g / P.4h.
4. `agenti/site-doctor/SKILL.md` — **the contract under test**. You do not redesign it. §Perimetro is the most attackable thing in this skill (see phase 3).
5. `agenti/site-doctor/references/` — all five. Every rule and every claim is a target.
6. `agenti/site-doctor/COSTRUZIONE-2026-08-06.md` — the builder's verbale. **Every pasted output is a claim, and a claim is a target.** §4 (the mid-package STOP, 8 points), §5 (the defects sabotage found), §6.6 (the tribunal's 33) are where the builder tells you what it already knows.
7. `agenti/site-doctor/STATO.md` — §Punti aperti, nine of them, ordered by gravity. That is the builder's own list of what it *knew* it hadn't proven; your job includes what it didn't know.
8. `agenti/flow-sentinel/prompts/P2-collaudo.md` — the methodological precedent for this phase.
9. `agenti/site-doctor/scripts/` — read **after** designing your first round of attacks, not before. Attacks designed from the code test the code against itself.

## Scope fence (D17/D18 — three other chats are running right now)

You may write ONLY:

- `agenti/site-doctor/**` — fixes, regression tests, `COLLAUDO-2026-08-06.md`, `STATO.md`.
- `banco-prova-collaudo-sd/**` — your bench (gitignored by the `banco-prova*/` rule, disposable).

You may **read** anything. You may NOT write: the pilot `C:\Users\Utente\Desktop\fornodoro` (**read-only for you; P.4h owns it in writing and is changing its seed right now** — expect the app on 3621 to go down and come back, and expect its `docs/` to move under you), `agenti/launchpad/**` (P.5-P2 is in it), `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/**` (P.7d is in them), `CANTIERE.md`, `README.md`, `HOWTORUN.md`, `DECISIONI.md`, `CLAUDE.md`, `scripts/`. Proposals for those go in the verbale under «Proposte per la direzione».

**Never `git add -A`, never `git add .`, never `commit -a`.** Stage by name. On a busy `index.lock`: wait, don't delete it.

Ports: **3881** and **3882** for your benches. Under 49152 (WinNAT reserves 57464-57963); 3781 was the builder's, 3621 is the pilot's, 3182 is P.5-P2's. **Do not start a Supabase stack**: this machine holds one, it belongs to the pilot, and P.4h is using it. This skill's gate has no database dependency — if you find one, that is itself a finding.

## What you already know, measured by the direction (do not re-derive, do verify)

The direction relaunched the gate on the pilot on 2026-08-06 after P.4g's delivery, with the app live on 3621 serving build `vhj8fi1hxQrFTJFWHKPlb`:

```
GATE CONFORMITA': ROSSO (4 falliti, 3 verifiche mancanti, 0 non applicabili su 9 passi)
MANC  certificato di idoneita' firmato
OK    superficie pubblica camminata (collegamenti + sitemap)
FAIL  informativa privacy raggiungibile
FAIL  dati raccolti dai moduli pubblici
FAIL  cosa il sito archivia nel browser
OK    accessibilita' dell'HTML servito
MANC  lingua dichiarata e hreflang
MANC  proprieta' delle voci di conformita'
FAIL  contratto d'uscita (handoff)
```

The acceptance criterion was met: each red is something no other gate in the house sees. **That is not your problem.** Your problem is the opposite direction — where does this gate print `pass` or `n/a` on a site that is *not* compliant.

One detail from that run worth your attention, because it is a possible false negative already visible in the output: the step on third parties reported `1 origini di terzi` and named `http://127.0.0.1:3621`, i.e. **the site itself under a different host form**. A gate that classifies its own origin as a third party is a gate whose notion of "same site" is a string comparison. Start there and see how far it goes.

## The attack plan

Run it in this order. Do not skip a phase because the previous found nothing.

### 1. Docs-as-contract — the first attack is following the manual

Build a bench **in a different domain from the pilot** (a pizzeria) and different from the builder's. Suggested: a *studio legale* or an *asilo nido* — your choice, write it down. It must be a plausible Web Gun output and it must exercise what the pilot cannot:

- **at least two languages**, with real `hreflang` links, because the pilot is monolingual and open point n°6 says no real multilingual site has ever been measured;
- **a real third party** (an embedded map, a font from another origin, an analytics snippet), because the pilot has none;
- **at least one real cookie** set by a `Set-Cookie` header, not just `localStorage`, because the pilot sets zero and the whole cookie half of this skill has never met a live one.

Then act as the next agent in the pipeline using **only** `SKILL.md` + `references/`, without reading `scripts/`: `perimetro` → `scansiona` → `certifica` → `verify` → `handoff`. Every point where the docs are ambiguous, wrong, or insufficient to proceed without peeking at the implementation is a **finding (class DOC)**.

**This phase closes the builder's open points n°2 and n°3 or explains why it can't**: `certifica` and `handoff` have *never been executed on a real project* — on the builder's bench those documents were written by the bench, so they were proven as gate *input*, never as command *output*. And the draft privacy notice that `certifica` is supposed to generate has never been generated once. Generate it. A legal document produced by a program is the most delicate thing this skill does and the least proven; look at what comes out and say plainly whether it is fit to be shown to a client.

Deliverable: the gate **VERDE** on your bench with the multilingual step genuinely exercised (not `n/a`), pasted.

### 2. The false-green and false-`n/a` hunt, step by step

This gate has **four** verdict states, and `n/a` is the newest and least tested idea in the house: the builder's own rule is that *`n/a` costs a measured premise*. So for each of the nine steps ask **two** questions and answer each with an executed attack:

> *What is the cheapest non-compliant site that makes this step print `pass`?*
> *What is the cheapest site that makes this step print `n/a` when the thing IS applicable?*

Targets, a floor and not a ceiling:

- **superficie**: a page reachable only from a `<form action=…>`, or from JS, or only in the sitemap with a `noindex`; a sitemap that lists a page returning 404; a redirect chain to a page on another host; a page behind a query string only. The builder declares that a page nobody links stays out — check that the gate *says so* rather than silently narrowing the surface it then declares compliant.
- **informativa**: a privacy link that exists in the markup but is `display:none`, or points to a 404, or points to a **third-party** boilerplate, or is a `mailto:`. A page whose "informativa" is a heading with no content. Non-Italian wording (`Privacy Policy`, `Datenschutz`) — does the detection depend on a word list, and is that word list a language assumption nobody declared?
- **dati raccolti**: a field that collects personal data with **no** `autocomplete` (the strong signal the builder relies on) — `<input name="tel">`, `<input placeholder="Il tuo numero">`, a `<textarea>` asking for an address, a file upload of an ID document. A form built entirely by JS after load. A form posting to a third-party endpoint. The builder's evidence is `autocomplete`; find how much of the world doesn't use it.
- **archiviazione**: `sessionStorage`, `IndexedDB`, `document.cookie` written by inline JS, a cookie set by a **third-party** script, a `Set-Cookie` on a subresource rather than the document, storage written only after a click. The pilot had exactly one `localStorage` — your bench must have five kinds and the gate must find all five or declare which it can't see.
- **a11y**: this step says the pilot is clean over 5 pages. Attack it: an `alt=""` on a meaningful image, a label that references a nonexistent `for`, an `aria-label` that is whitespace, headings that skip from `h1` to `h4`, `lang` on `<html>` disagreeing with the actual text, a `<main>` that appears twice. Note the declared boundary — contrast is speed-demon's — and check the gate says so instead of implying coverage.
- **hreflang**: the builder's own mid-package STOP caught that the `NON APPLICABILE` premise was **circular** and that a multilingual site with no hreflang would have come out "not applicable". Verify the fix on a real multilingual bench, then attack it: hreflang that is not reciprocal, an `x-default` pointing nowhere, two languages declaring the same URL, an hreflang in an HTTP header instead of the markup.
- **perimetro / proprietà**: see phase 3.
- **certificato** and **contratto d'uscita**: a certificate signed with a placeholder; one signed by delegation; one older than the last commit; one listing an owner file that exists but does not name the voice.

For every attack: **measured before → fix → regression test in the real input form → measured after → its own commit.**

### 3. Attack the perimeter itself — this skill's founding idea

The first deliverable of the whole skill was the *perimeter against the neighbours*, with the rule: *where a neighbour measures a thing you do not re-measure it, you verify it declared; where nobody looks, it is yours.* It exists because Open Graph was once assigned twice in the same handoff and the favicon was a 404 on every page for three rings.

So attack the rule that was born from that failure:

1. **Take the sixteen voices** in `conformita-lib.mjs` (`VOCI`) — 6 own, 9 delegated, 1 discovered — and for each delegated one, go and read the neighbour's SKILL.md and gate. Does the neighbour actually measure it? Delegating a voice to an agent that does not in fact check it produces exactly the favicon-404 hole, one level up. **Any voice delegated to a neighbour that doesn't measure it is a HIGH finding.**
2. **The inverse**: find something that no gate in the house measures and that a pre-production compliance certificate should carry. Candidates to test, not to assume: a `robots.txt` that disallows the very page the sitemap advertises; a `Content-Security-Policy` absent on a site that embeds a third party; a form posting over plain `http`; personal data in a URL query string that ends up in the server log; an email address published in plain text.
3. **The two-owner case**: the skill says *a voice with two owners is a voice belonging to nobody*. Construct a project whose docs assign one voice to two agents and check the gate says so.

### 4. Claims audit of the builder's verbale

Re-run what is re-runnable from `COSTRUZIONE-2026-08-06.md`: the 25 sabotage classes (does each fail on **the step that claims to guard it**?), the 144 tests (is there one that passes because the fixture was shaped around the implementation?), and above all the **HTML comment defect** the tribunal found — `<!--` inside an attribute value is text, not a comment opening, and two invisible `<div>`s were erasing images, fields and third parties from the document the gate judges. That was closed with a single-scan cleaner. **Find the next one.** HTML parsing with regular expressions has more than one universal key: try `<script>` containing `</div>` in a string, `<![CDATA[`, a `<textarea>` containing markup, an unclosed attribute quote, a `<!DOCTYPE` with an internal subset, `<svg>` with foreign content, and a page served as `application/xhtml+xml`.

Also re-verify the performance claim (24,6 s → 16 ms on 200 KB) and probe the two limits the builder declares open: **no timeout on any step** (open point n°6 in a neighbour's STATO, and the same question applies here) and **no cap on the body downloaded nor on the number of bundles**. A gate with no timeout facing a slow-loris server hangs forever; measure it against a socket that sends one byte per second and say what happens.

## For every defect found

Measure it first (paste the false green / the wrong red / the crash), fix it, add a regression test in the real input form, re-measure, commit — one defect, one commit. If a fix would change the `SKILL.md` contract, **don't**: write it under «Tensioni con la SKILL.md».

Never weaken a rule to make a bench pass. Diffs on rules are corrections or additions, never relaxations — any assertion removed is justified by name in the verbale.

## Verbale and bookkeeping

- `agenti/site-doctor/COLLAUDO-2026-08-06.md`, Italian: what was attacked, what held, what broke (measured before/after), a **held/broke table per step and per verdict state** (`pass`/`fail`/`skipped`/`n/a`), the DOC findings of phase 1, the perimeter audit of phase 3 as its own section with a row per delegated voice, guardians at close (`node --test`, ESLint, knip, jscpd, semgrep, gitleaks — counts pasted), MANCANTE declared honestly, «Proposte per la direzione», «Tensioni con la SKILL.md».
- `STATO.md`: P2 done, defect count, tests before → after, which of the nine open points are now closed and which survive.

## Phase exit gate — all of these, or the package is not delivered

- [ ] Bench built from docs alone, different domain, **multilingual + real third party + real cookie**; gate VERDE on it with the hreflang step genuinely exercised, pasted
- [ ] `certifica` and `handoff` executed as **commands** on a real project for the first time; the generated draft privacy notice pasted and judged in writing
- [ ] All nine steps attacked in **both** directions (false `pass`, false `n/a`); held/broke table in the verbale
- [ ] The sixteen conformity voices audited against the neighbours' actual gates, one row each
- [ ] The HTML-parsing attack executed with at least six hostile shapes beyond the one the tribunal found
- [ ] The no-timeout limit measured against a deliberately slow server, and its result stated
- [ ] Every defect: measured → fixed → regression-tested → re-measured, its own commit
- [ ] Zero weakened rules
- [ ] Final full run green on your bench; gate della regia (`node scripts/verifica-regia.mjs`) **VERDE 5/5**
- [ ] Guardians green at close, counts pasted
- [ ] `COLLAUDO-2026-08-06.md` + `STATO.md` committed
- [ ] The pilot untouched in writing; say so explicitly
- [ ] No process of yours left alive; say which ports you opened and that you closed them

## What NOT to do

- Do not redesign `SKILL.md` or rewrite references wholesale — surgical corrections, a measured defect behind each.
- Do not touch the other three chats' directories, or the pilot's working tree.
- Do not trust the builder's tests as evidence: they are part of the thing under test.
- Do not report a defect you did not measure, and do not fix one you did not first reproduce.
- Do not stop to ask. Decide, write down the decision, keep going.
