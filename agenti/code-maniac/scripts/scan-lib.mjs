/**
 * @descrizione  Logica pura del motore deterministico, senza I/O: per ogni passo
 *               decide skip-vs-run, lo scope (file in stage / intero repo) e il
 *               comando (script npm vs tool diretto). Include anche la logica pura
 *               di analisi della complessità (parse output tool → grado → hotspot).
 *               Niente spawn, niente fs → testabile in isolamento (scan.test.mjs).
 *               L'esecuzione vive in scan.mjs.
 * @indice
 * - filterStaged(stagedList, ext)          → i file in stage pertinenti allo step
 * - guardFiles(list)                       → { safe, dropped }: scarta i nomi shell-unsafe
 * - classify(code)                         → 'pass' | 'issue'
 * - excerpt(out, n)                        → prime n righe non vuote dell'output
 * - planStep(step, ctx)                    → piano d'esecuzione, senza side effect
 * - COMPLEXITY_EXCLUDE                      → regex file esenti (test/generati/vendored)
 * - gradeFunction(metrics)                 → 'pass'|'warn'|'issue'|'block'
 * - parseEslintComplexity(json, norm?)     → funzioni flaggate da ESLint (-f json)
 * - parseLizardCsv(csv, norm?)             → funzioni da lizard (--csv)
 * - topHotspots(flagged, churn, n)         → top-N per complessità×churn
 * - summarizeComplexity(funcs, churn)      → { counts, flagged, hotspots, status }
 * - securitySignal(changed?, toolFlag?)    → { sensitive, files, toolFlag }
 * - recommendRouting(summary, changed?, security?) → { tier, dedicatedRefactor, mirror, securityReview, reason }
 */

/** I file in stage che combaciano con l'estensione gestita dallo step. */
export function filterStaged(stagedList, ext) {
  return stagedList.filter((f) => ext.test(f));
}

/**
 * Guard di sicurezza (costituzione §2, non derogabile). Su Windows l'esecuzione usa
 * shell:true — i .cmd (npx…) lo richiedono — e Node NON escapa gli argomenti: un nome
 * file coi metacaratteri di shell (& | ; ` $ redirect, apici, backslash, newline) passato
 * a un tool scopato ESEGUIREBBE comandi. I nomi arrivano da git (file già nel repo), ma
 * "input non fidato = ostile": si scartano dallo scoping con nota, invece di darli in pasto
 * alla shell. Gli spazi restano fuori dal filtro: sono un ceiling di sola correttezza
 * (scoping impreciso su Windows), non di sicurezza — scartarli escluderebbe dalla review
 * file dal nome legittimo. → { safe, dropped }
 */
