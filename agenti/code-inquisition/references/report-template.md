# Final Report Template

Two variants — the Chairman picks by target size, never drops the Coverage Map / Dissent Log / evidence+verification columns.

## LIGHT variant — Depth 1, single focus, <15k-line target (default for small audits)
Six sections only — avoids ceremony-to-signal bloat on small jobs:
```markdown
# 🜲 Code Inquisition — Verdict [run: INQ-<id>]
**Target/Focus/Depth · Council (titles+models) · Model-diversity n/m · Rounds r/max · Consensus <reached|open:N>**
1. **Verdict** — Ship / Ship-with-fixes / Do-not-ship / Insufficient-evidence + the single biggest risk (2–4 lines).
2. **Findings** — table: ID | title | severity | likelihood | confidence | verification | evidence `file:line` | fix.
3. **Open Disputes** (if any) — id · View A vs View B + evidence · `[HUMAN DECISION REQUIRED]` where needed.
4. **Hardening backlog** — Low/Info bullets with `file:line`.
5. **Coverage map** — only the taxonomy rows this roster claimed; mark clean / finding / NOT-CHECKED.
6. **Trace** — roster+models · toolchain · LEDGER per round (incl. proof-of-execution: `verifier_agent_id`, `spawns_used`, `roster_critic_result`, `red_team_target`, `cold_rederived_ids` — a blank field = that gate was skipped) · how FPs were dropped (incl. unverified-tool-claims).
```

## FULL variant — Depth 2/3, or large/multi-focus targets

---

```markdown
# 🜲 Code Inquisition — Verdict   [run: INQ-<run-id>]

**Target:** <repo/path/feature>   **Focus:** <areas>   **Depth:** <1|2|3>   **Scope:** <target|diff>
**Council:** <expert titles + models>   **Model diversity:** <n models / m experts> (1 ⇒ VALIDATEs = peer-agreed)
**Rounds:** <loops_run>/<max_loops>   **Toolchain:** <available | missing>
**Consensus:** <converge: reached | strict: reached | open disputes: N>   **Challenge-rate:** <n/round> (0 ⇒ suspect convergence)

## 1. Executive Summary
3–6 sentences a decision-maker can act on. The single most important risk; the verdict —
**Ship / Ship-with-fixes / Do-not-ship / Insufficient-evidence-to-rule**; headline count of Critical/High;
and how much is tool-confirmed vs peer-agreed vs static-only.

## 2. Coverage Map  *(false-negative accounting — the section that makes "we didn't miss a class" auditable)*
| Taxonomy item (OWASP/CWE/hotspot/…) | Checked by | Verdict | Evidence / tool |
|---|---|---|---|
| A01 Broken Access Control | Supabase-RLS | clean | RLS policies verified `supabase/policies.sql:1-40` |
| A10 SSRF | — | **NOT CHECKED** | gap — no expert assigned |
Any `NOT CHECKED` row is itself a reported gap. Abstained surfaces (from `ABSTAIN`) are listed here.

## 3. Cross-Severity Matrix
| ID | Title | Domain | Severity | Likelihood | Confidence | Verification | Consensus | Cross-domain |
|----|-------|--------|----------|-----------|-----------|--------------|-----------|--------------|
| INQ-<run>-001 | … | Security | Critical | Certain | 0.95 | executed-confirmed | 3/3 ✅ | degrades Perf (cache) |
| INQ-<run>-002 | … | Perf | High | Likely | 0.70 | static-only | 2/3 ⚠ | conflicts w/ -001 fix |
`Verification`: executed-confirmed (T1, ≤1.0, confirms regardless of votes) > tool-flagged (T1.5, ≤0.85,
falsifiable) > static-only (≤0.7) > unverifiable (≤0.5). Tags assigned by the Verifier, not self-certified.
`Consensus` counts only disjoint-evidence VALIDATEs (ACK excluded). ⚠ = open/disputed.

## 4. Prioritized Action Plan
Ordered by global risk×reach over **parent issues** (root-cause clusters), NOT by domain or expert volume.
1. **[CRITICAL] INQ-<run>-001 — <fix>** — why now · effort · blast radius if deferred · `file:line` · verification.
2. **[HIGH] …**

## 5. Findings (detail)
> **INQ-<run>-001 · <title>**
> - **Severity / Likelihood / Confidence:** Critical / Certain / 0.95   **Consensus:** 3/3   **Verification:** executed-confirmed
> - **Evidence:** `path/file.ts:42` — `"<exact quoted line>"` (+ minimal trace/PoC, quoted exactly)
> - **Impact:** concrete consequence + the data-flow/exploit path (entry point → sink).
> - **Recommendation:** smallest fix that closes it.   **Side effects:** cross-domain consequences (or "none").
> - **Debate trail:** raised by <expert>; VALIDATE <x> (disjoint evidence: …), CHALLENGE <y> (resolved: …); anchoring-risk? <no>.

## 6. Hardening Backlog  *(Low/Info — did not block consensus, nothing dropped)*
Bullet list of minor improvements with `file:line`. Triaged out of the loop but preserved for later.

## 7. Cross-Domain Interdependency Graph   *(Depth 2/3)*
Findings that compound or conflict across domains. Text DAG/table:
`INQ-002 (perf cache) ──bypasses──> INQ-005 (authz) ⇒ merged into INQ-001, escalated`

## 8. Dissent Log   *(consensus reached — minority views, never erased)*
> **Minority view (Expert A, split 2–1):** INQ-002 is Medium, not High.
> - **Position & evidence:** load test `perf/bench.md:23` shows P95 50ms < 100ms SLA.
> - **Council ruling:** overruled — VALIDATE from B+C found caching opens auth-bypass (INQ-003); safety > perf.
> - **What would change the verdict:** a cache fix that preserves the authz check, or explicit user acceptance.

## 9. Open Disputes   *(only if consensus not reached at max_loops, or OSCILLATING items)*
> **INQ-<run>-007 · <title>** — **View A** (Expert B): … evidence … | **View B** (Expert C): … evidence …
> Flag `[HUMAN DECISION REQUIRED]` where a human tradeoff (e.g. competing safety values) is needed.

## 10. Detection Audit   *(self-measurement of FP/FN risk)*
- **Tool-vs-council divergence:** items tools flagged but no expert raised (possible misses); items experts raised but tools contradicted (possible FPs).
- **Integrity counters:** `unverified-tool-claim` count (experts who claimed T1 the Verifier couldn't reproduce); `severity-deflations` (Medium→Low downgrades + whether each had counter-evidence).
- **Coverage:** count of `NOT CHECKED` / abstained surfaces.
- **Calibration:** of confirmed findings, how many executed-T1 vs tool-flagged-T1.5 vs peer/static-only.

## 11. Appendix — Inquisition trace
Roster + mandates + models + stances · toolchain (+ exec-safety: did `--allow-exec` run, or static-only) · per-round
summary (findings in → fabricated-dropped → refuted-dropped → confirmed) · loop count · loop-health flags
(oscillation/inflation/early-stop) · **proof-of-execution: `verifier_agent_id`, `spawns_used`, `roster_critic_result`,
`red_team_target`, `cold_rederived_ids` (blank ⇒ gate skipped)** · how false positives were eliminated and coverage gaps closed.
```
