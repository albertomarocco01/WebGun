# P.6-P3 — Le quattro voci che tornano a casa, e il gate che non finisce mai

You are a maintenance engineer for the Web Gun regia repo, `C:\Users\Utente\Desktop\WebGun`, branch `main`. Model: **Opus 5 · effort high**. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is).

Commit granularly — **one change, one commit** — with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open — the shape of a fixture, which of two adequate fixes, how to build a probe — you decide, you write it down, you keep going. **Never stop to ask.**

## How you commit, and why it is different this time

Three other chats are running **in this same folder, on this same branch, sharing the same git index**. On 2026-08-06 your own predecessor chat wrote in its verbale, as proposal n°5, that `git add` by name had saved it twice. It had — and then it failed a third time, unseen: commit `ab978cd`, whose message speaks only of your seven empty delegations, carries two of **launchpad's** files, staged by another chat 52 seconds earlier and swept up by a bare `git commit`.

That is not a reproach to your predecessor: it measured what it could see. `git add` by name protects you from files another chat has **modified**; nothing protects you from files another chat has **staged**, because the index is shared state. So:

```
git commit -F - -- <i tuoi percorsi>
```

**Always with `-- <paths>`.** A pathspec-limited commit ignores the index entirely and takes the working-tree content of exactly those paths. Never a bare `git commit`, never `-A`, never `-a`. Decision **D19** of `CANTIERE.md`.

## Your write perimeter

```
agenti/site-doctor/**
banco-prova-collaudo-sd/**   (esiste già sul disco, gitignorato: riusalo)
```

**Outside your perimeter:** `CANTIERE.md`, `DECISIONI.md`, `prompts/` at the root, every other `agenti/*` — **in particular `agenti/speed-demon/**`, which another chat is changing this wave** — and **the pilot repo `C:\Users\Utente\Desktop\fornodoro`, read-only, always.** No Docker, no Supabase stack.

---

## Perché esiste questo pacchetto

Your predecessor closed fourteen defects, took the battery from 144 to 168, and then escalated two things it deliberately did not decide: **who owns the seven empty delegations**, and **whether the gate is allowed to end without a verdict**. Both are contract changes. The direction has decided both.

Read first: `agenti/site-doctor/COLLAUDO-2026-08-06.md` §5, §8 and §10. That is the reasoning you are the consequence of.

---

## 1. Il tribunale, prima di tutto il resto

Your predecessor's own §10.1: *«Il tribunale sul codice cambiato non è stato convocato. È la prima cosa da fare.»* It is your first act, not your last.

Run `/code-inquisition` on the code the collaudo changed — `agenti/site-doctor/scripts/` — with `--focus security,reliability,architecture`. In this house that rite has found **11, 6, 5, 21, 6 and 32 defects on six skills out of six, every single time with ESLint, knip, jscpd and the batteries all green.** Site-doctor is the skill with the thinnest review history: it was born without a director's review between design and construction, and the ratio 8 → 3 → 33 (self-review → sabotage → tribunal) is the measured price of that.

Close what it finds, in severity order, each with a test in the real input shape. Where a finding is wrong, say so with the measurement that refutes it — the rite records contradicted citations and so should you. If the tribunal is unavailable on this machine, that is **MANCANTE with its name**, and the package continues.

## 2. Le quattro voci tornano a casa — decisione D21

The direction re-measured your predecessor's finding and confirms it. In `agenti/speed-demon/`, excluding tests: `contrast` **0 files**, `og:` **0**, `favicon` **0**; `sitemap` and `application/ld+json` appear **only inside `references/seo.md`**, which is documentation that *teaches*, not a gate that *measures*; and every `robots` occurrence in the scripts is `<meta name="robots">` or `x-robots-tag` — the **other** voice.

**The decision — D21:** ownership follows the measurement, not the topic.

| voce | proprietario da oggi | perché |
|---|---|---|
| `favicon` | **site-doctor** | costa una richiesta HTTP a chi cammina già ogni pagina — e questa skill nasce dalla favicon a 404 del pilota |
| Open Graph | **site-doctor** | idem: si legge nell'HTML che stai già scaricando |
| JSON-LD (`application/ld+json`) | **site-doctor** | idem |
| `sitemap.xml` | **site-doctor** | la scarichi già, per la superficie pubblica |
| `robots.txt` | **site-doctor** | è la superficie pubblica, ed è tuo mestiere |
| `contrasti` | **speed-demon** | è l'unico gate della casa che apre un browser. Un'altra chat, questa ondata, gli fa leggere `report.audits["color-contrast"]` invece del punteggio di categoria |
| a11y dell'area admin | **gestionale-crafter**, dichiarato «sui sorgenti» | resta dov'è, ma la dichiarazione deve dire *cosa* misura: jsx-a11y sui sorgenti non è l'HTML servito, e in questa casa è già misurato che i sorgenti mentono |
| `canonical`, `noindex-private` | **speed-demon** | reggevano già, e restano |

