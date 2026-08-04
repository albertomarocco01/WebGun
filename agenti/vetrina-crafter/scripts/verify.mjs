#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Vetrina Crafter.
 *
 * COSA FA: misura le premesse (contratto firmato, sorgenti letti, app servita e
 * identita' della build) PRIMA di leggere gli esiti. Ogni passo finisce in uno
 * di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica
 *   mancante, e il gate resta rosso.
 *
 * USO:  node verify.mjs --url <url-della-build> [--db-url <url>] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: TypeScript nel progetto, ESLint nella cartella della skill, `psql`
 *             nel PATH. Ognuna assente vale MANCANTE, mai PASS.
 *
 * `--url` NON ha un default. Un gate che indovina `localhost:3000` misura l'app
 * di un altro progetto e stampa `pass`: e' successo davvero in questa casa, e su
 * questa stessa macchina la porta che un contratto FIRMATO dichiarava serviva il
 * sito di un'altra azienda. Per questo `app-identita` non si fida nemmeno
 * dell'URL: pretende il `.next/BUILD_ID` di questo progetto nell'HTML servito.
 *
 * Le regole vivono in `audit-lib.mjs` e `progetto-lib.mjs` e hanno i loro test:
 * qui c'e' solo il guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  argomentiOstiliACmd,
  conBarre,
  contaGravita,
  dettaglioFindings,
  formaEseguibile,
  frammentoNeiSorgenti,
  primoEseguibile,
  statoDaFindings,
} from "./audit-lib.mjs";
import {
  argomentiPsql,
  contrattoUscita,
  dataConfermaDa,
  diagnosiTipi,
  eLaMiaBuild,
  findingsContenuti,
  findingsContratto,
  findingsRotte,
  findingsSegnaposto,
  indiziDevServer,
  leggiContratto,
  righeDaPsql,
  rotteDaSorgenti,
  schemiEsposti,
  SOGLIA_FRAMMENTO,
  testoServito,
  urlDbProgetto,
  verdettoDa,
} from "./progetto-lib.mjs";
import { auditStatico, raccogliSorgenti } from "./vetrina-audit.mjs";

const PROGETTO = process.cwd();
const CONTRATTO = "docs/vetrina.md";
const HANDOFF_DIR = "docs/handoff";

/** L'ordine di questa lista E' il gate, e un test lo blocca (DECISIONI.md §15).
 *  I primi cinque non hanno bisogno dell'app accesa, gli altri si'. */
export const ID = Object.freeze({
  contratto: "contratto-vetrina",
  tipi: "tipi",
  cucitura: "cucitura-ui",
  chiavi: "chiavi-e-client",
  a11y: "a11y-statica",
  identita: "app-identita",
  pagine: "pagine-vive",
  segnaposto: "segnaposto-serviti",
  contenuti: "contenuti-vivi",
  uscita: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;

const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  return existsSync(pieno) ? readFileSync(pieno, "utf8") : null;
};

/** `counts` sta SOLO sui passi che producono findings per gravita': gli altri
 *  non hanno niente da contare, e una chiave a zero direbbe che hanno guardato. */
function conFindings(id, nome, findings, testa) {
  const passo = record(id, nome, statoDaFindings(findings),
    [testa, findings.length > 0 ? dettaglioFindings(findings) : "nessun rilievo"].filter(Boolean).join("\n"));
  passo.counts = contaGravita(findings);
  return passo;
}

// ------------------------------------------------- eseguibili e sottoprocessi
function dove(nome) {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [nome], { encoding: "utf8" });
  if (res.error || res.status !== 0) return null;
  return primoEseguibile(res.stdout);
}

function esegui(cmd, args, opzioni = {}) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  if (prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(args);
    if (ostili.length > 0) {
      return { error: new Error(`argomenti con spazi non passabili da cmd.exe: ${ostili.join(", ")}`), status: null, stdout: "", stderr: "" };
    }
  }
  return spawnSync(file, [...prefisso, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opzioni });
}

