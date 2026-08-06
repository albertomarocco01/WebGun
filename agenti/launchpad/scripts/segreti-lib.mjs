/**
 * segreti-lib.mjs — Le regole sui segreti di Launchpad, pure e testabili.
 *
 * Qui non si apre nessun file e non si lancia nessun comando: sono funzioni da
 * testo a rilievo. Il guscio di I/O sta in `segreti.mjs` (che legge i file
 * tracciati e la storia) e in `verify.mjs` (che ne fa un passo del gate).
 *
 * La separazione non e' estetica. Una regola sui segreti che si puo' eseguire
 * solo con un repo sporco davanti e' una regola che nessuno prova mai: le
 * otto famiglie qui sotto hanno ognuna il proprio caso positivo E il proprio
 * caso negativo nella batteria, e i negativi contano di piu' — un falso
 * positivo sul file che la skill a monte prescrive di scrivere insegna a
 * ignorare il rosso, e da li' non si torna.
 *
 * REGOLA CHE VALE PER TUTTO IL FILE: quello che si trova NON si stampa.
 * Un gate che scrive il segreto nel proprio log lo ha pubblicato una seconda
 * volta, in un posto che finisce nella CI, nei transcript e negli appunti di
 * chi passava. Si stampano: famiglia, file, riga, e i primi quattro caratteri
 * con la lunghezza. Bastano a trovarlo, non bastano a usarlo.
 */

// ------------------------------------------------------------------- comuni
const senzaBom = (testo) => testo.replace(/^﻿/, "");
const righe = (testo) => senzaBom(testo).split(/\r?\n/);

export const dettaglioFindings = (findings) =>
  findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}`).join("\n");

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

/**
 * Un segreto si nomina, non si ricopia.
 *
 * Quattro caratteri e la lunghezza identificano la stringa per chi deve
 * andare a toglierla dal file, e non bastano a nessuno per usarla. La
 * tentazione di stampare «gli ultimi quattro» per comodita' va rifiutata: su
 * un JWT la coda e' la firma e non serve a niente, su una password e'
 * meta' della password.
 */
export function maschera(valore) {
  const s = String(valore ?? "");
  if (s.length === 0) return "(vuoto)";
  if (s.length <= 4) return `${"*".repeat(s.length)} [${s.length} caratteri]`;
  return `${s.slice(0, 4)}… [${s.length} caratteri]`;
}

/** Un file binario non si legge come testo: il rumore produce falsi positivi. */
export const eBinario = (buffer) => {
  const finestra = buffer.subarray(0, Math.min(buffer.length, 8000));
  return finestra.includes(0);
};

const SEGNAPOSTO = [
  /^$/,
  // PREFISSO e non stringa intera, ed e' una correzione misurata: sul pilota
  // il 2026-08-06 le due righe
  //     SUPABASE_SERVICE_ROLE_KEY=<la chiave di servizio> \
  //  *  SUPABASE_SERVICE_ROLE_KEY=<chiave> \
  // producevano due `block` su una documentazione corretta, perche' la barra
  // di continuazione della shell finiva dentro il valore e `^<.*>$` non
  // combaciava piu'. Un falso positivo sulla documentazione che insegna a fare
  // la cosa giusta e' il modo piu' rapido per far ignorare il rosso.
  /^<[^>]*>/,
  /^\{\{[^}]*\}\}/,
  /^\$\{[^}]*\}/,
  /^x+$/i,
  /^\.{3,}$/,
  /^(changeme|change-me|todo|tbd|placeholder|segnaposto|da-riempire)$/i,
  /^your[-_.]/i,
  /^(la-tua|il-tuo|inserisci)/i,
];

/** Un valore di esempio non e' un segreto: e' un promemoria del nome. */
export const eSegnaposto = (valore) => {
  const v = String(valore ?? "")
    .trim()
    .replace(/\s*\\$/, "") // continuazione di riga della shell
    .trim()
    .replace(/^["'`]|["'`]$/g, "");
  return SEGNAPOSTO.some((r) => r.test(v));
};

const NOME_SOSPETTO = /(SECRET|_KEY|^KEY|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|TOKEN|DSN|SERVICE_ROLE)/i;
export const nomeSospetto = (nome) => NOME_SOSPETTO.test(String(nome ?? ""));

