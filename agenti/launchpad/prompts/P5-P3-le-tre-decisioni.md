# P.5-P3 — Le tre decisioni della direzione, eseguite

You are a maintenance engineer for the Web Gun regia repo, `C:\Users\Utente\Desktop\WebGun`, branch `main`. Model: **Opus 5 · effort high**. All repo deliverables are in **Italian** (this prompt is English; nothing else you write is).

Commit granularly — **one change, one commit** — with Italian narrative one-liners in the style of `git log --oneline -15`, each ending with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Go all the way to the end on your own.** Nobody is watching this chat. Where the mandate leaves a technical choice open, you decide, you write it down, you keep going. **Never stop to ask.**

## How you commit, and why it is different this time

Three other chats are running **in this same folder, on this same branch, sharing the same git index**. On 2026-08-06 that cost the yard a commit: `ab978cd` — whose message speaks only of site-doctor's delegations — carries `agenti/launchpad/scripts/gate-lib.mjs` and `agenti/launchpad/references/verifica-deterministica.md`, because *your own predecessor chat* had staged them 52 seconds earlier and the other chat's bare `git commit` swept the whole index. The CAT-1 exemption you will read about below is, in the history, filed under a commit about a favicon.

So:

```
git commit -F - -- <i tuoi percorsi>
```

**Always with `-- <paths>`.** A pathspec-limited commit ignores the index entirely. Never a bare `git commit`, never `-A`, never `-a`. Decision **D19** of `CANTIERE.md`.

## Your write perimeter

```
agenti/launchpad/**
```

Plus a scratch bench under `banco-prova-lp-p3/` if you need one (gitignored; delete it at the end).

**Outside your perimeter:** `CANTIERE.md`, `DECISIONI.md`, `prompts/` at the root, every other `agenti/*`, the `banco-prova-*` of others, and **the pilot repo `C:\Users\Utente\Desktop\fornodoro` — read-only, always.** No Docker, no Supabase stack.

**Nothing gets published.** No account created anywhere, no repository linked to a provider, no domain, no DNS record, no deploy — not even a free one, not even "just to test". This rule survives every other consideration in this mandate.

---

## Why this package exists

Your predecessor — the adversarial collaudo of 2026-08-06 — closed 26 defects and then did the right thing three times: it found three things it could **not** close from inside, because closing them would have been a skill rewriting its own mandate while being audited. It escalated them. The direction has decided all three. Your job is to execute the decisions, and to execute them *as decisions*, not as suggestions.

Read first: `agenti/launchpad/COLLAUDO-2026-08-06.md` §9 and §10. That is the reasoning you are the consequence of.

---

## 1. La firma per delega non copre ciò che autorizza — decisione D20

Today the gate accepts `Confermato da: Direzione lavori (per delega del committente Alberto Marocco) — <data>` on `docs/deploy.md`, and names it with a `warn` that does not change the verdict. Your predecessor measured that and wrote: *«la delega non va accettata qui, ma non va nemmeno rifiutata da un gate che cambia contratto da solo»*. Correct on both halves. The direction now supplies the missing half.

**The decision:** D14 introduced the delegated signature for contracts that **describe work already done** (`docs/flussi-critici.md`, `docs/performance.md` — verbali). `docs/deploy.md` does not describe: it **authorizes**, and it authorizes the one irreversible act of the whole pipeline, the one that costs money and that afterwards belongs to whoever copied it. `DECISIONI.md` §6 wins over D14 here, and the line that separates the two cases is: **si può delegare la firma su un verbale, non su un mandato.**

**What to do:**

- On the `runbook-firmato` step, and **only** on the document that authorizes publication, the delegated form becomes a `block`, not a `warn`. The message must say why in one sentence a reader can act on — that this is the only irreversible act of the pipeline, that `DECISIONI.md` §6 forbids delegating it, and that the signature wanted here is a person's own name.
- The delegated form stays **valid everywhere else**. Do not touch how the other contracts are read; five other gates depend on that.
- `SKILL.md` and the reference must say it, in the section where a reader looks before running `pubblica`. A rule that lives only in the code is a rule the next chat will delete as an inconsistency.
- Test both directions: the delegated form on the runbook → `block`; a real name and date → `pass`; the delegated form on a non-runbook contract → unchanged.

## 2. La citazione non è un verdetto — decisione D23 §1

Measured by your predecessor: a handoff whose only verdict is `> Gate: VERDE (dal progetto Val Scura, come promemoria)` **passes**.

**The decision:** for the `catena-gate` step **only**, a verdict inside a blockquote does not count. For the other five agents, §19 governs a document they wrote themselves; for launchpad it governs **other people's certificates**, and the blockquote is precisely the form one uses to quote someone else's verdict. This is the only place in the house where a citation of another project can become this project's verdict.

**Do not touch the general §19 implementation** — it lives in five gates and breaking it there buys nothing. Change the reading that `catena-gate` does, and say in the reference that the rule is narrower here and why.

