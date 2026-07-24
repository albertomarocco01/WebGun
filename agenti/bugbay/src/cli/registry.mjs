/**
 * Registro locale dei progetti BugBay (hub multi-repo). Mappa project_id → percorso
 * del repo sul QUESTO pc, così un unico daemon "hub" può instradare il fix di una
 * segnalazione al repo giusto. Vive in ~/.bugbay/registry.json (una sola copia per
 * macchina), aggiornato da ogni `bugbay dev` che si auto-registra all'avvio.
 *
 * REGOLA: BugBay e i progetti devono stare sullo STESSO pc — i path qui sono locali
 * e validi solo su questa macchina.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const REGISTRY_DIR = path.join(os.homedir(), '.bugbay');
export const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');
// Credenziali di MACCHINA (una sola volta, condivise da tutti i progetti):
// Supabase hub + chiavi LLM per riformulazione/fix. Fuori da ogni repo, mai
// committabili. I .env.local di progetto, se presenti, hanno la precedenza.
export const MACHINE_ENV_FILE = path.join(REGISTRY_DIR, 'env.json');

/** Legge le credenziali di macchina ({} se assenti/corrotte). */
export function readMachineEnv() {
  try {
    const e = JSON.parse(fs.readFileSync(MACHINE_ENV_FILE, 'utf8'));
    return e && typeof e === 'object' ? e : {};
  } catch {
    return {};
  }
}

/** Upsert delle credenziali di macchina (i valori vuoti non sovrascrivono). */
export function writeMachineEnv(patch) {
  const next = { ...readMachineEnv() };
  for (const [k, v] of Object.entries(patch || {})) if (v) next[k] = v;
  try {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    fs.writeFileSync(MACHINE_ENV_FILE, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 }); // mode ignorato su Windows
  } catch {
    /* best-effort */
  }
}

/**
 * Percorso del certificato CA aziendale per attraversare un proxy che ispeziona il
 * TLS su QUESTA macchina. Precedenza: env di processo `NODE_EXTRA_CA_CERTS` >
 * `~/.bugbay/env.json` (chiave `NODE_EXTRA_CA_CERTS`). Ritorna `{ path, source }`
 * oppure `null` se non configurato.
 *
 * SICUREZZA: non disabilita MAI la verifica TLS. Il CA viene AGGIUNTO al trust
 * store (non lo rimpiazza). Senza CA il chiamante deve fallire con istruzioni —
 * mai ripiegare disabilitando la verifica del certificato.
 */
export function resolveCaCert() {
  const fromEnv = String(process.env.NODE_EXTRA_CA_CERTS || '').trim();
  if (fromEnv) return { path: path.resolve(fromEnv), source: "variabile d'ambiente NODE_EXTRA_CA_CERTS" };
  const fromMachine = String(readMachineEnv().NODE_EXTRA_CA_CERTS || '').trim();
  if (fromMachine) return { path: path.resolve(fromMachine), source: `${MACHINE_ENV_FILE} → NODE_EXTRA_CA_CERTS` };
  return null;
}

/**
 * Istruzioni azionabili (una riga per elemento) da mostrare quando un install npm
 * fallisce e nessun CA è configurato. È una dipendenza umana esplicita (come la
 * rotazione delle chiavi): la si espone, non la si aggira riabilitando TLS off.
 */
export function caSetupInstructions() {
  return [
    'Sembra un errore di certificato TLS (probabile proxy che ispeziona il traffico).',
    'BugBay NON disabilita più la verifica TLS: fornisci il certificato CA aziendale (PEM).',
    '  • Opzione A — per sessione:  imposta NODE_EXTRA_CA_CERTS al path del CA e rilancia.',
    `  • Opzione B — per macchina:  aggiungi "NODE_EXTRA_CA_CERTS": "C:/percorso/ca.pem"`,
    `      in ${MACHINE_ENV_FILE}`,
    'Il CA viene aggiunto al trust store (non lo rimpiazza); poi ripeti il comando.',
  ];
}

export function readRegistry() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    return r && typeof r === 'object' ? r : { version: 1, projects: {} };
  } catch {
    return { version: 1, projects: {} };
  }
}

/**
 * Registra/aggiorna un progetto: project_id → { root, writeScope, sensitiveFiles }.
 * Best-effort: se il file non è scrivibile non blocca l'avvio del daemon.
 */
export function registerProject({ id, name, root, writeScope, sensitiveFiles }) {
  if (!id || !root) return;
  const reg = readRegistry();
  if (!reg.projects || typeof reg.projects !== 'object') reg.projects = {};
  reg.projects[String(id)] = {
    name: name || '',
    root: path.resolve(root),
    writeScope: Array.isArray(writeScope) && writeScope.length ? writeScope : ['src/**'],
    sensitiveFiles: Array.isArray(sensitiveFiles) ? sensitiveFiles : [],
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2) + '\n');
  } catch {
    /* best-effort */
  }
}
