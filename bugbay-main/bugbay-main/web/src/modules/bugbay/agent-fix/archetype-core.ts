/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CORE PURO del motore di ARCHETIPI (v1.0, fix concilio F4 — la feature richiesta:
 * "due bug in contesti diversi ma stessa problematica ad alto livello → estrai la
 * problematica, i casi diventano esempi"). Questa parte propone i CANDIDATI cluster
 * in modo deterministico e senza dipendenze (DB/LLM), così è unit-testabile dal
 * runner nativo `node:test`. La distillazione LLM dell'archetipo dal cluster vive in
 * `archetypes.ts` (shell I/O).
 *
 * SCELTA (con i limiti noti dal concilio): il clustering è Jaccard su token del testo
 * `reformulated`. Il concilio ha avvisato che Jaccard su testo corto SOTTO-clusterizza
 * i parafrasi e SOVRA-clusterizza sui token generici. Mitigazioni QUI: (1) stoplist di
 * token generici da fixer ("fix", "error", "bug"…) rimossi prima del confronto; (2)
 * soglia moderata; (3) Jaccard è solo il PROPONENTE di candidati — l'LLM in
 * `archetypes.ts` distilla/valida e può rifiutare un cluster incoerente. Non pretende
 * di essere il clustering finale: è il pre-filtro deterministico ed economico.
 * ponytail: Jaccard lessicale, non embedding — se la recall sui parafrasi diventa il
 * collo di bottiglia, il punto di upgrade è qui (similarità semantica) senza toccare
 * il resto della pipeline.
 *
 * @indice
 * - tokenizeReformulated → Set di token significativi (stoplist applicata)
 * - jaccard              → similarità di Jaccard tra due Set
 * - clusterCases         → PURA: componenti connesse per soglia, cluster ≥ minSize
 */

export interface ClusterInput {
  id: string;
  /** Testo inglese distillato del caso (campo `reformulated` dell'episodico). */
  reformulated: string;
}

export interface ClusterOptions {
  /** Soglia di Jaccard per collegare due casi (default 0.4). */
  jaccardThreshold?: number;
  /** Dimensione minima di un cluster per diventare archetipo (default 3). */
  minClusterSize?: number;
  /** Tetto di cluster ritornati (i più grandi prima; default 20). */
  maxClusters?: number;
}

export const CLUSTER_DEFAULTS: Required<ClusterOptions> = {
  jaccardThreshold: 0.4,
  minClusterSize: 3,
  maxClusters: 20,
};

// Token generici del dominio bug-fix: portano zero segnale di "quale problematica"
// e farebbero sovra-clusterizzare (il caso del concilio: "fix"/"error"/"bug"). Rimossi
// prima del confronto Jaccard. Minimale di proposito — inglese, perché `reformulated` è EN.
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'with', 'not', 'this', 'that', 'from', 'into', 'when', 'then', 'than',
  'fix', 'fixes', 'fixed', 'bug', 'bugs', 'error', 'errors', 'issue', 'issues', 'problem',
  'code', 'file', 'files', 'function', 'method', 'value', 'return', 'returns', 'should',
  'add', 'added', 'remove', 'removed', 'change', 'changed', 'update', 'updated', 'use', 'using',
]);

/** Token significativi di un testo `reformulated`: alfanumerici unicode, len>2, no stopword. */
export function tokenizeReformulated(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (raw.length > 2 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/** Similarità di Jaccard |A∩B| / |A∪B|; due set vuoti → 0 (nessun segnale). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * PURA. Propone i cluster candidati come COMPONENTI CONNESSE del grafo in cui due
 * casi sono collegati se Jaccard(token) ≥ soglia. Deterministica: casi ordinati per
 * id, union-find stabile, cluster ordinati per dimensione desc (tie-break: primo id).
 * Ritorna solo i cluster con almeno `minClusterSize` membri, fino a `maxClusters`.
 */
export function clusterCases(
  cases: ClusterInput[],
  options?: ClusterOptions,
): string[][] {
  const opts = { ...CLUSTER_DEFAULTS, ...(options ?? {}) };
  const items = [...cases].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = items.length;
  if (n < opts.minClusterSize) return [];

  const tokens = items.map((c) => tokenizeReformulated(c.reformulated));

  // Union-find (path compression + union by index-basso stabile).
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent[rb] = ra; else parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (jaccard(tokens[i], tokens[j]) >= opts.jaccardThreshold) union(i, j);
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = groups.get(r);
    if (arr) arr.push(items[i].id); else groups.set(r, [items[i].id]);
  }

  const clusters = [...groups.values()]
    .filter((g) => g.length >= opts.minClusterSize)
    .map((g) => [...g].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  clusters.sort((a, b) => (b.length !== a.length ? b.length - a.length : a[0] < b[0] ? -1 : 1));
  return clusters.slice(0, opts.maxClusters);
}
