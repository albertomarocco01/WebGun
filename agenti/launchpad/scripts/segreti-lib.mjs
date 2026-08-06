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
const senzaBom = (testo) => testo.replace(/^\uFEFF/, "");
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
  // PROPORZIONALE, e non «i primi quattro sempre»: rilievo SEG-7 del tribunale
  // del 2026-08-06. Le famiglie accettano segreti da UN carattere
  // (`create role … password '…'`) e da tre (`crypt('…')`): su una password di
  // sei caratteri, quattro piu' la lunghezza esatta la riducono a un tentativo.
  // Sotto i dodici caratteri non si mostra niente.
  const quanti = s.length < 8 ? 0 : Math.min(4, Math.floor(s.length / 3));
  if (quanti === 0) return `${"*".repeat(Math.min(s.length, 8))} [${s.length} caratteri]`;
  return `${s.slice(0, quanti)}… [${s.length} caratteri]`;
}

/**
 * Un file binario non si legge come testo: il rumore produce falsi positivi.
 *
 * MA un byte NUL non basta a dire «binario». Rilievo IO-6 **e** SEG-1 del
 * tribunale del 2026-08-06 — due periti, mandati diversi, riproduzioni diverse,
 * stessa causa: un file salvato in **UTF-16LE** (il default di `Out-File` e di
 * «Salva con nome → Unicode» su Windows, che e' la piattaforma di questa casa)
 * ha un NUL dopo ogni carattere ASCII. Veniva classificato binario, non
 * decodificato e non guardato — e un `.env.production` in UTF-16 con dentro una
 * chiave `service_role` faceva uscire il gate VERDE.
 *
 * Ora il BOM decide prima dei byte, e il testo si decodifica con la sua
 * codifica invece di essere buttato.
 */
export function decodifica(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { testo: senzaBom(buffer.toString("utf16le")), codifica: "utf-16le" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16BE: si scambiano i byte a coppie, Node non lo decodifica da solo.
    const scambiato = Buffer.from(buffer);
    scambiato.swap16();
    return { testo: senzaBom(scambiato.toString("utf16le")), codifica: "utf-16be" };
  }
  const finestra = buffer.subarray(0, Math.min(buffer.length, 8000));
  if (finestra.includes(0)) return { testo: null, codifica: "binario" };
  return { testo: senzaBom(buffer.toString("utf8")), codifica: "utf-8" };
}

export const eBinario = (buffer) => decodifica(buffer).testo === null;

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
  // ANCORATE a destra: rilievo SEG-8 del tribunale del 2026-08-06. Come
  // prefissi, `<vedi 1Password>Tr0ub4dor3` assolveva una password vera. I due
  // casi del pilota che avevano motivato il rilassamento restano coperti,
  // perche' lo strip della barra di continuazione qui sotto gira PRIMA:
  // misurato dal perito, `"<chiave> \\"` → `"<chiave>"` → ancorata = true.
  /^<[^>]*>$/,
  /^\{\{[^}]*\}\}$/,
  /^\$\{[^}]*\}$/,
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
 * L'estensione di un file che PORTA una chiave, non di una variabile.
 *
 * Rilievo SEG-9: la reference prometteva `*.key` fra i binari sospetti e
 * `nomeSospetto` non lo riconosceva (`_KEY` vuole il trattino basso). Il test
 * che credeva di coprirlo usava `chiavi/private.key`, che passava per la parola
 * `private`. Predicato separato di proposito: `nomeSospetto` giudica i NOMI DI
 * VARIABILE, e mescolarli allargherebbe anche la famiglia a entropia.
 * `.crt`/`.cer`/`.pub` NON sono in elenco: sono materiale pubblico.
 */
const ESTENSIONE_DI_CHIAVE = /\.(key|pem|p12|pfx|jks|keystore|ppk|asc|gpg)$/i;
export const ePortatoreDiChiave = (percorso) => ESTENSIONE_DI_CHIAVE.test(String(percorso ?? ""));

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

/**
 * Un valore che e' pubblico PER CONTENUTO, non per prefisso.
 *
 * Rilievo SEG-3 del tribunale del 2026-08-06: l'esenzione `NEXT_PUBLIC_*`
 * assolveva il valore, e quindi assolveva proprio il caso in cui l'esposizione
 * e' MASSIMA — una chiave vera sotto quel nome finisce nel bundle di ogni
 * browser. Misurato: `NEXT_PUBLIC_RESEND_API_KEY=re_8kQ2…` non produceva
 * niente, mentre `RESEND_API_KEY=re_8kQ2…` produceva un `issue`.
 *
 * Il prefisso non assolve piu' da solo. Assolve il **contenuto**: un JWT (la
 * chiave anonima di Supabase, che sta nel bundle per contratto) o un indirizzo.
 * Cosi' `NEXT_PUBLIC_SUPABASE_ANON_KEY` resta muta — che era il falso positivo
 * da non fare mai — e una chiave di un servizio qualunque no.
 */