/**
 * Una GET che non esplode: `{ stato, corpo, rimandoA }` oppure `null`.
 * Due tentativi, e non e' pigrizia difensiva: una GET puo' cadere una volta
 * sola mentre il server chiude connessioni, e un tentativo solo trasformerebbe
 * un intoppo di rete in un rilievo sulla pagina — un rosso che punta
 * all'imputato sbagliato (precedente misurato di Speed Demon).
 */
async function preleva(url, { tentativi = 2, segui = false } = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const risposta = await fetch(url, { redirect: segui ? "follow" : "manual" });
      return {
        stato: risposta.status,
        corpo: await risposta.text(),
        rimandoA: risposta.status >= 300 && risposta.status < 400 ? risposta.headers.get("location") : null,
      };
    } catch {
      if (i === tentativi - 1) return null;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

const unisci = (base, percorso) => new URL(percorso, base).toString();

// ------------------------------------------------------------------ psql
/** Un identificatore che finisce dentro una query si valida PRIMA, e non si
 *  virgoletta a mano: un nome che non ha questa forma non e' un nome di tabella
 *  di questo contratto, ed e' meglio non interrogare che interrogare a caso. */
const IDENTIFICATORE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

function interrogaConEsito(dbUrl, sql) {
  const res = esegui("psql", argomentiPsql(dbUrl, sql));
  if (res.error || res.status !== 0) {
    return { righe: null, errore: `${res.stderr ?? ""}${res.error?.message ?? ""}` };
  }
  return { righe: righeDaPsql(res.stdout), errore: "" };
}

function interroga(dbUrl, sql) {
  return interrogaConEsito(dbUrl, sql).righe;
}

/** Postgres dice «permission denied» con `42501`, e la differenza fra quello e
 *  «non sono riuscito a interrogare» e' la differenza fra una misura riuscita
 *  con esito negativo e una verifica che non si e' potuta fare. */
const PERMESSO_NEGATO = /42501|permission denied|permesso negato/i;

// ------------------------------------------------------------------ i passi
const PASSI = [
  {
    id: ID.contratto,
    nome: "contratto della vetrina",
    async esegui(ctx) {
      const testo = leggiSeCe(CONTRATTO);
      if (testo === null) {
        return record(this.id, this.nome, "skipped",
          `${CONTRATTO} assente: senza contratto non si sa quali pagine esistono, e un elenco che non ha firmato nessuno e' l'opinione dell'agente su cosa contasse (comando \`specchio\`)`);
      }
      const contratto = leggiContratto(testo);
      if (!contratto.confermatoDa) {
        return record(this.id, this.nome, "skipped",
          `${CONTRATTO} senza riga \`Confermato da:\` leggibile: un elenco non confermato non e' un contratto. Il segnaposto del template non e' una firma`);
      }
      if (contratto.pagine.length === 0) {
        return record(this.id, this.nome, "skipped",
          `${CONTRATTO} non dichiara nessuna pagina nella forma \`## \`id\` — /percorso\`: non ne e' stata raccolta neanche una`);
      }
      ctx.contratto = contratto;
      const findings = findingsContratto(contratto, { dataHandoffSchema: dataHandoffSchemaForge() });
      return conFindings(this.id, this.nome, findings,
        `${contratto.pagine.length} pagine · ${contratto.slot.length} slot${contratto.nessunoSlotDichiarato ? " (il contratto dichiara «Nessuno slot.»)" : ""} · confermato da: ${contratto.confermatoDa}`);
    },
  },

  {
    id: ID.tipi,
    nome: "tipi TypeScript",
    async esegui() {
      const tsc = join(PROGETTO, "node_modules", "typescript", "bin", "tsc");
      if (!existsSync(join(PROGETTO, "tsconfig.json"))) {
        return record(this.id, this.nome, "skipped", "nessun `tsconfig.json` nel progetto: non c'e' niente da compilare");
      }
      if (!existsSync(tsc)) {
        return record(this.id, this.nome, "skipped", "TypeScript non installato nel progetto (`npm install`): la verifica dei tipi non e' stata fatta");
      }
      // Si invoca `node <percorso>/tsc` e non lo shim: cosi' l'unico eseguibile
      // in gioco e' quello che sta gia' girando.
      const res = spawnSync(process.execPath, [tsc, "--noEmit"], { cwd: PROGETTO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      if (res.error) return record(this.id, this.nome, "skipped", `tsc non eseguibile: ${res.error.message}`);
      if (res.status === 0) return record(this.id, this.nome, "pass", "`tsc --noEmit` pulito");
      const righeErrore = (res.stdout || res.stderr || "").split(/\r?\n/).filter((r) => /error TS/.test(r));
      return record(this.id, this.nome, "fail",
        `\`tsc --noEmit\`: ${righeErrore.length} errori\n${righeErrore.slice(0, 8).join("\n")}${righeErrore.length > 8 ? `\n… e altri ${righeErrore.length - 8}` : ""}\n` +
        diagnosiTipi(righeErrore));
    },
  },

  // I tre passi statici li produce `vetrina-audit.mjs`, che si puo' lanciare
  // anche da solo mentre si costruisce. Si IMPORTA invece di lanciarlo come
  // sottoprocesso: girano nella stessa skill, sullo stesso progetto, e una
  // seconda serializzazione JSON aggiungerebbe solo un modo di fallire. Un
  // errore imprevisto la' dentro NON deve pero' uccidere il gate — un gate che
  // crasha non e' ne' verde ne' rosso, e' assente — quindi diventa MANCANTE.
  {
    id: ID.cucitura,
    nome: "cucitura dei componenti",
    async esegui(ctx) {
      eseguiAuditStatico(ctx);
      return innesta(ctx, ID.cucitura, this.nome);
    },
  },
  { id: ID.chiavi, nome: "chiavi e client dei dati", async esegui(ctx) { return innesta(ctx, ID.chiavi, this.nome); } },
  { id: ID.a11y, nome: "accessibilita' statica (jsx-a11y)", async esegui(ctx) { return innesta(ctx, ID.a11y, this.nome); } },

  {
    id: ID.identita,
    nome: "identita' dell'app servita",
    async esegui(ctx, args) {
      const buildId = leggiSeCe(join(".next", "BUILD_ID"))?.trim();
      if (!buildId) {
        return record(this.id, this.nome, "skipped",
          "`.next/BUILD_ID` assente: il progetto non e' stato costruito. `npm run build` prima del gate — senza, non si puo' verificare che l'indirizzo interrogato sia l'app di QUESTO progetto");
      }
      const risposta = await preleva(args.url, { segui: true });
      if (!risposta) {
        return record(this.id, this.nome, "skipped",
          `nessuna risposta da ${args.url}: avvia la build con \`npm run build && npm run start -- -p <porta>\` prima del gate`);
      }
      const indizi = indiziDevServer(risposta.corpo);
      if (indizi.length > 0) {
        return record(this.id, this.nome, "fail",
          `${args.url} (HTTP ${risposta.stato}) e' una DEV SERVER, non una build di produzione\n` +
          indizi.map((i) => `  indizio: ${i.nome} — ${i.perche}`).join("\n"));
      }
      if (!eLaMiaBuild(risposta.corpo, buildId)) {
        // FAIL e non MANCANTE (correzione del direttore in revisione della P0):
        // un'app che risponde con un BUILD_ID diverso non e' una verifica che non
        // si e' potuta fare, e' un fatto misurato — sta rispondendo un'altra
        // applicazione sulla stessa porta.
        return record(this.id, this.nome, "fail",
          `${args.url} (HTTP ${risposta.stato}) risponde, ma NON e' l'app di questo progetto.\n` +
          `  build id di ${conBarre(PROGETTO)}: ${buildId}\n` +
          "  non compare da nessuna parte nell'HTML servito da quell'indirizzo.\n" +
          "Sta rispondendo un'altra applicazione sulla stessa porta: leggerne le pagine darebbe rilievi plausibili di un sito che non e' questo.");
      }
      ctx.baseUrl = args.url;
      const vecchia = buildPiuVecchiaDeiSorgenti();
      const testa = `${args.url} (HTTP ${risposta.stato}) · build id ${buildId} · nessuno degli indizi di dev server`;
      if (!vecchia) return record(this.id, this.nome, "pass", testa);
      return conFindings(this.id, this.nome, [{
        severity: "issue",
        object: ".next/BUILD_ID",
        message: `la build servita e' piu' vecchia del sorgente piu' recente (${vecchia}): quello che i passi a valle leggeranno parla di un'altra versione del sito`,
        hint: "rilancia `npm run build` e poi il gate. Falso positivo dichiarato: un `git checkout` o un formattatore che tocca file senza cambiarli",
      }], testa);
    },
  },

  {
    id: ID.pagine,
    nome: "pagine dichiarate e pagine servite",
    async esegui(ctx) {
      if (!ctx.contratto) return record(this.id, this.nome, "skipped", "contratto non leggibile: non c'e' nessun elenco di pagine da verificare");
      if (!ctx.baseUrl) return record(this.id, this.nome, "skipped", "identita' dell'app non stabilita: interrogare pagine su un'app che non si sa quale sia produce un esito che non e' un esito");

      ctx.risposte = new Map();
      ctx.testoPagine = new Map();
      for (const pagina of ctx.contratto.pagine) {
        const risposta = await preleva(unisci(ctx.baseUrl, pagina.percorso));
        ctx.risposte.set(pagina.id, risposta);
        if (risposta && risposta.stato < 300) ctx.testoPagine.set(pagina.id, testoServito(risposta.corpo));
      }

      const config = ctx.audit?.config ?? {};
      const rotteSorgenti = config.radicePubblica
        ? rotteDaSorgenti(raccogliSorgenti(PROGETTO).map((f) => f.percorso), config)
        : [];
      const findings = findingsRotte({
        pagine: ctx.contratto.pagine,
        risposte: ctx.risposte,
        rotteSorgenti,
        escluse: ctx.contratto.escluse,
      });
      // I gestori si contano a parte: «9 rotte» quando otto sono pagine e una e'
      // un `route.ts` nasconde nella somma proprio la cosa che si e' appena
      // imparato a guardare.
      const gestori = rotteSorgenti.filter((r) => r.tipo === "gestore").length;
      return conFindings(this.id, this.nome, findings,
        `${ctx.contratto.pagine.length} pagine dichiarate · ${rotteSorgenti.length - gestori} rotte da \`page\` nei sorgenti · ` +
        `${gestori} da \`route\` · ${ctx.contratto.escluse.length} escluse dal contratto`);
    },
  },

  {
    id: ID.segnaposto,
    nome: "segnaposto nel testo servito",
    async esegui(ctx) {
      if (!ctx.testoPagine || ctx.testoPagine.size === 0) {
        return record(this.id, this.nome, "skipped", "nessuna pagina scaricata: non c'e' testo servito da leggere");
      }
      const testi = new Map();
      for (const pagina of ctx.contratto.pagine) {
        const testo = ctx.testoPagine.get(pagina.id);
        if (testo !== undefined) testi.set(`${pagina.id} (${pagina.percorso})`, testo);
      }
      const findings = findingsSegnaposto(testi);
      return conFindings(this.id, this.nome, findings, `${testi.size} pagine lette (senza `+"`<script>` e `<style>`: dentro c'e' il payload RSC, non la pagina)");
    },
  },

  {
    id: ID.contenuti,
    nome: "contenuti e permessi dell'anonimo",
    async esegui(ctx, args) {
      const esito = premesseContenuti(ctx, args);
      if (esito.motivo) return record(this.id, this.nome, "skipped", esito.motivo);
      if (esito.pass) return record(this.id, this.nome, "pass", esito.pass);

      const { dbUrl, schemi, contratto } = esito;
      const soglia = contratto.sogliaFrammento ?? SOGLIA_FRAMMENTO;
      const sorgenti = raccogliSorgenti(PROGETTO);
      const valoriPerSlot = leggiSlot(dbUrl, contratto);
      const conteggiAnon = misuraLetturaAnonima(dbUrl, fontiDichiarate(contratto), schemi[0]);
      // Le tabelle dei percorsi di scrittura pubblici si guardano al contrario:
      // qui «negata» e' l'esito giusto. Chi scrive non legge.
      const letturaScritture = misuraLetturaAnonima(
        dbUrl, new Set(contratto.scritture.map((s) => s.tabella)), schemi[0]);
      // Cio' che la firma di §Dati visibili a un anonimo dichiara pubblico si
      // confronta con cio' che il `grant` concede: sono due elenchi, e la
      // differenza e' una sottrazione. Vedi `findingsLetturePubbliche`.
      const colonneConcesse = misuraColonneConcesse(
        dbUrl, contratto.letture.map((l) => l.relazione), schemi[0]);
      const relazioniConcesse = misuraRelazioniConcesse(dbUrl, schemi);

      const { findings, mancanti } = findingsContenuti({
        contratto,
        valoriPerSlot,
        testoPerPagina: ctx.testoPagine ?? new Map(),
        cercaNeiSorgenti: (frammento) => frammentoNeiSorgenti(frammento, sorgenti),
        conteggiAnon,
        letturaScritture,
        colonneConcesse,
        relazioniConcesse,
        soglia,
      });

      // Il bersaglio si stampa SEMPRE, anche sul verde (DECISIONI.md §11) — e
      // le righe pubblicate che nessuno slot dichiara si contano a parte: sono
      // il perimetro che il contratto NON copre, e un numero taciuto e' il modo
      // in cui la quinta classe cieca e' rimasta cieca (difetto n°13).
      const dichiarate = new Set(contratto.slot.map((s) => s.chiave));
      const pubblicate = valoriPerSlot === null ? null
        : [...valoriPerSlot].filter(([chiave, v]) => Array.isArray(v) && !dichiarate.has(chiave)).length;
      const testa = `database: ${dbUrl.replace(/:[^:@]*@/, ":***@")} · schemi: ${schemi.join(", ")} · soglia distintiva: ${soglia} caratteri` +
        (pubblicate === null ? "" : ` · ${contratto.slot.length} slot dichiarati, ${pubblicate} righe pubblicate che nessuno slot dichiara`);
      if (mancanti.length > 0) {
        return record(this.id, this.nome, "skipped",
          [testa, ...mancanti, findings.length > 0 ? dettaglioFindings(findings) : ""].filter(Boolean).join("\n"));
      }
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.uscita,
    nome: "contratto d'uscita (handoff)",
    async esegui() {
      const percorso = trovaHandoff();
      const findings = contrattoUscita(
        percorso ?? `${HANDOFF_DIR}/<n>-vetrina-crafter.md`,
        percorso ? leggiSeCe(percorso) : null,
        verdettoDa(steps),
      );
      return conFindings(this.id, this.nome, findings, percorso ? `${percorso} · verdetto misurato: ${verdettoDa(steps)}` : "");
    },
  },
];

// ------------------------------------------------------------- aiutanti dei passi
function eseguiAuditStatico(ctx) {
  if (ctx.audit) return;
  try {
    ctx.audit = auditStatico({ progetto: PROGETTO });
  } catch (errore) {
    ctx.audit = { passi: [], errore: errore.message };
  }
}

function innesta(ctx, id, nome) {
  const trovato = ctx.audit?.passi?.find((p) => p.id === id);
  if (!trovato) {
    return record(id, nome, "skipped", `audit statico non eseguito: ${ctx.audit?.errore ?? "nessun esito"}`);
  }
  const passo = record(id, nome, trovato.status, trovato.detail);
  if (trovato.counts) passo.counts = trovato.counts;
  return passo;
}

/** L'handoff porta un numero che dipende da quanti agenti sono passati prima: si
 *  cerca per suffisso. Un gate che pretendesse `08-vetrina-crafter.md` sarebbe
 *  rosso su ogni progetto con un agente in piu'. */
function trovaHandoff() {
  const dir = join(PROGETTO, HANDOFF_DIR);
  if (!existsSync(dir)) return null;
  const trovato = readdirSync(dir).filter((n) => /-vetrina-crafter\.md$/.test(n)).sort().pop();
  return trovato ? `${HANDOFF_DIR}/${trovato}` : null;
}

function dataHandoffSchemaForge() {
  const dir = join(PROGETTO, HANDOFF_DIR);
  if (!existsSync(dir)) return null;
  const trovato = readdirSync(dir).filter((n) => /-schema-forge\.md$/.test(n)).sort().pop();
  return trovato ? dataConfermaDa(readFileSync(join(dir, trovato), "utf8")) : null;
}

/** Il file sorgente piu' recente e' piu' nuovo della build servita? */
function buildPiuVecchiaDeiSorgenti() {
  const buildId = join(PROGETTO, ".next", "BUILD_ID");
  if (!existsSync(buildId)) return null;
  const quandoBuild = statSync(buildId).mtimeMs;
  let piuRecente = null;
  for (const { percorso } of raccogliSorgenti(PROGETTO)) {
    const quando = statSync(join(PROGETTO, percorso)).mtimeMs;
    if (quando > quandoBuild && (!piuRecente || quando > piuRecente.quando)) piuRecente = { percorso, quando };
  }
  return piuRecente ? piuRecente.percorso : null;
}

function premesseContenuti(ctx, args) {
  if (!ctx.contratto) return { motivo: "contratto non leggibile: non si sa quali slot verificare" };
  const contratto = ctx.contratto;

  const senzaSlot = contratto.slot.length === 0;
  const senzaFonti = contratto.pagine.every((p) => p.fonti.filter((f) => f.tipo !== "slot").length === 0);
  // Un percorso di scrittura pubblico tiene questo passo acceso anche su un
  // sito senza un solo contenuto editabile: c'e' comunque una tabella da
  // guardare, ed e' quella su cui scrive uno sconosciuto.
  const senzaScritture = contratto.scritture.length === 0;
  if (senzaSlot && senzaFonti && senzaScritture) {
    if (!contratto.nessunoSlotDichiarato) {
      return { motivo: "il contratto non dichiara ne' slot ne' fonti di dati, e non scrive `Nessuno slot.`: non si distingue «questo sito non ha contenuti editabili» da «nessuno ha compilato la tabella»" };
    }
    return { pass: "il contratto dichiara «Nessuno slot.» e nessuna fonte di dati: non c'e' contenuto da verificare.\nATTENZIONE: e' una dichiarazione firmata, non una misura — se e' falsa, questo passo e' verde su un sito coi testi cablati" };
  }

  if (!dove("psql")) {
    return { motivo: "`psql` non disponibile nel PATH: il database NON e' stato interrogato, e la Legge n°3 di questa skill non e' stata verificata affatto" };
  }
  const testoConfig = leggiSeCe(join("supabase", "config.toml"));
  const dbUrl = args.dbUrl ?? (testoConfig ? urlDbProgetto(testoConfig) : null);
  if (!dbUrl) {
    return { motivo: "database del progetto non risolvibile: serve `--db-url` esplicito, oppure `[db].port` in `supabase/config.toml`. L'ambiente non viene mai consultato (DECISIONI.md §11 e §14)" };
  }
  const schemi = testoConfig ? schemiEsposti(testoConfig) : ["public"];
  if (!schemi) {
    return { motivo: "`[api].schemas` presente ma illeggibile in `supabase/config.toml`: non si ripiega su `public`, sarebbe un audit parziale con l'aria di uno completo" };
  }
  if (!contratto.tabellaContenuti && contratto.slot.length > 0) {
    return { motivo: "il contratto dichiara slot ma non la riga `Tabella dei contenuti:`: non si sa quale tabella interrogare" };
  }
  return { dbUrl, schemi, contratto };
}

/**
 * I valori di testo di ogni riga pubblicata, per chiave.
 *
 * Ritorna `null` — e non una Mappa vuota — quando la tabella NON e' stata
 * interrogata: senza questa distinzione un `psql` che fallisce produrrebbe un
 * `block` per ogni slot dichiarato («non c'e' nessuna riga pubblicata»), cioe'
 * N diagnosi sbagliate al posto di una verifica mancante.
 */
function leggiSlot(dbUrl, contratto) {
  const valori = new Map();
  const tc = contratto.tabellaContenuti;
  if (!tc) return null;
  if (![tc.tabella, tc.colonnaChiave, tc.colonnaPubblicato].every((n) => IDENTIFICATORE.test(n))) return null;

  // `to_jsonb(t)` invece di elencare le colonne: quali colonne contengano il
  // testo non lo dichiara nessuno, e chiederlo al contratto vorrebbe dire una
  // riga di sintassi in piu' per ogni progetto. Si prendono tutti i valori di
  // testo della riga, e `frammentoDistintivo` scarta quelli che non sono
  // contenuto (chiave primaria e date: vedi `VALORE_TECNICO`).
  const righeDb = interroga(dbUrl,
    `select ${tc.colonnaChiave}::text, to_jsonb(t)::text from ${tc.tabella} t where ${tc.colonnaPubblicato}`);
  if (righeDb === null) return null;

  for (const s of contratto.slot) valori.set(s.chiave, null);
  for (const [chiave, json] of righeDb) {
    if (!chiave) continue;
    try {
      const oggetto = JSON.parse(json);
      valori.set(chiave.toLowerCase(), Object.values(oggetto).filter((v) => typeof v === "string"));
    } catch { /* riga illeggibile: resta `null`, cioe' verifica non fatta */ }
  }
  return valori;
}

/**
 * Cosa vede di una relazione un VISITATORE ANONIMO, non cosa c'e' dentro.
 *
 * `set role anon` e' l'unico modo di misurarlo: come `postgres` la RLS non si
 * applica affatto, e un conteggio preso cosi' direbbe che la pagina ha dati
 * mentre il sito serve una lista vuota.
 *
 * Quattro esiti, e tenerli separati e' tutto il punto (misurato sul banco del
 * collaudo il 2026-08-04, dove ne collassavano tre in uno):
 *   `null`                     non interrogata → verifica MANCANTE
 *   `{ stato: "assente" }`     la relazione non esiste
 *   `{ stato: "negata" }`      esiste, e l'anonimo NON puo' leggerla
 *   `{ stato: "letta", righe }` esiste, e l'anonimo ne legge `righe`
 * Cosa sia buono e cosa sia un difetto lo decide chi chiama: per una fonte di
 * pagina «negata» e' un difetto, per la tabella di un modulo pubblico e' la
 * cosa giusta.
 */
function misuraLetturaAnonima(dbUrl, nomi, schemaDefault) {
  const esiti = new Map();
  for (const nome of nomi) {
    const qualificata = nome.includes(".") ? nome : `${schemaDefault}.${nome}`;
    if (!IDENTIFICATORE.test(nome) || !IDENTIFICATORE.test(qualificata)) {
      esiti.set(nome, null);
      continue;
    }
    const esistenza = interroga(dbUrl, `select to_regclass('${qualificata}') is not null;`);
    if (esistenza === null || esistenza.length === 0) { esiti.set(nome, null); continue; }
    if (!/^t/i.test(esistenza[esistenza.length - 1][0])) { esiti.set(nome, { stato: "assente", righe: null }); continue; }

    const conteggio = interrogaConEsito(dbUrl, `set role anon; select count(*) from ${qualificata};`);
    if (conteggio.righe === null) {
      // La relazione esiste e la connessione funziona (l'abbiamo appena usata):
      // se `psql` rifiuta ADESSO e dice `42501`, e' la policy o il `grant`, non
      // un intoppo. Qualunque altro errore resta una verifica non fatta.
      esiti.set(nome, PERMESSO_NEGATO.test(conteggio.errore) ? { stato: "negata", righe: null } : null);
      continue;
    }
    esiti.set(nome, conteggio.righe.length > 0
      ? { stato: "letta", righe: Number(conteggio.righe[conteggio.righe.length - 1][0]) }
      : null);
  }
  return esiti;
}

/**
 * Le colonne su cui `anon` ha `select`, relazione per relazione.
 *
 * `information_schema.column_privileges` e' la vista giusta e non
 * `role_table_grants`: regge tutti e due i modi di concedere — `grant select on
 * t` (che si espande a ogni colonna) e `grant select (a, b) on t`, che e' la
 * forma con cui si rimedia quando questo controllo diventa rosso. Verificato
 * sul banco il 2026-08-04 su una tabella sonda con un grant di sole due colonne.
 *
 * `null` = non interrogata, cioe' verifica MANCANTE. Un elenco vuoto invece e'
 * una misura riuscita: `anon` non ne legge nemmeno una colonna.
 */
function misuraColonneConcesse(dbUrl, nomi, schemaDefault) {
  const esiti = new Map();
  for (const nome of new Set(nomi)) {
    const [schema, relazione] = nome.includes(".") ? nome.split(".") : [schemaDefault, nome];
    if (!IDENTIFICATORE.test(schema) || !IDENTIFICATORE.test(relazione)) { esiti.set(nome, null); continue; }
    const righe = interroga(dbUrl,
      `select column_name from information_schema.column_privileges ` +
      `where table_schema = '${schema}' and table_name = '${relazione}' ` +
      `and grantee = 'anon' and privilege_type = 'SELECT' order by column_name;`);
    esiti.set(nome, righe === null ? null : righe.map((r) => r[0]).filter(Boolean));
  }
  return esiti;
}

/**
 * Ogni relazione degli schemi esposti su cui `anon` ha `select`.
 *
 * E' l'elenco che il contratto deve coprire: una tabella che non compare in
 * §Dati visibili a un anonimo e che `anon` legge e' pubblicata senza che nessuno
 * l'abbia firmata. Si guardano SOLO gli schemi che `config.toml` espone
 * (`[api].schemas`): quelli sono le relazioni raggiungibili da PostgREST, e
 * quindi dal browser di chiunque.
 *
 * `null` = non interrogata, cioe' verifica MANCANTE.
 */
function misuraRelazioniConcesse(dbUrl, schemi) {
  const validi = schemi.filter((s) => IDENTIFICATORE.test(s));
  if (validi.length === 0) return null;
  const elenco = validi.map((s) => `'${s}'`).join(", ");
  const righe = interroga(dbUrl,
    `select distinct table_name from information_schema.column_privileges ` +
    `where table_schema in (${elenco}) and grantee = 'anon' and privilege_type = 'SELECT' order by table_name;`);
  return righe === null ? null : new Set(righe.map((r) => r[0]).filter(Boolean));
}

const fontiDichiarate = (contratto) =>
  new Set(contratto.pagine.flatMap((p) => p.fonti.filter((f) => f.tipo !== "slot").map((f) => f.nome)));

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE VETRINA: ${verde ? "VERDE" : "ROSSO"} (${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti su ${riassunto.passi} passi)\n`);
  for (const s of steps) {
    console.log(`${{ pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status]}  ${s.name}`);
    // Il dettaglio si stampa anche sui passi verdi: e' li' che finiscono l'URL
    // interrogato, il build id, il database e chi ha firmato il contratto.
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, dbUrl: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(PROGETTO, "docs")) && !existsSync(join(PROGETTO, "src", "app"))) {
    console.error(`Ne' docs/ ne' src/app/ in ${PROGETTO}: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.`);
    process.exit(2);
  }
  if (!args.url) {
    const testo = leggiSeCe(CONTRATTO);
    const dichiarato = testo ? leggiContratto(testo).urlDichiarato : null;
    if (dichiarato) {
      args.url = dichiarato;
      console.error(`--url assente: uso l'indirizzo dichiarato in ${CONTRATTO} → ${dichiarato}`);
    }
  }
  if (!args.url) {
    console.error(
      `Manca --url, e il contratto non dichiara nessuna riga \`URL servito:\`. Il gate NON indovina un \`localhost:3000\`: e' cosi' che si legge l'app di un altro progetto e si stampa \`pass\`.\n` +
      "Avvia la build con `npm run build && npm run start -- -p <porta>` e passa quell'indirizzo, oppure scrivilo nel contratto.",
    );
    process.exit(2);
  }
  const ctx = { contratto: null, baseUrl: null, audit: null, risposte: null, testoPagine: null };
  for (const passo of PASSI) await passo.esegui(ctx, args);
  process.exit(verdetto(args.json));
}

// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde. Misurato il
// 2026-08-02 su questa macchina (Node 20.12.2) sui gate delle altre tre skill.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
