/**
 * BugBay — widget flottante servito dal daemon. Web component in Shadow DOM
 * (non eredita né inquina il CSS dell'host): funziona in QUALSIASI framework,
 * caricato via <script type="module"> da http://localhost:7331/bugbay-widget.js.
 * Replica il look del widget originale (modal centrato, pill categoria/priorità,
 * URL auto, descrizione) e invia a /api/debug-reports del daemon.
 * ponytail: niente dettatura vocale / riformula-AI / allegati (servono API extra);
 *           aggiungili se servono davvero.
 */
const SRC = new URL(import.meta.url);
const DAEMON = new URL('.', SRC).origin;
// Token opzionale dallo src dello script (?t=...): serve solo per embedding
// genuinamente cross-site. Sull'app host in localhost il daemon autorizza via
// Fetch-Metadata (same-site) e il token resta vuoto.
const TOKEN = SRC.searchParams.get('t') || '';
// Identità del progetto (?p=<projectId>): il daemon centrale (hub) tagga la
// segnalazione col progetto giusto anche quando serve PIÙ app insieme.
const PROJECT = SRC.searchParams.get('p') || '';
const HEADERS = TOKEN
  ? { 'Content-Type': 'application/json', 'x-bugbay-token': TOKEN }
  : { 'Content-Type': 'application/json' };

// Modalità HOSTED: se l'app host definisce window.BUGBAY = { supabaseUrl, anonKey,
// projectId }, il widget scrive DIRETTAMENTE su Supabase (PostgREST) con la anon key.
// Serve alle app DEPLOYATE, i cui utenti non raggiungono il daemon locale (loopback).
// Letta con una FUNZIONE (non a livello di modulo): una copia in cache del browser
// può eseguire prima dello script inline che definisce window.BUGBAY.
const cfg = () => (typeof window !== 'undefined' && window.BUGBAY) || null;
const hosted = () => { const c = cfg(); return !!(c && c.supabaseUrl && c.anonKey); };
// Widget servito dall'app stessa (install online, file in public/): il fallback
// "daemon" NON esiste — POSTare alla propria origin darebbe solo il 404 dell'app.
const SAME_ORIGIN = typeof location !== 'undefined' && DAEMON === location.origin;
const CFG = cfg();
const HOSTED = hosted();

const CATEGORIES = [
  { key: 'Bug', label: 'Bug', on: 'background:#ef4444;color:#fff;border-color:#b91c1c' },
  { key: 'Miglioria Proposta', label: 'Miglioria UX', on: 'background:#f97316;color:#fff;border-color:#c2410c' },
  { key: 'Nuova Feature', label: 'Nuova Feature', on: 'background:#22c55e;color:#062b14;border-color:#15803d' },
];
const PRIORITIES = [
  { key: 'Bassa', label: 'Bassa', dot: '#22c55e' },
  { key: 'Media', label: 'Media', dot: '#fbbf24' },
  { key: 'Alta', label: 'Alta', dot: '#f97316' },
  { key: 'Urgente', label: 'Urgente', dot: '#ef4444' },
  { key: 'Critica', label: 'Critica', dot: '#ef4444' },
];
const LOGO = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path fill="currentColor" d="M10 3 H21.2 L20.8 9.5 L14.8 12.4 L17 14.4 L15.6 18 L15 24 L17.6 30 L24 33.4 L30.4 30 L33 24 L32.4 18 L31 14.4 L33.2 12.4 L27.2 9.5 L26.8 3 H38 Q45 3 45 10 L45 38 Q45 45 38 45 L10 45 Q3 45 3 38 L3 10 Q3 3 10 3 Z M24 11.4 L26 12.6 L25.3 14.7 L22.7 14.7 L22 12.6 Z"/></svg>';