const eValorePubblicabile = (valore) => {
  const v = String(valore ?? "").trim();
  if (payloadJwt(v) !== null) return true;
  return /^https?:\/\//i.test(v);
};

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

/**
 * L'ECCEZIONE DICHIARATA — precedente di `DECISIONI.md` §10.
 *
 * Il pilota, il 2026-08-06, ha dimostrato che senza questo il gate ha un rosso
 * STRUTTURALE: `supabase/seed/90-solo-sviluppo.sql` crea due account con una
 * password nota, e **e' giusto che li crei** — senza, nessuno prova il
 * gestionale in locale e ventidue test E2E non hanno sessioni. Il file lo
 * dichiara in testa, in maiuscolo, con il motivo. Il debito n°27 non era «quelle
 * password esistono»: era «il percorso di produzione legge lo stesso file di
 * quello di sviluppo», e P.4g l'ha chiuso separando i seed.
 *
 * Un gate che resta rosso su un progetto corretto non e' severo: e' rotto. E la
 * §19 lo dice per tutta la casa — un rosso strutturale e' la cosa da non fare.
 *
 * Le tre strade erano: declassare la famiglia per tutti, aggiungere una
 * configurazione, oppure **dichiarare l'eccezione nel file che la contiene**.
 * Vale qui la stessa scelta della §10, e per lo stesso motivo: le prime due
 * spengono il controllo anche per chi non ha autorizzato niente; la terza
 * costringe a FIRMARE l'eccezione dove si esercita.
 *
 *     -- launchpad-consentito: credenziale-sql — solo sviluppo, non applicato
 *        in produzione (debito n°27, docs/PRODUZIONE.md)
 *
 * Tre vincoli, e nessuno e' negoziabile:
 *  1. l'eccezione vale per UNA famiglia e per QUEL file;
 *  2. declassa a `issue`, non cancella: resta stampata, resta contata, resta
 *     nell'handoff;
 *  3. **le famiglie che consegnano l'accesso a un sistema vero non sono
 *     derogabili.** Una chiave `service_role`, un token di provider, un `.env`
 *     tracciato: li' non esiste il caso legittimo, e un'eccezione sarebbe solo
 *     il modo di scriversi il permesso da soli.
 */
const ECCEZIONE = /^[ \t]*(?:--|#|\/\/|\*|<!--)?[ \t]*launchpad-consentito[ \t]*:[ \t]*([a-z][a-z-]+)[ \t]*(?:—|–|--|-)[ \t]*(.+?)[ \t]*(?:-->)?[ \t]*$/gim;

export function eccezioniDichiarate(testo) {
  const trovate = new Map();
  // Le zone CITATE non dichiarano niente (rilievo SEG-5): un blocco recintato
  // dentro una reference contiene un ESEMPIO della sintassi, non una firma.
  // Misurato dal tribunale: `references/segreti.md` — il documento che spiega
  // questo meccanismo — si accusava da solo, e un `docs/PRODUZIONE.md` che
  // copiava la riga dentro un fence declassava i propri rilievi veri.
  const pulito = String(testo ?? "")
    .replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, "")
    .replace(/^[ \t]*~~~[\s\S]*?^[ \t]*~~~/gm, "");
  for (const m of pulito.matchAll(ECCEZIONE)) {
    const motivo = m[2].trim();
    // Un'eccezione senza motivo non e' un'eccezione: e' un interruttore.
    if (motivo.length < 10) continue;
    trovate.set(m[1], motivo);
  }
  return trovate;
}

