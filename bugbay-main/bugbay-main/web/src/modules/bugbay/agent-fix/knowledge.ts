/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * SUPERFICIE SEMANTICA UNICA (v0.8, TRACK A) — i bullet ACE come file markdown in
 * `.bugbay/knowledge/*.md`: frontmatter gray-matter (metadati tipizzati) + corpo
 * (l'insight riusabile). NIENTE tabella `memory_history`: git È la storia. Questo
 * modulo è il MOTORE di I/O della base di conoscenza — scrittura, lettura e
 * commit — mentre `ace.ts` distilla i bullet dal verdetto e li orchestra.
 *
 * INVARIANTI (load-bearing, dal design memo):
 *  - QUARANTENA del bullet malformato: sia in SCRITTURA (candidato invalido →
 *    skip+log, mai scritto) sia in LETTURA (file non parsabile / campi mancanti →
 *    spostato in `.bugbay/knowledge-quarantine/` + log, MAI un crash del parser).
 *  - COMMITTER DEDICATO: i commit dei file di conoscenza usano un'IDENTITÀ BOT
 *    (`-c user.name`/`-c user.email`, nessuna mutazione della config utente), MAI
 *    l'identità git dell'utente.
 *  - MAI il source tree: il commit è confinato al SOLO pathspec
 *    `.bugbay/knowledge` (force-add oltre il .gitignore di `.bugbay`), così un fix
 *    non committato dell'agente nel working tree non viene mai toccato.
 *  - Radice STABILE: la conoscenza vive sotto `bugbayDataDir()` (il target reale
 *    via env, condiviso da tutte le run), NON nel worktree isolato di una run.
 *
 * @indice
 * - KnowledgeBullet → bullet tipizzato (frontmatter + insight)
 * - knowledgeDir    → cartella della base di conoscenza (`.bugbay/knowledge`)
 * - writeBullet     → scrive un bullet (quarantena + gate segreti), ritorna il path o null
 * - loadBullets     → legge i bullet (quarantena in lettura), mai un crash
 * - commitKnowledge → commit del solo pathspec conoscenza sotto identità bot
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import matter from 'gray-matter';
import { bugbayDataDir } from './target-root';
import { containsSecret } from './secret-scan';
import type { VerdictSource } from './distill';

export interface KnowledgeBullet {
  id: string;
  /** project_id della run (o 'general' se assente): raggruppa i bullet per repo. */
  project: string;
  report: string | null;
  run: string | null;
  /** Verdetto grezzo (es. 'approved'|'merged'|'discarded'|'fail'). */
  verdict: string;
  source: VerdictSource;
  /** Polarità derivata: un fix che ha funzionato vs uno da evitare. */
  outcome: 'positive' | 'negative';
  files: string[];
  tags: string[];
  /** ISO. */
  created: string;
  /** Corpo del bullet: l'insight riusabile in markdown. */
  insight: string;
}

// Identità del committer dei file di conoscenza: NON quella dell'utente. Passata
// via `-c` sul singolo comando (nessuna mutazione di ~/.gitconfig né del repo).
const BOT_NAME = 'BugBay Memory Bot';
const BOT_EMAIL = 'memory-bot@bugbay.local';

/** Cartella della base di conoscenza: `<target>/.bugbay/knowledge`. */
export function knowledgeDir(): string {
  return path.join(bugbayDataDir(), 'knowledge');
}

/** Cartella di quarantena, SIBLING (fuori) di knowledgeDir → mai committata. */
function quarantineDir(): string {
  return path.join(bugbayDataDir(), 'knowledge-quarantine');
}

/** Radice del repo che ospita `.bugbay` (cwd delle op git). */
function repoRoot(): string {
  return path.dirname(bugbayDataDir());
}

/** Slug sicuro per nome file/cartella (project). */
function slug(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || 'general';
}

// Validazione = gate della quarantena. Un bullet è valido solo se tutti i campi
// load-bearing sono presenti e sani; altrimenti è "malformato" (skip+log).
const SOURCES: ReadonlySet<string> = new Set(['HUMAN', 'JUDGE', 'IMPLICIT']);
function isValidBullet(b: Partial<KnowledgeBullet> | null | undefined): b is KnowledgeBullet {
  if (!b) return false;
  return (
    typeof b.id === 'string' && b.id.trim().length > 0 &&
    typeof b.project === 'string' && b.project.trim().length > 0 &&
    typeof b.verdict === 'string' && b.verdict.trim().length > 0 &&
    typeof b.source === 'string' && SOURCES.has(b.source) &&
    (b.outcome === 'positive' || b.outcome === 'negative') &&
    typeof b.created === 'string' && b.created.trim().length > 0 &&
    typeof b.insight === 'string' && b.insight.trim().length > 0
  );
}

/** Frontmatter → bullet (coercizioni difensive; array normalizzati). */
function toBullet(data: Record<string, unknown>, content: string): Partial<KnowledgeBullet> {
  const asArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  const asStr = (v: unknown): string | null =>
    v == null ? null : typeof v === 'string' ? v : String(v);
  return {
    id: asStr(data.id) ?? '',
    project: asStr(data.project) ?? '',
    report: asStr(data.report),
    run: asStr(data.run),
    verdict: asStr(data.verdict) ?? '',
    source: (asStr(data.source) ?? '') as VerdictSource,
    outcome: (data.outcome === 'negative' ? 'negative' : 'positive'),
    files: asArr(data.files),
    tags: asArr(data.tags),
    created: asStr(data.created) ?? '',
    insight: content.trim(),
  };
}

/**
 * Scrive un bullet come file gray-matter (`<project>/<id>.md`). QUARANTENA in
 * scrittura: un candidato malformato è saltato con log — MAI scritto, MAI un
 * throw. Ritorna il path scritto, o null se scartato/errore.
 */
export function writeBullet(b: KnowledgeBullet): string | null {
  const shownId = typeof b?.id === 'string' && b.id ? b.id : '(no id)';
  if (!isValidBullet(b)) {
    console.warn('[bugbay:ace] bullet malformato, scartato (quarantena scrittura):', shownId);
    return null;
  }
  try {
    const dir = path.join(knowledgeDir(), slug(b.project));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${b.id}.md`);
    const frontmatter = {
      id: b.id,
      project: b.project,
      report: b.report,
      run: b.run,
      verdict: b.verdict,
      source: b.source,
      outcome: b.outcome,
      files: b.files,
      tags: b.tags,
      created: b.created,
    };
    const doc = matter.stringify(`\n${b.insight.trim()}\n`, frontmatter);
    // Gate segreti PRIMA di scrivere: se un segreto è nel contenuto, il file non
    // esiste → non c'è nulla da force-add/committare (la falla si chiude a monte).
    if (containsSecret(doc)) {
      console.warn('[bugbay:ace] bullet con possibile segreto, scartato (mai scritto né committato):', b.id);
      return null;
    }
    fs.writeFileSync(file, doc, 'utf-8');
    return file;
  } catch (e) {
    console.warn('[bugbay:ace] scrittura bullet fallita (best-effort):', String(e));
    return null;
  }
}

/** Elenco ricorsivo dei `*.md` sotto `dir` (dir assente → []). */
function listMarkdown(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(full));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Sposta un file malformato in quarantena (o lo lascia, loggando) — mai un throw. */
function quarantine(file: string, reason: string): void {
  try {
    const qdir = quarantineDir();
    fs.mkdirSync(qdir, { recursive: true });
    const dest = path.join(qdir, `${Date.now()}-${path.basename(file)}`);
    fs.renameSync(file, dest);
    console.warn(`[bugbay:ace] bullet malformato in quarantena (${reason}): ${path.basename(file)}`);
  } catch (e) {
    console.warn(`[bugbay:ace] quarantena fallita per ${file} (${reason}): ${String(e)}`);
  }
}

/**
 * Legge i bullet dalla base di conoscenza (opz. per singolo project). QUARANTENA
 * in lettura: un file non parsabile o con campi mancanti viene spostato in
 * quarantena + log e la lettura PROSEGUE — un bullet corrotto non blocca mai il
 * recupero degli altri. Non lancia mai.
 */
export function loadBullets(project?: string): KnowledgeBullet[] {
  const root = project ? path.join(knowledgeDir(), slug(project)) : knowledgeDir();
  const out: KnowledgeBullet[] = [];
  for (const file of listMarkdown(root)) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = matter(raw);
      const bullet = toBullet(parsed.data, parsed.content);
      if (!isValidBullet(bullet)) {
        quarantine(file, 'campi frontmatter mancanti/invalidi');
        continue;
      }
      out.push(bullet);
    } catch (e) {
      quarantine(file, `parse: ${String(e)}`);
    }
  }
  return out;
}

/** Path posix del pathspec conoscenza, relativo alla radice del repo. */
function knowledgeRel(): string {
  return path.relative(repoRoot(), knowledgeDir()).split(path.sep).join('/') || '.bugbay/knowledge';
}

function git(args: string[]): { ok: boolean; out: string } {
  const res = spawnSync('git', args, { cwd: repoRoot(), encoding: 'utf-8', timeout: 20_000 });
  return { ok: res.status === 0, out: (res.stdout ?? '') + (res.stderr ?? '') };
}

/**
 * Committa il SOLO pathspec `.bugbay/knowledge` sotto l'identità bot dedicata.
 * - Confinato al pathspec: MAI il source tree (un fix non committato è al sicuro).
 * - `add -f`: `.bugbay` è tipicamente gitignorato (contiene il daemon-token) — la
 *   conoscenza è l'ECCEZIONE voluta che entra in git; il force-add è confinato al
 *   solo pathspec conoscenza, mai a `.bugbay` intero.
 * - Identità via `-c`: nessuna mutazione di config. Se non siamo in un repo o non
 *   c'è nulla da committare → no-op silenzioso (best-effort, mai un throw).
 * Ritorna true se un commit è stato creato.
 */
export function commitKnowledge(message: string): boolean {
  try {
    if (!git(['rev-parse', '--is-inside-work-tree']).ok) return false;
    const rel = knowledgeRel();
    git(['add', '-f', '--', rel]);
    if (!git(['status', '--porcelain', '--', rel]).out.trim()) return false; // nulla da committare
    const res = git([
      '-c', `user.name=${BOT_NAME}`,
      '-c', `user.email=${BOT_EMAIL}`,
      '-c', 'commit.gpgsign=false',
      'commit', '-m', message, '--', rel,
    ]);
    return res.ok;
  } catch (e) {
    console.warn('[bugbay:ace] commit conoscenza fallito (best-effort):', String(e));
    return false;
  }
}
