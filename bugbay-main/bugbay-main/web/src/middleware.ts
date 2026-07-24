/**
 * Autenticazione delle API del daemon (P0 sicurezza — T1+T2).
 *
 * Minaccia: il daemon gira in locale (bind 127.0.0.1) ma espone la console, le
 * API e l'agente che EDITA il repo. Un sito remoto aperto nel browser dello
 * sviluppatore — o un'ALTRA app in ascolto su localhost — può scriptare
 * `fetch('http://localhost:PORT/...')` e, senza autenticazione, pilotare l'agente
 * o rubare le chiavi LLM. Vettori:
 *   1. cross-site diretto: JS su evil.com chiama http://localhost:PORT.
 *   2. same-site loopback: un'altra app su localhost:ALTRA-PORTA (Origin loopback!)
 *      chiama il daemon → la vecchia guardia "Origin loopback" la lasciava passare.
 *   3. DNS rebinding: evil.com punta un sotto-dominio a 127.0.0.1 → arriva col
 *      Host dell'attaccante.
 *   4. client non-browser (curl, script) senza Origin né Fetch-Metadata.
 *
 * L'Origin/Fetch-Metadata NON è autenticazione (l'accetta qualunque origine
 * loopback, ha buchi sui client senza header). La difesa reale è un BEARER TOKEN
 * per-daemon. Regole:
 *   - **Host loopback obbligatorio** su ogni route (blocca il rebinding: arriva
 *     con Host=attacker → rifiutato).
 *   - **Route privilegiate** (spawn/edit/lettura-run/mutazioni: /api/agent-fix,
 *     /api/audits, /api/debug-checklist, /api/debug-upload e GET/PUT/DELETE di
 *     /api/debug-reports): richiedono la console di PRIMA PARTE
 *     (Sec-Fetch-Site: same-origin — impostato dal browser, NON falsificabile da
 *     una pagina cross-site/same-site) OPPURE un `Authorization: Bearer <token>`
 *     valido. Mancante/errato → 401. Un'altra app su localhost è `same-site` (non
 *     `same-origin`) → deve presentare il token.
 *   - **Unica carve-out pubblica**: POST /api/debug-reports (submit del widget),
 *     raggiungibile senza token dal widget embeddato; mantiene però la difesa
 *     Origin/host-loopback contro l'invio cross-site (spam / ingest LLM a costo).
 *
 * Il token per-daemon è generato/letto dalla CLI (`readOrCreateToken`,
 * <dataDir>/daemon-token) e passato al daemon via `BUGBAY_DAEMON_TOKEN`: nessun
 * secondo secret store. Nessun cookie/credenziale in gioco.
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from '@/modules/bugbay/agent-fix/constant-time';

/** true se l'hostname è un indirizzo di loopback (localhost / 127.x / ::1). */
function isLoopback(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h);
}

/** Estrae l'hostname (senza porta) da un header Host tipo "localhost:7331". */
function hostnameOf(hostHeader: string): string {
  const m = hostHeader.match(/^(\[[^\]]+\]|[^:]+)(:\d+)?$/);
  return m ? m[1] : hostHeader;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = process.env.BUGBAY_ALLOWED_ORIGIN;
  let acao = '';
  if (allowed) {
    const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && list.includes(origin)) acao = origin;
  } else if (origin) {
    acao = origin; // eco: il gate auth/host blocca i non autorizzati prima
  }
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bugbay-token',
    Vary: 'Origin',
  };
  if (acao) h['Access-Control-Allow-Origin'] = acao;
  return h;
}

/**
 * Gate Origin/Fetch-Metadata loopback: usato SOLO per la carve-out pubblica
 * (submit del widget). Ammette le richieste con Origin loopback o — in assenza di
 * Origin — quelle che Fetch-Metadata non marca come cross/same-site. NON è usato
 * per le route privilegiate: lì serve same-origin stretto o il token.
 */
function originIsFirstParty(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (origin) {
    try { return isLoopback(new URL(origin).hostname); } catch { return false; }
  }
  const site = req.headers.get('sec-fetch-site');
  return site !== 'cross-site' && site !== 'same-site';
}

export function middleware(req: Request) {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  // Preflight: non trasporta credenziali → rispondi sempre.
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: cors });

  // 1) Host DEVE essere loopback (blocca DNS rebinding: arriverebbe con Host=attacker).
  if (!isLoopback(hostnameOf(req.headers.get('host') || ''))) {
    return NextResponse.json({ error: 'Origine non autorizzata.' }, { status: 403, headers: cors });
  }

  // Bearer token per-daemon (o header legacy x-bugbay-token, retro-compat widget ?t=).
  const token = process.env.BUGBAY_DAEMON_TOKEN || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
  const legacy = req.headers.get('x-bugbay-token') || '';
  // Confronto a tempo costante: `===` corto-circuita → oracolo di timing su host
  // multi-utente. token vuoto/assente → mai match (fail-closed su token mancante).
  const tokenOk = token.length > 0 && (timingSafeEqual(bearer, token) || timingSafeEqual(legacy, token));

  // Unica route PUBBLICA: il submit del widget (POST /api/debug-reports). Le altre
  // verb su debug-reports (GET/PUT/DELETE: elenco/modifica/eliminazione) sono
  // privilegiate come il resto.
  const isPublicReport = req.method === 'POST' && new URL(req.url).pathname === '/api/debug-reports';

  if (isPublicReport) {
    // Il widget (dev) POSTA con Origin loopback e senza token: mantiene la difesa
    // Origin/host-loopback contro l'invio cross-site, senza richiedere il bearer.
    if (!originIsFirstParty(req) && !tokenOk) {
      return NextResponse.json({ error: 'Origine non autorizzata.' }, { status: 403, headers: cors });
    }
  } else {
    // ROUTE PRIVILEGIATE: console di prima parte (same-origin, non falsificabile da
    // una pagina cross-site/same-site) OPPURE bearer token valido.
    // NB (modello di minaccia): `Sec-Fetch-Site: same-origin` è una difesa CSRF
    // (blocca l'attaccante-BROWSER remoto/cross-site), NON un'autenticazione: un
    // processo LOCALE non-browser può falsificare l'header. Su macchina mono-utente è
    // dentro il perimetro di fiducia (può leggere il daemon-token 0600). Il residuo
    // reale è un host MULTI-utente: un altro utente forgia l'header senza il token.
    // Chiuderlo del tutto richiede il bearer su ogni route + token iniettato nella
    // console (trade-off: espone il token a un XSS same-origin) — scelta rimandata.
    const sameOrigin = req.headers.get('sec-fetch-site') === 'same-origin';
    if (!sameOrigin && !tokenOk) {
      return NextResponse.json({ error: 'Autenticazione richiesta.' }, { status: 401, headers: cors });
    }
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: '/api/:path*' };