export const FAMIGLIE = Object.freeze([
  {
    id: "service-role",
    gravita: "block",
    derogabile: false,
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
    derogabile: false,
    che: "variabile di servizio con un valore vero accanto",
    perche: "il nome dice che scavalca le policy; il valore dice che qualcuno ce l'ha messo",
    cerca(riga) {
      // Il confine a sinistra NON e' `\b`: un prefisso che finisce in `_` e' un
      // carattere di parola, quindi `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=…` e
      // `PROD_SERVICE_ROLE_KEY=…` scavalcavano la famiglia (rilievo SEG-3).
      // Nessun nome legittimo contiene `SERVICE_ROLE_KEY` come suffisso.
      const m = riga.match(/(?:^|[^A-Za-z0-9])(?:[A-Z0-9]+_)*(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY)\b["']?\s*[:=]\s*(.+)$/);
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
    derogabile: true,
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
    derogabile: false,
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
    derogabile: true,
    che: "password dentro l'autorita' di un URL",
    perche: "viaggia nei log, nei messaggi d'errore e nella cronologia della shell",
    cerca(riga) {
      const trovati = [];
      for (const m of riga.matchAll(URL_CREDENZIALI)) {
        const [, , utente, password, host] = m;
        if (eLocaleDiSviluppo(utente, password, host)) continue;
        if (eSegnaposto(password)) continue;
        // L'host si riduce alle ultime due etichette: su Supabase l'host **e'**
        // il riferimento del progetto, e stamparlo per intero insieme
        // all'utente e' un pezzo di segreto in piu' di quelli dichiarati
        // (rilievo SEG-7). `file:riga` basta gia' a trovarlo.
        const coda = host.split(".").slice(-2).join(".");
        trovati.push({ estratto: password, nota: `password nell'URL \`${m[1]}://…:…@…${coda === host ? host : `.${coda}`}\`` });
      }
      return trovati;
    },
  },
  {
    id: "entropia-alta",
    gravita: "issue",
    derogabile: true,
    che: "stringa opaca che nessuna famiglia spiega",
    perche: "e' un'euristica: puo' essere una chiave, un hash di lockfile o un identificativo. Va guardata, non creduta",
    cerca(riga) {
      // Solo su righe che assomigliano a un'assegnazione con nome sospetto:
      // altrimenti ogni hash di un lockfile e ogni id di una migrazione
      // diventerebbero rilievi, e il passo perderebbe ogni credibilita'.
      // `["']?` DOPO il nome, e non solo prima del valore: in un file JSON la
      // chiave e' quotata (`"API_SECRET": "…"`) e senza questo la famiglia non
      // vedeva niente in nessun `.json` — cioe' proprio nei file di
      // configurazione per cui esiste.
      //
      // `matchAll` e non `match` (rilievo SEG-6): senza `/g` si guardava la
      // PRIMA coppia della riga e basta, quindi un valore lungo e benigno messo
      // davanti accecava la famiglia catch-all per tutto il resto della riga —
      // e un JSON compattato su una riga sola e' il posto in cui un segreto ci
      // finisce da solo. Tetto a tre per riga, come per gli ignorati: quaranta
      // righe che dicono la stessa cosa non sono piu' informazione.
      const trovati = [];
      // Il PUNTO fa parte del valore: senza, un JWT veniva catturato a meta'
      // (i tre segmenti sono separati da `.`) e `eValorePubblicabile` non lo
      // riconosceva piu' come JWT — quindi la chiave anonima di Supabase, che
      // deve restare muta, produceva un rilievo.
      for (const m of riga.matchAll(/([A-Za-z_][A-Za-z0-9_]*)["']?\s*[:=]\s*["']?([A-Za-z0-9+/=_.-]{32,})["']?/g)) {
        if (trovati.length >= 3) break;
        const [, nome, valore] = m;
        if (!nomeSospetto(nome)) continue;
        // Il prefisso `NEXT_PUBLIC_` non assolve piu' da solo: assolve il
        // CONTENUTO (un JWT, un indirizzo). Vedi `eValorePubblicabile`.
        if (ePubblicaPerCostruzione(nome) && eValorePubblicabile(valore)) continue;
        if (eSegnaposto(valore)) continue;
        if (entropia(valore) < 4) continue;
        trovati.push({ estratto: valore, nota: `\`${nome}\` con ${entropia(valore).toFixed(1)} bit/carattere di entropia` });
      }
      return trovati;
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
    // Il prefisso non assolve da solo (rilievo SEG-3): assolve il CONTENUTO.
    // Un JWT o un indirizzo finiscono nel bundle per contratto; una chiave di
    // un servizio qualunque sotto un nome `NEXT_PUBLIC_*` e' pubblicata per
    // errore, ed e' il caso in cui l'esposizione e' massima.
    if (ePubblicaPerCostruzione(nome) && eValorePubblicabile(valore)) return;
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
export function findingsFile(percorso, testo, { dove = "file", etichetta = null, righeVere = true } = {}) {
  const nome = etichetta ?? percorso;
  const findings = [];
  const linee = righe(testo);
  // Le eccezioni valgono sul file in cui sono scritte, e NON nella storia: un
  // commit vecchio che porta la propria assoluzione e' un'assoluzione scritta
  // da chi aveva sbagliato.
  const eccezioni = dove === "storia" ? new Map() : eccezioniDichiarate(testo);
  const usate = new Set();
  for (const famiglia of FAMIGLIE) {
    if (famiglia.soloIn && !famiglia.soloIn.test(percorso)) continue;
    const motivo = eccezioni.get(famiglia.id);
    const derogata = motivo !== undefined && famiglia.derogabile;
    linee.forEach((riga, i) => {
      for (const { estratto, nota } of famiglia.cerca(riga)) {
        if (derogata) usate.add(famiglia.id);
        findings.push({
          severity: derogata ? "issue" : famiglia.gravita,
          object: righeVere ? `${nome}:${i + 1}` : nome,
          message: derogata
            ? `${famiglia.che} — ${nota}: ${maschera(estratto)} · ECCEZIONE DICHIARATA: ${motivo}`
            : `${famiglia.che} — ${nota}: ${maschera(estratto)}`,
          hint: dove === "storia"
            ? `${famiglia.perche}. E' nella STORIA git: toglierlo da HEAD non basta, chi ha clonato ce l'ha gia'. Il rimedio e' ruotare la credenziale`
            : famiglia.perche,
          famiglia: famiglia.id,
          dove,
        });
      }
    });
  }
  findings.push(...findingsSulleEccezioni({ eccezioni, usate, nome, dove }));
  return findings;
}

/**
 * I rilievi che riguardano l'ECCEZIONE stessa, non il segreto.
 *
 * Tre casi, e tutti e tre dicono la stessa cosa da angoli diversi: un permesso
 * che nessuno rilegge sembra proteggere e non protegge.
 */
function findingsSulleEccezioni({ eccezioni, usate, nome, dove }) {
  const findings = [];
  for (const [id, motivo] of eccezioni) {
    const famiglia = FAMIGLIE.find((f) => f.id === id);
    if (!famiglia) {
      findings.push({
        severity: "warn",
        object: nome,
        message: `dichiara un'eccezione per \`${id}\`, che non e' una famiglia di questo controllo`,
        hint: "un refuso in un'eccezione e' un'eccezione che non protegge niente, e sembra proteggere",
        famiglia: "eccezione-sconosciuta",
        dove,
      });
    } else if (!famiglia.derogabile) {
      findings.push({
        severity: "block",
        object: nome,
        message: `dichiara un'eccezione per \`${id}\`, che NON e' derogabile — «${motivo}»`,
        hint: "una chiave che apre un sistema vero non ha un caso legittimo: li' l'eccezione sarebbe solo il modo di scriversi il permesso da soli. Le famiglie derogabili sono " +
          FAMIGLIE.filter((f) => f.derogabile).map((f) => `\`${f.id}\``).join(", "),
        famiglia: "eccezione-non-derogabile",
        dove,
      });
    } else if (!usate.has(id)) {
      findings.push({
        severity: "warn",
        object: nome,
        message: `dichiara un'eccezione per \`${id}\` che non serve piu': in questo file non c'e' niente da derogare`,
        hint: "un'eccezione scaduta e' un permesso aperto che nessuno rilegge. Si toglie",
        famiglia: "eccezione-inutile",
        dove,
      });
    }
  }
  return findings;
}

/**
 * Il verdetto complessivo su un insieme di file gia' letti.
 *
 * `letti` = [{percorso, testo}] tracciati · `daTracciare` = [{percorso, testo}]
 * nuovi e non ignorati · `ignorati` = [{percorso, testo}] fuori da git ·
 * `storia` = [{percorso, testo}] estratti dai diff · `binari` = percorsi non
 * letti perche' binari.
 *
 * PREMESSA PRIMA DELL'ESITO (DECISIONI.md §18): con zero file letti questa
 * funzione NON dice «nessun segreto». Chi la chiama deve guardare
 * `riassunto.letti` e dichiarare MANCANTE. Qui si ritorna il conteggio proprio
 * perche' il chiamante non possa fingere di non saperlo.
 */
/**
 * I file ignorati: UNA riga per file, non una per rilievo.
 *
 * Misurato sul pilota il 2026-08-06: per riga uscivano 40 `issue`, di cui 34
 * erano lo stesso file di segreti dello stack Supabase locale ripetuto.
 * Quaranta righe che dicono la stessa cosa non sono piu' informazione: sono il
 * modo in cui un passo si impara a saltare, e il giorno che dice una cosa nuova
 * nessuno se ne accorge.
 */
function findingsIgnorati(ignorati) {
  const findings = [];
  for (const { percorso, testo } of ignorati) {
    const trovati = findingsFile(percorso, testo, { dove: "ignorato" });
    if (trovati.length === 0) continue;
    const famiglie = [...new Set(trovati.map((f) => f.famiglia))];
    findings.push({
      severity: "issue",
      object: percorso,
      message: `${trovati.length} rilievi in un file IGNORATO da git (${famiglie.join(" · ")}) — prime righe: ${trovati.slice(0, 3).map((f) => f.object).join(" · ")}`,
      hint: "non parte con un deploy connesso al repository; parte con un deploy da CLI, che carica la cartella di lavoro. Il runbook deve dichiarare quale dei due si usa (`Modo di deploy:`)",
      famiglia: "ignorato",
      dove: "ignorato",
    });
  }
  return findings;
}

export function esitoSegreti({
  letti = [], daTracciare = [], ignorati = [], storia = [], binari = [],
  percorsi = [], nonLetti = [],
} = {}) {
  const findings = [];
  // I file NUOVI e non ignorati si guardano con la stessa gravita' dei
  // tracciati, ed e' una correzione misurata: sul banco, il 2026-08-06, quattro
  // sabotaggi su sette hanno scavalcato questo passo semplicemente scrivendo un
  // file NUOVO. `git ls-files` non li elenca, `--others --ignored` nemmeno, e
  // il passo dichiarava «140 file letti · nessun rilievo» sopra una chiave
  // `service_role` sul disco. Il gesto successivo di chiunque e' `git add -A`.
  // Le regole sul NOME girano sull'elenco dei PERCORSI, prima e
  // indipendentemente dalla lettura — rilievo SEG-1 del tribunale del
  // 2026-08-06, il piu' grave del rapporto. Prima giravano sui soli file
  // `letti`: un `.env.production` in UTF-16 finiva fra i binari, la regola
  // «un `.env` tracciato e' un block a prescindere dal contenuto» non lo
  // vedeva mai, e il gate usciva VERDE su una chiave `service_role`
  // committata. Una regola sul nome non ha ragione di dipendere dall'esito
  // di `readFileSync`.
  const daNome = percorsi.length > 0
    ? percorsi
    : [...letti, ...daTracciare].map((f) => f.percorso);
  for (const percorso of daNome) {
    if (!eFileAmbienteTracciato(percorso)) continue;
    findings.push({
      severity: "block",
      object: percorso,
      message: "file di ambiente TRACCIATO da git: parte con il deploy qualunque cosa contenga",
      hint: "va tolto dall'indice (`git rm --cached`), aggiunto al `.gitignore`, e ogni valore che conteneva va considerato compromesso",
      famiglia: "file-ambiente-tracciato",
      dove: "file",
    });
  }
  for (const { percorso, testo } of [...letti, ...daTracciare]) {
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
  findings.push(...findingsIgnorati(ignorati));
  // `percorso` e' il file VERO (serve a `soloIn`), `etichetta` porta il commit.
  // I numeri di riga di un diff non sono quelli del file: non si stampano.
  for (const { percorso, etichetta, testo } of storia) {
    findings.push(...findingsFile(percorso, testo, { dove: "storia", etichetta: etichetta ?? percorso, righeVere: false }));
  }

  const binariSospetti = binari.filter((p) => AMBIENTE.test(p) || nomeSospetto(p) || ePortatoreDiChiave(p));
  for (const percorso of binariSospetti) {
    findings.push({
      severity: "issue",
      object: percorso,
      message: "file binario con un nome che suggerisce un segreto: non e' stato letto",
      hint: "le famiglie lavorano su testo. Questo file va guardato a mano",
      famiglia: "binario-sospetto",
      dove: "file",
    });
  }
  // Un file saltato per DIMENSIONE spariva senza traccia: ne' fra i letti, ne'
  // fra i binari (rilievo SEG-4 · IO-5). La riga «N ignorati guardati» contava
  // i soli riusciti, quindi non mentiva e nemmeno dichiarava il divario — che
  // e' la §18 misurata male nel punto in cui il codice dichiara di misurarla
  // bene. Un dump di database ignorato e' esattamente il caso per cui gli
  // ignorati si guardano.
  for (const { percorso, motivo } of nonLetti) {
    findings.push({
      severity: "issue",
      object: percorso,
      message: `non letto: ${motivo}`,
      hint: "un file non guardato si DICHIARA. Alzare la soglia, o guardarlo a mano",
      famiglia: "non-letto",
      dove: "file",
    });
  }

  return {
    findings,
    riassunto: {
      letti: letti.length,
      daTracciare: daTracciare.length,
      ignorati: ignorati.length,
      storia: storia.length,
      binari: binari.length,
      nonLetti: nonLetti.length,
      famiglie: FAMIGLIE.length,
    },
  };
}