class BugBayWidget extends HTMLElement {
  connectedCallback() {
    this.cat = 'Bug';
    this.pri = 'Media';
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: system-ui, sans-serif; }
        .fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
          width: 56px; height: 56px; border-radius: 50%; border: 1.5px solid rgba(0,0,0,.3); cursor: pointer;
          background: #f5a524; color: #1a1a1a; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 22px rgba(245,165,36,.5); transition: transform .15s ease; }
        .fab:hover { transform: scale(1.07); }
        .fab svg { width: 32px; height: 32px; }
        .overlay { position: fixed; inset: 0; z-index: 2147483000; display: none;
          align-items: center; justify-content: center; padding: 16px;
          background: rgba(17,17,20,.6); backdrop-filter: blur(3px); }
        .overlay.open { display: flex; }
        .modal { width: 100%; max-width: 560px; max-height: 88vh; overflow-y: auto;
          background: #16161d; color: #e5e7eb; border: 1px solid #2a2a35; border-radius: 14px;
          box-shadow: 0 18px 50px rgba(0,0,0,.6); }
        .head { display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid #24242e; background: rgba(0,0,0,.25); }
        .head .t { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: #fff; }
        .head .t svg { width: 22px; height: 22px; color: #f5a524; }
        .badge { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 99px; background: rgba(180,120,20,.2); color: #f5a524; border: 1px solid rgba(180,120,20,.35); }
        .x { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 20px; line-height: 1; padding: 4px; border-radius: 6px; }
        .x:hover { background: #24242e; color: #fff; }
        .body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
        label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; display: block; margin-bottom: 7px; }
        .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
        .grid5 { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; }
        .pill { padding: 9px 6px; font-size: 12px; font-weight: 600; border-radius: 8px; cursor: pointer;
          background: #1f1f29; border: 1px solid #2a2a35; color: #9ca3af; text-align: center; transition: all .12s; }
        .pill:hover { color: #e5e7eb; border-color: #3a3a47; }
        .pill.sel { background: #312e81; color: #fff; border-color: #4f46e5; }
        .pill .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
        input, textarea { width: 100%; background: #0f0f14; color: #e5e7eb; border: 1px solid #2a2a35;
          border-radius: 8px; padding: 9px 11px; font: inherit; font-size: 13px; }
        input:focus, textarea:focus { outline: none; border-color: #4f46e5; }
        input[readonly] { color: #6b7280; border-style: dashed; font-family: ui-monospace, monospace; font-size: 12px; }
        textarea { min-height: 96px; resize: vertical; line-height: 1.5; }
        .foot { display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px; }
        .btn { padding: 9px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-radius: 8px; cursor: pointer; border: none; }
        .btn.ghost { background: none; color: #9ca3af; } .btn.ghost:hover { color: #fff; }
        .btn.send { background: #ef4444; color: #fff; } .btn.send:hover { background: #b91c1c; }
        .btn:disabled { opacity: .4; cursor: default; }
        .status { font-size: 12px; min-height: 16px; } .ok { color: #34d399; } .err { color: #f87171; }
        .lblrow { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .lblrow label { margin: 0; }
        .wand { background: #0f0f14; border: 1px solid #1e3a5f; color: #7dd3fc; font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 7px; cursor: pointer; }
        .wand:hover { background: #0c2030; color: #bae6fd; } .wand:disabled { opacity: .6; cursor: wait; }
      </style>
      <button class="fab" title="BugBay — segnala un problema" aria-label="Segnala a BugBay">${LOGO}</button>
      <div class="overlay">
        <div class="modal">
          <div class="head">
            <div class="t">${LOGO}<span>Segnala un problema</span><span class="badge">${HOSTED ? 'Feedback' : 'Local Debug'}</span></div>
            <button class="x" aria-label="Chiudi">✕</button>
          </div>
          <div class="body">
            <div><label>Categoria *</label><div class="grid3 cats"></div></div>
            <div><label>Priorità / Gravità *</label><div class="grid5 pris"></div></div>
            <div><label>URL riferimento · automatico</label><input class="url" readonly /></div>
            <div><label>Segnalato da</label><input class="rep" value="${HOSTED ? '' : 'Sviluppatore'}" placeholder="Nome (facoltativo)" /></div>
            <div>
              <div class="lblrow"><label>Descrizione del bug / problema *</label>
                ${HOSTED ? '' : '<button class="wand" type="button" title="Riformula con AI">✨ Riformula</button>'}</div>
              <textarea class="notes" placeholder="Cosa succede? Quali passaggi portano all'errore?"></textarea></div>
            <div class="status"></div>
            <div class="foot">
              <button class="btn ghost close">Annulla</button>
              <button class="btn send">Invia segnalazione</button>
            </div>
          </div>
        </div>
      </div>`;

    const $ = (s) => root.querySelector(s);
    this.root = root;
    // pill categoria
    $('.cats').innerHTML = CATEGORIES.map((c) => `<button class="pill" data-k="${c.key}" data-on="${c.on}">${c.label}</button>`).join('');
    $('.pris').innerHTML = PRIORITIES.map((p) => `<button class="pill" data-k="${p.key}"><span class="dot" style="background:${p.dot}"></span>${p.label}</button>`).join('');
    this.paintCats(); this.paintPris();
    $('.cats').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { this.cat = b.dataset.k; this.paintCats(); } });
    $('.pris').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { this.pri = b.dataset.k; this.paintPris(); } });
    $('.fab').addEventListener('click', () => this.open());
    $('.x').addEventListener('click', () => this.close());
    $('.close').addEventListener('click', () => this.close());
    $('.overlay').addEventListener('click', (e) => { if (e.target === $('.overlay')) this.close(); });
    $('.send').addEventListener('click', () => this.submit());
    const wand = $('.wand'); // assente in modalità hosted (niente daemon/LLM)
    if (wand) wand.addEventListener('click', () => this.reformulate());
  }

  async reformulate() {
    const $ = (s) => this.root.querySelector(s);
    const w = $('.wand'); const ta = $('.notes'); const status = $('.status');
    const v = ta.value.trim();
    if (!v) { status.className = 'status err'; status.textContent = 'Scrivi prima qualcosa da riformulare.'; return; }
    const label = w.textContent; w.disabled = true; w.textContent = '… in corso';
    status.className = 'status'; status.textContent = '';
    try {
      const res = await fetch(`${DAEMON}/api/agent-fix`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          action: 'reformulate',
          notes: v,
          itemLabel: 'Descrizione segnalazione',
          itemDesc: `Segnalazione ${this.cat}`,
          itemPath: location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.proposta) { ta.value = data.proposta.trim(); status.className = 'status ok'; status.textContent = '✓ Riformulato con AI.'; }
      else { status.className = 'status err'; status.textContent = 'Nessun testo prodotto.'; }
    } catch (e) {
      status.className = 'status err';
      status.textContent = `Riformula fallita: ${e.message}`;
    } finally {
      w.disabled = false; w.textContent = label;
    }
  }

  paintCats() {
    this.root.querySelectorAll('.cats .pill').forEach((b) => {
      const on = b.dataset.k === this.cat;
      b.classList.toggle('sel', on);
      b.setAttribute('style', on ? b.dataset.on : '');
    });
  }
  paintPris() {
    this.root.querySelectorAll('.pris .pill').forEach((b) => b.classList.toggle('sel', b.dataset.k === this.pri));
  }
  open() {
    this.root.querySelector('.url').value = location.href;
    this.root.querySelector('.overlay').classList.add('open');
  }
  close() { this.root.querySelector('.overlay').classList.remove('open'); }

  async submit() {
    const $ = (s) => this.root.querySelector(s);
    const btn = $('.send'); const status = $('.status');
    const notes = $('.notes').value.trim();
    if (!notes) { status.className = 'status err'; status.textContent = 'Inserisci una descrizione.'; return; }
    // Ricontrolla la config AL MOMENTO dell'invio (robusto a ordini di esecuzione).
    const conf = cfg(); const isHosted = hosted();
    if (isHosted && !conf.projectId) { status.className = 'status err'; status.textContent = 'Config BugBay incompleta: manca projectId.'; return; }
    if (!isHosted && SAME_ORIGIN) {
      // Install online senza window.BUGBAY visibile: dirlo chiaro, invece di
      // POSTare all'app host e mostrare un 404 fuorviante.
      status.className = 'status err';
      status.textContent = 'Config BugBay mancante: lo script inline window.BUGBAY non è stato eseguito (snippet assente o bloccato dalla CSP).';
      return;
    }
    btn.disabled = true; status.className = 'status'; status.textContent = 'Invio...';
    try {
      let res;
      if (isHosted) {
        // Insert DIRETTO su Supabase (PostgREST) con la anon key. La RLS insert-only
        // vincola i valori (status forzato 'Aperto' dal default, project_id obbligatorio).
        res = await fetch(`${conf.supabaseUrl.replace(/\/+$/, '')}/rest/v1/debug_reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: conf.anonKey,
            Authorization: `Bearer ${conf.anonKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            project_id: conf.projectId,
            category: this.cat,
            priority: this.pri,
            area: location.pathname || '/',
            url: location.href,
            notes,
            reporter_name: $('.rep').value.trim() || 'anonimo',
          }),
        });
      } else {
        res = await fetch(`${DAEMON}/api/debug-reports`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            // Il daemon centrale (hub) usa projectId per attribuire la segnalazione
            // all'app giusta; senza (install vecchi) usa il progetto del daemon.
            projectId: PROJECT || undefined,
            category: this.cat,
            priority: this.pri,
            notes,
            url: location.href,
            reporterName: $('.rep').value.trim() || 'Sviluppatore',
          }),
        });
      }
      if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}${t ? ' · ' + t.slice(0, 140) : ''}`); }
      status.className = 'status ok';
      status.textContent = '✓ Segnalazione inviata.';
      $('.notes').value = '';
      setTimeout(() => this.close(), 1200);
    } catch (e) {
      status.className = 'status err';
      status.textContent = isHosted ? `Invio fallito: ${e.message}` : `Daemon non raggiungibile (${e.message}). Avvia "bugbay dev".`;
    } finally {
      btn.disabled = false;
    }
  }
}

if (!customElements.get('bugbay-widget')) customElements.define('bugbay-widget', BugBayWidget);
if (typeof document !== 'undefined' && !document.querySelector('bugbay-widget')) {
  document.body.appendChild(document.createElement('bugbay-widget'));
}