/**
 * `NEXT_PUBLIC_*` e' pubblica PER COSTRUZIONE: `next build` la inserisce nel
 * bundle del browser. Chiamare segreto cio' che Next pubblica per contratto
 * sarebbe il falso positivo peggiore — quello sul file che vetrina-crafter
 * prescrive di scrivere (`.env.example` del pilota lo dichiara in prosa).
 *
 * Ma il nome non assolve il contenuto: se dentro una `NEXT_PUBLIC_*` c'e' una
 * chiave `service_role`, la famiglia 1 la trova lo stesso, perche' guarda il
 * VALORE. Il nome decide solo se una stringa opaca qualunque va segnalata.
 */
export const ePubblicaPerCostruzione = (nome) => /^NEXT_PUBLIC_/.test(String(nome ?? ""));

// ------------------------------------------------------------------- JWT
/**
 * Il payload di un JWT, decodificato. `null` se non e' un JWT leggibile.
 *
 * Serve a distinguere le due chiavi di Supabase, che hanno la STESSA forma e
 * significati opposti: `anon` sta nel browser di chiunque, `service_role`
 * scavalca ogni policy. Una regola che le trattasse uguale sarebbe inutile in
 * un verso e dannosa nell'altro.
 */
export function payloadJwt(token) {
  const parti = String(token ?? "").split(".");
  if (parti.length !== 3) return null;
  try {
    const grezzo = Buffer.from(parti[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const oggetto = JSON.parse(grezzo);
    return oggetto && typeof oggetto === "object" ? oggetto : null;
  } catch {
    return null;
  }
}

export const eServiceRole = (token) => {
  const p = payloadJwt(token);
  return p !== null && (p.role === "service_role" || p.role === "supabase_admin");
};

// ------------------------------------------------------- entropia (euristica)
/** Shannon, in bit per carattere. Una chiave vera sta sopra 4; una parola no. */
export function entropia(s) {
  const testo = String(s ?? "");
  if (testo.length === 0) return 0;
  const conteggi = new Map();
  for (const c of testo) conteggi.set(c, (conteggi.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of conteggi.values()) {
    const p = n / testo.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// ------------------------------------------------------------- le famiglie
/**
 * Una famiglia = un modo noto in cui un segreto finisce in un repo.
 *
 * `cerca(riga)` ritorna gli estratti sospetti di UNA riga. La riga e' l'unita'
 * giusta: un segreto sta su una riga, e il numero di riga e' cio' che serve a
 * chi va a toglierlo.
 */
const TOKEN_PROVIDER = [
  { nome: "Vercel", r: /\bvercel_[A-Za-z0-9]{20,}/g },
  { nome: "GitHub", r: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/g },
  { nome: "Cloudflare", r: /\bCLOUDFLARE_API_(?:TOKEN|KEY)\s*[:=]\s*["']?([A-Za-z0-9_-]{30,})/g },
  { nome: "Stripe", r: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g },
  { nome: "AWS", r: /\bAKIA[0-9A-Z]{16}\b/g },
  { nome: "Slack", r: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { nome: "OpenAI/Anthropic", r: /\b(?:sk-proj-|sk-ant-)[A-Za-z0-9_-]{20,}/g },
];

const CHIAVE_PRIVATA = /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/;

/**
 * Un URL con la password nell'autorita'. `postgres://utente:parola@host/db`.
 *
 * ESENZIONE, motivata qui e non altrove (precedente della §8 di DECISIONI.md:
 * un'esenzione si scrive accanto alla regola che disattiva).
 * `postgresql://postgres:postgres@127.0.0.1:PORTA/postgres` e' l'indirizzo che
 * il CLI di Supabase STAMPA a ogni `supabase start`, ed e' scritto in ogni
 * documento di ogni progetto di questa casa. Segnalarlo come segreto
 * produrrebbe decine di `block` sul lavoro corretto degli altri agenti, e un
 * rosso che tutti imparano a ignorare non e' piu' un controllo.
 *
 * L'esenzione e' STRETTA: utente e password devono essere entrambi `postgres`
 * E l'host deve essere locale. `postgres://postgres:Tr0ub4dor@db.example.com`
 * resta un `block`.
 */
const URL_CREDENZIALI = /\b([a-z][a-z0-9+.-]*):\/\/([^\s/:@"']+):([^\s/@"']+)@([^\s/:"']+)/g;
const eLocaleDiSviluppo = (utente, password, host) =>
  utente === "postgres" && password === "postgres" &&
  /^(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]|db|host\.docker\.internal)$/.test(host);

export const FAMIGLIE = Object.freeze([
  {
    id: "service-role",
    gravita: "block",
    che: "chiave `service_role` di Supabase",
    perche: "scavalca OGNI policy RLS: con quella, i dati di tutti gli utenti sono un `select`",
    cerca(riga) {
      const trovati = [];
      for (const m of riga.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) {
        if (eServiceRole(m[0])) trovati.push({ estratto: m[0], nota: "JWT con `\"role\":\"service_role\"`" });
      }
      for (const m of riga.matchAll(/\bsb_secret_[A-Za-z0-9_-]{10,}/g)) {
        trovati.push({ estratto: m[0], nota: "chiave segreta Supabase di formato nuovo (`sb_secret_`)" });
      }
      return trovati;
    },
  },
  {
    id: "nome-di-servizio-valorizzato",
    gravita: "block",
    che: "variabile di servizio con un valore vero accanto",
    perche: "il nome dice che scavalca le policy; il valore dice che qualcuno ce l'ha messo",
    cerca(riga) {
      const m = riga.match(/\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY)\b\s*[:=]\s*(.+)$/);
      if (!m) return [];
      const valore = m[2].trim().replace(/^["'`]|["'`,;]+$/g, "");
      if (eSegnaposto(valore)) return [];
      // `process.env.X` o `env("X")` NON e' un valore: e' una lettura, ed e'
      // esattamente cio' che si vuole che il codice faccia.
      if (/^(process\.env\b|env\(|Deno\.env|import\.meta\.env)/.test(valore)) return [];
      return [{ estratto: valore, nota: `variabile \`${m[1]}\` con un valore letterale` }];
    },
  },
  {
    id: "credenziale-sql",
    gravita: "block",
    che: "credenziale cablata in una migrazione o in un seed",
    perche: "un seed e' un file che si riusa: applicato su un ambiente vero consegna gli accessi a chiunque legga il repo",
    soloIn: /\.sql$/i,
    cerca(riga) {
      const trovati = [];
      for (const m of riga.matchAll(/\bcrypt\s*\(\s*'([^']{3,})'/g)) {
        trovati.push({ estratto: m[1], nota: "password in chiaro dentro `crypt('…')`" });
      }
      for (const m of riga.matchAll(/\b(?:encrypted_password|password)\s*(?:=|=>)\s*'([^']{3,})'/gi)) {
        trovati.push({ estratto: m[1], nota: "password assegnata come letterale" });
      }
      for (const m of riga.matchAll(/\b(?:create|alter)\s+(?:user|role)\s+\w+[^;]*?\bpassword\s+'([^']{1,})'/gi)) {
        trovati.push({ estratto: m[1], nota: "`create/alter role … password '…'`" });
      }
      return trovati;
    },
  },
  {
    id: "token-provider",
    gravita: "block",
    che: "token di un servizio esterno",
    perche: "un token di deploy pubblicato e' un deploy che puo' fare chiunque",
    cerca(riga) {
      const trovati = [];
      for (const { nome, r } of TOKEN_PROVIDER) {
        for (const m of riga.matchAll(r)) trovati.push({ estratto: m[1] ?? m[0], nota: `token ${nome}` });
      }
      if (CHIAVE_PRIVATA.test(riga)) trovati.push({ estratto: riga.trim(), nota: "intestazione di chiave privata" });
      return trovati;
    },
  },
  {
    id: "url-con-credenziali",
    gravita: "block",
    che: "password dentro l'autorita' di un URL",
    perche: "viaggia nei log, nei messaggi d'errore e nella cronologia della shell",
    cerca(riga) {
      const trovati = [];
      for (const m of riga.matchAll(URL_CREDENZIALI)) {
        const [, , utente, password, host] = m;
        if (eLocaleDiSviluppo(utente, password, host)) continue;
        if (eSegnaposto(password)) continue;
        trovati.push({ estratto: password, nota: `password nell'URL \`${m[1]}://${utente}:…@${host}\`` });
      }
      return trovati;
    },
  },
  {
    id: "entropia-alta",
    gravita: "issue",
    che: "stringa opaca che nessuna famiglia spiega",
    perche: "e' un'euristica: puo' essere una chiave, un hash di lockfile o un identificativo. Va guardata, non creduta",
    cerca(riga) {
      // Solo su righe che assomigliano a un'assegnazione con nome sospetto:
      // altrimenti ogni hash di un lockfile e ogni id di una migrazione
      // diventerebbero rilievi, e il passo perderebbe ogni credibilita'.
      const m = riga.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']?([A-Za-z0-9+/=_-]{32,})["']?/);
      if (!m) return [];
      const [, nome, valore] = m;
      if (!nomeSospetto(nome) || ePubblicaPerCostruzione(nome)) return [];
      if (eSegnaposto(valore)) return [];
      if (entropia(valore) < 4) return [];
      return [{ estratto: valore, nota: `\`${nome}\` con ${entropia(valore).toFixed(1)} bit/carattere di entropia` }];
    },
  },
]);

// ------------------------------------------------------ regole sui NOMI dei file
const ESEMPIO = /(^|[/\\])\.env\.(example|sample|template|dist)$/i;
const AMBIENTE = /(^|[/\\])\.env(\.|$)/i;

/** Un `.env` tracciato e' un segreto consegnato, qualunque cosa contenga. */
export const eFileAmbienteTracciato = (percorso) => AMBIENTE.test(percorso) && !ESEMPIO.test(percorso);
export const eFileEsempio = (percorso) => ESEMPIO.test(percorso);

/**
 * Dentro un file di ESEMPIO: una riga `NOME=valore` con un valore vero.
 *
 * Il file esiste per dichiarare i NOMI. Un valore riempito e' o una
 * dimenticanza (qualcuno ha copiato il `.env.local` sopra l'esempio) o una
 * comodita' che diventa una consegna.
 */
export function findingsEsempio(percorso, testo) {
  const findings = [];
  righe(testo).forEach((riga, i) => {
    if (/^\s*#/.test(riga)) return;
    const m = riga.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    const [, nome, grezzo] = m;
    const valore = grezzo.trim().replace(/^["']|["']$/g, "");
    if (eSegnaposto(valore)) return;
    if (ePubblicaPerCostruzione(nome)) return; // finisce nel bundle per contratto
    if (!nomeSospetto(nome)) return;
    findings.push({
      severity: "block",
      object: `${percorso}:${i + 1}`,
      message: `il file di esempio dichiara \`${nome}\` con un valore vero (${maschera(valore)}): un esempio porta i nomi, non i valori`,
      hint: "svuota il valore o sostituiscilo con un segnaposto; se era un segreto vero, va ruotato",
    });
  });
  return findings;
}

// ------------------------------------------------------------- il motore
/**
 * Applica le famiglie al testo di un file. Ritorna findings gia' formati.
 *
 * `dove` distingue il file tracciato («file») dalla storia («storia»), perche'
 * il rimedio e' diverso: nel primo caso si toglie e si committa, nel secondo
 * si ruota la chiave — riscrivere la storia non basta, chi ha clonato ce l'ha.
 */
export function findingsFile(percorso, testo, { dove = "file" } = {}) {
  const findings = [];
  const linee = righe(testo);
  for (const famiglia of FAMIGLIE) {
    if (famiglia.soloIn && !famiglia.soloIn.test(percorso)) continue;
    linee.forEach((riga, i) => {
      for (const { estratto, nota } of famiglia.cerca(riga)) {
        findings.push({
          severity: famiglia.gravita,
          object: `${percorso}:${i + 1}`,
          message: `${famiglia.che} — ${nota}: ${maschera(estratto)}`,
          hint: dove === "storia"
            ? `${famiglia.perche}. E' nella STORIA git: toglierlo da HEAD non basta, chi ha clonato ce l'ha gia'. Il rimedio e' ruotare la credenziale`
            : famiglia.perche,
          famiglia: famiglia.id,
          dove,
        });
      }
    });
  }
  return findings;
}

/**
 * Il verdetto complessivo su un insieme di file gia' letti.
 *
 * `letti` = [{percorso, testo}] tracciati · `ignorati` = [{percorso, testo}]
 * presenti sul disco ma fuori da git · `storia` = [{percorso, testo}] estratti
 * dai diff · `binari` = percorsi non letti perche' binari.
 *
 * PREMESSA PRIMA DELL'ESITO (DECISIONI.md §18): con zero file letti questa
 * funzione NON dice «nessun segreto». Chi la chiama deve guardare
 * `riassunto.letti` e dichiarare MANCANTE. Qui si ritorna il conteggio proprio
 * perche' il chiamante non possa fingere di non saperlo.
 */
export function esitoSegreti({ letti = [], ignorati = [], storia = [], binari = [] } = {}) {
  const findings = [];
  for (const { percorso, testo } of letti) {
    if (eFileAmbienteTracciato(percorso)) {
      findings.push({
        severity: "block",
        object: percorso,
        message: "file di ambiente TRACCIATO da git: parte con il deploy qualunque cosa contenga",
        hint: "va tolto dall'indice (`git rm --cached`), aggiunto al `.gitignore`, e ogni valore che conteneva va considerato compromesso",
        famiglia: "file-ambiente-tracciato",
        dove: "file",
      });
    }
    if (eFileEsempio(percorso)) findings.push(...findingsEsempio(percorso, testo));
    findings.push(...findingsFile(percorso, testo, { dove: "file" }));
  }
  // I file ignorati NON partono con un deploy connesso a git — ma partono con
  // un deploy da CLI, che carica la cartella di lavoro. Sono `issue`: la
  // gravita' dipende da COME si pubblica, e il runbook lo dichiara.
  //
  // UNA RIGA PER FILE, non una per rilievo. Misurato sul pilota il 2026-08-06:
  // per riga uscivano 40 `issue`, di cui 34 erano lo stesso file di segreti
  // dello stack Supabase locale ripetuto. Quaranta righe che dicono la stessa
  // cosa non sono piu' informazione: sono il modo in cui un passo si impara a
  // saltare, e il giorno che dice una cosa nuova nessuno se ne accorge.
  const perFile = new Map();
  for (const { percorso, testo } of ignorati) {
    const trovati = findingsFile(percorso, testo, { dove: "ignorato" });
    if (trovati.length === 0) continue;
    const famiglie = [...new Set(trovati.map((f) => f.famiglia))];
    perFile.set(percorso, { quanti: trovati.length, famiglie, righe: trovati.slice(0, 3).map((f) => f.object) });
  }
  for (const [percorso, r] of perFile) {
    findings.push({
      severity: "issue",
      object: percorso,
      message: `${r.quanti} rilievi in un file IGNORATO da git (${r.famiglie.join(" · ")}) — prime righe: ${r.righe.join(" · ")}`,
      hint: "non parte con un deploy connesso al repository; parte con un deploy da CLI, che carica la cartella di lavoro. Il runbook deve dichiarare quale dei due si usa (`Modo di deploy:`)",
      famiglia: "ignorato",
      dove: "ignorato",
    });
  }
  for (const { percorso, testo } of storia) findings.push(...findingsFile(percorso, testo, { dove: "storia" }));

  const binariSospetti = binari.filter((p) => AMBIENTE.test(p) || nomeSospetto(p));
  for (const percorso of binariSospetti) {
    findings.push({
      severity: "issue",
      object: percorso,
      message: "file binario tracciato con un nome che suggerisce un segreto: non e' stato letto",
      hint: "le famiglie lavorano su testo. Questo file va guardato a mano",
      famiglia: "binario-sospetto",
      dove: "file",
    });
  }

  return {
    findings,
    riassunto: {
      letti: letti.length,
      ignorati: ignorati.length,
      storia: storia.length,
      binari: binari.length,
      famiglie: FAMIGLIE.length,
    },
  };
}