Build the five steps you now own. Each one measures **the served surface**, not a list somebody wrote — that is the sentence in your own `SKILL.md`, and this is the first time it costs you work. For each: a hostile fixture where the thing is *declared* and *absent*, and one where it is present but wrong (a `sitemap.xml` that returns 200 with HTML in it; an `og:image` pointing at a 404; a JSON-LD block that is not valid JSON; a `robots.txt` that disallows everything on a site that wants to be indexed; a favicon that returns 404 while `<link rel="icon">` exists).

Then **rewrite the ownership table** — the sixteen conformity voices — so every line names a proprietario who provably measures it. A voice delegated to someone who does not measure it is the favicon hole one floor up, and your predecessor proved that the emptiness had survived a whole skill being built to prevent it.

While `contrasti` is still being fixed next door, it stays an `issue` with its reason. **Cite the regia commit** next to any measurement that depends on the neighbour (D18 §3): the gates are changing under each other on purpose this wave, and a measurement without its commit is not repeatable.

## 3. Il gate deve finire — sempre con un verdetto

Your predecessor's proposal n°1, accepted: the per-request timeout works, but 60 pages × 2 attempts × 15 s is half an hour with no verdict, and in CI the job is killed by its own timeout before producing one. **A gate that gets killed produces the worst MANCANTE there is: silence that nobody wrote down.**

Add `--scadenza`, and:

- **Pick the default from a measurement, not from a round number.** Measure a full run on your bench and on the pilot (read-only, `--url http://127.0.0.1:3621`, it writes nothing), extrapolate honestly to a large site, and declare the number *and how you got it* in the reference. A default nobody measured is the premise this house keeps getting caught by.
- On expiry, steps that did not complete go **`skipped`** with the reason and the count of what they did examine — never `pass`, never `n/a`, and never an exit with no verdict. The final line must always be printable.
- `--json` gains the same information, and the contract change is written in `SKILL.md`. Your predecessor noted `--json` has still never been consumed by an orchestrator; you are the second consumer after its own runners, so say what you learned using it.
- Test the expiry against a **deliberately slow server** — your predecessor already built one for the slow-loris measurement (31 s and an honest `block`); reuse it. And test that expiry during each of the nine steps still prints a verdict.

## 4. Le due tensioni già dichiarate — lasciale dichiarate

§9 of the collaudo records two limits honestly: that «il proprietario dichiarato ha fatto il suo lavoro» is not entirely text comprehension (now measured for gates, still prose for handoffs), and that the *essenzialità* of a storage is declared and not measurable. **Do not try to close the second one.** It is the limit of a falsifiable control, it is now written in §Cosa un gate verde NON prova, and inventing a measure for it would be the house's own recurring defect — a rule that fires on a premise nobody counted.

The first one changes with §2 of this mandate: the ownership table now measures its neighbours. Update the `SKILL.md` sentence so it stays true.

---

## Come chiudi

1. Battery **above 168** (measured by the direction today at `d147f52`). Site-doctor declares its test files explicitly in `package.json`, so `node --test scripts/` alone will not do — use `npm test`, and add any new file to the declared list or it exists and never runs.
2. Guardians on the changed code: ESLint, knip, jscpd, semgrep, gitleaks — each with its count, residues motivated next to the line.
3. `node scripts/verifica-regia.mjs` from the regia root: **VERDE 5/5**.
4. Your bench (the legal-studio one, bilingual, three real third parties, five storage kinds) **VERDE 9/9**, pasted — and the 32 sabotage classes rerun, with the same red count or a written reason for every change.
5. Your gate rerun **read-only against the pilot**. Today, at `d147f52`, it printed **ROSSO — 4 falliti, 3 mancanti su 9**, with the module fields now read correctly (`/ordina`: nome, telefono), `localStorage` caught, and **0 origini di terzi** — the site no longer counts itself as a third party. Paste yours next to that and say which steps moved and why. The pilot's own certificate is **not yours to write**: the chat that owns `fornodoro` produces `docs/conformita.md` this same wave, by running your skill. What you owe it is a skill that behaves.
6. Verbale `agenti/site-doctor/P6-P3-2026-08-06.md`: the tribunal's findings and their closures, the five new steps with a before/after on hostile fixtures, the rewritten ownership table, the measured default for `--scadenza` **with the measurement**, and a section «Cosa resta MANCANTE, col suo nome».
7. `STATO.md` updated, and the `README.md` line of the regia only if a command changed — that file is shared, so touch it with a pathspec-limited commit or not at all.

**Do not weaken a rule to make a bench pass.** If one of the five new steps turns the pilot red, that is the point: the pilot has never had a conformity certificate, and a gate that finds nothing on a site nobody ever checked is a gate that is not looking.