export const SHELL_UNSAFE = /[&|;<>()`$\r\n"'\\]/;
export function guardFiles(list) {
  const safe = [];
  const dropped = [];
  for (const f of list) (SHELL_UNSAFE.test(f) ? dropped : safe).push(f);
  return { safe, dropped };
}

/** Esito di un comando: 0 = pass, qualsiasi altro = issue. */
export function classify(code) {
  return code === 0 ? 'pass' : 'issue';
}

/** Prime `n` righe non vuote dell'output (il residuo mostrato all'LLM). */
export function excerpt(out, n = 6) {
  return out.split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(0, n).join('\n');
}

/**
 * Decide il piano per uno step, SENZA eseguire nulla.
 *
 * ctx = {
 *   installed: boolean,        // step.check()
 *   hasConfig: boolean,        // false solo se step.configFiles è tutto assente
 *   staged:    string[]|null,  // file in stage, o null se non --staged
 *   fix:       boolean,        // --fix
 * }
 *
 * Ritorna uno di:
 *   { status:'skip', note }
 *   { status:'run', exec:{ kind:'npm',  args  }, scopeNote }
 *   { status:'run', exec:{ kind:'tool', files }, scopeNote }
 */
export function planStep(step, ctx) {
  if (!ctx.installed) return { status: 'skip', note: 'non installato' };
  if (step.configFiles && !ctx.hasConfig) return { status: 'skip', note: 'non configurato' };

  const { staged, fix } = ctx;
  const stagedScopable = Boolean(staged && step.stagedExt);

  // FIX#1 — in --staged uno step scopabile usa l'invoke diretto sui file in stage:
  // lo script npm gira whole-repo e ignorerebbe lo scoping, quindi qui lo saltiamo
  // (ESLint/Prettier auto-scoprono comunque la config del progetto). Sugli step
  // whole-program (tsc, convenzioni…) lo script resta preferito anche in --staged.
  const npmArgs = stagedScopable ? null : (step.scriptCmd ? step.scriptCmd(fix) : null);
  if (npmArgs) {
    const base = `via npm run ${npmArgs[1]}`;
    return { status: 'run', exec: { kind: 'npm', args: npmArgs }, scopeNote: staged ? `${base} (intero repo)` : base };
  }

  if (staged) {
    if (step.stagedExt) {
      const files = filterStaged(staged, step.stagedExt);
      if (files.length === 0) return { status: 'skip', note: 'nessun file in scope' };
      return { status: 'run', exec: { kind: 'tool', files }, scopeNote: `${files.length} file in scope` };
    }
    return { status: 'run', exec: { kind: 'tool', files: ['.'] }, scopeNote: 'intero repo (analisi whole-program)' };
  }

  return { status: 'run', exec: { kind: 'tool', files: ['.'] }, scopeNote: '' };
}

// ── Complessità (logica pura) ────────────────────────────────────────────────

/**
 * File esenti dall'analisi di complessità E dal conteggio churn: test, codice
 * generato, declaration file, cartelle build/vendored. Deterministico, 0 token:
 * la regex decide "è un test?", non l'LLM. Un test table-driven con un grosso
 * describe è legittimamente lungo — non va flaggato come debito.
 */
export const COMPLEXITY_EXCLUDE =
  /(?:^|[\\/])(?:node_modules|dist|build|out|coverage|vendor|\.next|\.nuxt)[\\/]|\.(?:test|spec)\.[cm]?[jt]sx?$|\.generated\.[^.]+$|\.d\.ts$|(?:^|[\\/])__tests__[\\/]/i;

/** Normalizzazione path di default (pura): slash unix + via il `./` iniziale. */
const normDefault = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** Primo intero in una stringa (il valore della metrica nei messaggi ESLint). */
function firstInt(s) {
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Grado di una funzione dalle sue metriche. Una metrica assente = non misurata
 * (undefined) → non contribuisce. SOLO la cognitive complexity può portare a
 * `block` (>25): è la metrica nesting-aware di SonarSource, l'unica che NON
 * penalizza uno switch piatto. CCN/nesting/nloc/params si fermano a `issue`,
 * così un dispatch table grande non fa scattare un refactor inutile.
 */
export function gradeFunction(m) {
  const cog = m.cognitive ?? 0;
  const ccn = m.ccn ?? 0;
  const nesting = m.nesting ?? 0;
  const nloc = m.nloc ?? 0;
  const params = m.params ?? 0;
  if (cog > 25) return 'block';
  if (cog > 15 || ccn > 10 || nesting > 4 || nloc > 60 || params > 5) return 'issue';
  if (cog > 10 || ccn > 8 || nesting > 3 || nloc > 50 || params > 4) return 'warn';
  return 'pass';
}

const RULE_METRIC = {
  'sonarjs/cognitive-complexity': 'cognitive',
  complexity: 'ccn',
  'max-depth': 'nesting',
  'max-nested-callbacks': 'nesting',
  'max-lines-per-function': 'nloc',
  'max-params': 'params',
};

/**
 * Funzioni flaggate da ESLint (`-f json`). Una sola metrica va estratta come
 * valore (la cognitive, per separare issue da block); per le altre il valore nel
 * messaggio basta a graduare. Raggruppa per file:riga (una funzione). `norm`
 * normalizza i path (default: slash + via `./`).
 */
export function parseEslintComplexity(jsonText, norm = normDefault) {
  let report;
  try { report = JSON.parse(jsonText); } catch { return []; }
  if (!Array.isArray(report)) return [];
  const byFn = new Map();
  for (const file of report) {
    const fp = norm(file.filePath || '');
    for (const msg of file.messages || []) {
      const metric = RULE_METRIC[msg.ruleId];
      if (!metric) continue;
      const value = firstInt(msg.message);
      if (value == null) continue;
      const key = `${fp}:${msg.line}`;
      const rec = byFn.get(key) || { file: fp, line: msg.line, fn: '' };
      rec[metric] = metric === 'nesting' ? Math.max(rec.nesting ?? 0, value) : value;
      byFn.set(key, rec);
    }
  }
  return [...byFn.values()];
}

/** Parser CSV minimale (gestisce le virgolette: i long-name lizard contengono virgole). */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === ',') { out.push(cur); cur = ''; }
    else if (c === '"') q = true;
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Funzioni da lizard (`--csv`, senza header). Colonne:
 * nloc,ccn,token,param,length,location,file,function,long_name,start,end.
 * lizard NON dà cognitive complexity → niente `block` da questo path (coerente:
 * il block resta riservato alla cognitive). Poliglotta (TS/JS/py/go/…).
 */
export function parseLizardCsv(csvText, norm = normDefault) {
  const out = [];
  for (const raw of csvText.split('\n')) {
    if (!raw.trim()) continue;
    const f = parseCsvLine(raw);
    if (f.length < 8) continue;
    const ccn = Number(f[1]);
    if (!Number.isFinite(ccn)) continue; // salta righe non-dato (header/summary)
    const start = Number(f[9]);
    out.push({
      file: norm(f[6] ?? ''),
      line: Number.isFinite(start) ? start : 0,
      fn: f[7] ?? '',
      ccn,
      nloc: Number(f[0]) || 0,
      params: Number(f[3]) || 0,
    });
  }
  return out;
}

/** Peso di una funzione per il ranking (cognitive se c'è, altrimenti CCN, altrimenti nloc). */
const weightOf = (f) => f.cognitive ?? f.ccn ?? f.nloc ?? 1;

/**
 * Top-N hotspot. Con churn disponibile: ordina per complessità×churn (Tornhill).
 * Senza storia git (clone shallow / repo fresco): churn vuoto → ordina per sola
 * complessità e MARCA `ranking:'complexity-only'`, così il report non dichiara un
 * incrocio col churn che non è avvenuto (determinismo: non mentire sul residuo).
 */
export function topHotspots(flagged, churn = new Map(), n = 5) {
  const hasChurn = churn && churn.size > 0;
  const scored = flagged.map((f) => {
    const c = hasChurn ? (churn.get(f.file) ?? 0) : 0;
    return {
      ...f,
      churn: c,
      score: hasChurn ? weightOf(f) * Math.max(c, 1) : weightOf(f),
      ranking: hasChurn ? 'churn-weighted' : 'complexity-only',
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}

/**
 * Riduce la lista di funzioni a: conteggi per grado, lista flaggata (grado≠pass),
 * top-5 hotspot, e uno stato `issue`/`pass` (i soli `warn` non fanno fallire).
 * Esclude deterministicamente test/generati/vendored.
 */
export function summarizeComplexity(funcs, churn = new Map()) {
  const counts = { warn: 0, issue: 0, block: 0 };
  const flagged = [];
  for (const f of funcs) {
    if (COMPLEXITY_EXCLUDE.test(f.file)) continue;
    const sev = gradeFunction(f);
    if (sev === 'pass') continue;
    counts[sev]++;
    flagged.push({ ...f, sev });
  }
  const actionable = flagged.filter((f) => f.sev !== 'warn');
  const hotspots = topHotspots(actionable.length ? actionable : flagged, churn, 5);
  const status = counts.block + counts.issue > 0 ? 'issue' : 'pass';
  return { counts, flagged, hotspots, status };
}

/**
 * Path che segnalano codice sensibile (auth/segreti/pagamenti/crypto/.env). La costituzione
 * §2 e orchestrazione §7 dicono: chi tocca questi file va a Opus + Security-auditor SEMPRE,
 * anche se il diff è piccolo. Match sul nome file → deterministico, 0 giudizio.
 */
export const SECURITY_PATH = /(?:auth|login|logout|signin|signup|session|token|secret|password|passwd|credential|oauth|jwt|saml|crypto|payment|billing|checkout|webhook|\.env)/i;

/**
 * Segnale di sicurezza per il routing, deterministico. Scatta se (a) un file del task
 * matcha un path sensibile, o (b) semgrep/gitleaks hanno flaggato (`toolFlag`). Il primo
 * è path-based (vale solo con `changed` noto: --staged/--since); il secondo è l'esito reale
 * dei tool di sicurezza. Entrambi forzano l'escalation in recommendRouting.
 */
export function securitySignal(changed = null, toolFlag = false) {
  const files = (changed ?? []).map(normDefault).filter((f) => SECURITY_PATH.test(f));
  return { sensitive: files.length > 0, files, toolFlag: Boolean(toolFlag) };
}

/**
 * Ponte complessità→tier reso DETERMINISTICO (routing-modelli.md §3.5): dal summary
 * deriva il modello e se serve un refactor dedicato, così l'LLM non applica la tabella
 * a mano (0 token di reasoning, scelta riproducibile). È "deterministico prima
 * dell'LLM" applicato alla decisione di routing stessa.
 *
 * `changed` (file del task, es. gli --staged/--since) restringe la valutazione ai
 * file toccati e alza a Specchio+Opus quando una top hotspot li interseca. Senza
 * `changed`, la raccomandazione è repo-wide (worst-grade).
 *
 *   block (cognitive>25) nel task  → Opus + refactor dedicato PRIMA della feature
 *   issue (cognitive 15-25/CCN>10) → Opus per l'edit di quel file
 *   issue che è anche top hotspot  → Specchio + Opus (il codice più rischioso)
 *   solo pass/warn                 → Sonnet (flusso normale)
 *
 * `security` (da securitySignal) è il SECONDO asse della costituzione: se scatta, ALZA a
 * Opus + Security-auditor + Specchio a prescindere dalla complessità — mai abbassa il tier
 * già derivato. Così il routing copre entrambi gli assi (complessità E sicurezza), non solo
 * il primo.
 */
export function recommendRouting(summary, changed = null, security = null) {
  const flagged = summary?.flagged ?? [];
  const changedSet = changed && changed.length
    ? new Set(changed.map((p) => normDefault(p)))
    : null;
  const inTask = (f) => !changedSet || changedSet.has(f.file);

  // Base dalla complessità.
  let base;
  const block = flagged.find((f) => f.sev === 'block' && inTask(f));
  const issue = block ? null : flagged.find((f) => f.sev === 'issue' && inTask(f));
  if (block) {
    base = {
      tier: 'opus', dedicatedRefactor: true, mirror: false,
      reason: `cognitive>25 (block) in ${block.file}:${block.line} — refactor dedicato, subagent Opus isolato prima della feature`,
    };
  } else if (issue) {
    const hot = (summary.hotspots ?? []).some((h) => h.ranking === 'churn-weighted' && inTask(h));
    base = {
      tier: 'opus', dedicatedRefactor: false, mirror: hot,
      reason: `complessità issue in ${issue.file}:${issue.line}${hot ? ' — è una top hotspot (churn×complessità): Specchio + Opus obbligati' : ' — Opus per l\'edit di quel file'}`,
    };
  } else {
    base = {
      tier: 'sonnet', dedicatedRefactor: false, mirror: false,
      reason: 'complessità nella norma (pass/warn) — Sonnet, flusso normale',
    };
  }

  // Override di sicurezza: alza, mai abbassa.
  if (security && (security.sensitive || security.toolFlag)) {
    const why = security.sensitive
      ? `il task tocca path sensibile (${security.files.slice(0, 3).join(', ')})`
      : 'semgrep/gitleaks hanno segnalato';
    return {
      tier: 'opus',
      dedicatedRefactor: base.dedicatedRefactor,
      mirror: true,
      securityReview: true,
      reason: `sicurezza: ${why} → Opus + Security-auditor + Specchio (costituzione §2, sempre) · [complessità: ${base.reason}]`,
    };
  }
  return { ...base, securityReview: false };
}