**The cost is accepted and must be paid out loud:** an agent who legitimately writes its own verdict inside a blockquote now gets a red. So the message must name the cause and the cure — *«un verdetto dentro una citazione non conta: la citazione è il modo in cui si riporta il verdetto di un altro progetto. Togli il `>`.»* A false red that speaks is worth more than a silent false green; a false red that does not explain itself is worth less than both.

## 3. Il registro del debito prende una colonna — decisione D23 §2

Your predecessor's argument, which the direction accepts in full: *«l'elenco delle forme che il gate riconosce è aperto per costruzione: ne ho aggiunte due dopo averne scavalcate due, e la prossima persona ne inventerà una terza»*.

**The decision:** `docs/DEBITO-TECNICO.md` gets a fixed-form line per entry —

```
Blocca il deploy: sì
```

— and the `debito-bloccante` step reads **that line**. An entry without it is **`MANCANTE` for that entry**, not a pass: this house's rule is that a premise never counted is a missing verification, and prose heuristics are exactly an uncounted premise.

Three things that make this a decision and not a trap:

- **The template belongs to schema-forge, not to you.** Write the *reader*; describe the required form precisely in your reference so the neighbouring skill and the pilot can produce it. Say in the verbale that the template change is owed by schema-forge and name it.
- **The pilot's fifty entries are migrated in this same wave** by the chat that owns `fornodoro`. There will be a window in which whoever runs first sees a red nobody could have satisfied. That is governed by **D18 §3**: cite the regia commit next to every measurement, and report the new red instead of hiding it.
- Keep the prose heuristics **only** as a source of a `warn` that names the entry, so a half-migrated register says *which* entries still speak in prose. Do not let them decide the verdict any more.

## 4. Il messaggio che stampa una data e confronta un istante

Found by the direction today, running your gate on the pilot:

```
[block] docs/handoff/07-schema-forge.md: piu' vecchio del codice che certifica
        (handoff 2026-08-06 · ultimo commit di codice 2026-08-06)
```

**The rule is right** — `piuVecchioDi(h.data, ultimoCommitCodice)` compares full instants, and the handoff commit really is earlier in the day than the last code commit. The defect is in `agenti/launchpad/scripts/gate-lib.mjs:335`, which prints `.slice(0, 10)` on both sides: a blocking message that reads *«2026-08-06 is older than 2026-08-06»*. A reader cannot verify it, and a block that looks like a bug is a block someone overrides.

Print what was compared: the time, or the two commits, or both. Then look through the rest of your findings for the same shape — **anywhere a message displays a coarser value than the one the rule used** — and fix those too. Say how many you found.

## 5. Il banco è uno script, non una cartella — proposta accettata

Your predecessor proposed it after finding that `banco.mjs` did not exist and the central claim of the construction verbale was therefore not reproducible, and then wrote `banco.mjs` to close it. The direction accepts the general rule: **i banchi delle skill si tracciano come script**, and it now applies to you as a standing requirement rather than a repair.

So: `scripts/banco.mjs` stays tracked, stays runnable from a clean checkout with one command, and **your closing measurement includes running it twice** — once on a fresh regeneration, once on the bench it already made — with both outputs pasted. If any of your changes above make the bench red, the bench is what you fix, and the commit says which rule made it red.

## 6. Una riga di contratto che manca

§9.3 of the collaudo: *«il gate legge il disco, il provider riceve il commit»* — the premise that makes all nine steps true, written in the reference and not in `SKILL.md`. Put it in `SKILL.md`, in the section a reader meets before the commands.

---

## Come chiudi

1. Battery **above 148** (measured by the direction today at `d147f52`). Launchpad declares its test files explicitly in `package.json`, so `node --test scripts/` alone will not do — use `npm test`. If you add a test file, add it to the declared list, or it exists and never runs.
2. Guardians on the changed code: ESLint, knip, jscpd, semgrep, gitleaks — each with its count, residues motivated next to the line.
3. `node scripts/verifica-regia.mjs` from the regia root: **VERDE 5/5**.
4. `scripts/banco.mjs`: **VERDE 9/9**, twice, pasted.
5. Your gate rerun **read-only against the pilot**, from `C:\Users\Utente\Desktop\fornodoro`, with `--url http://127.0.0.1:3621` if the app is up — it costs nothing and writes nothing. Today, at `d147f52`, it printed **ROSSO, 4 falliti su 9** (`verdetti`, `segreti`, `runbook-firmato`, `contratto-uscita`). Paste yours next to that, say which of the four moved and why, and remember that **three of those four are not yours to close** — they belong to the direction (n°27), to Alberto in person (the signature) and to a publication that has not happened (your own handoff).
6. Verbale `agenti/launchpad/P5-P3-2026-08-06.md`: each decision with the before/after output, the count of coarse-message defects found in §4, and a section «Cosa resta MANCANTE, col suo nome».
7. `STATO.md` updated.

**Do not weaken a rule to make a bench pass.** Every change in this mandate makes the gate stricter; if one of them turns a correct project red, that is a finding, and the finding goes in the verbale with the name of whoever owns it.
