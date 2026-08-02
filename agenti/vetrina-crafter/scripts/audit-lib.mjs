/**
 * audit-lib.mjs — Le regole che guardano il CODICE del progetto, senza I/O.
 *
 * Qui non si apre nessun file e non si tocca la rete: sono funzioni da testo a
 * verdetto. I gusci di I/O sono `vetrina-audit.mjs` e `verify.mjs`.
 *
 * La divisione con `progetto-lib.mjs` non e' organizzativa:
 *   - qui  → cio' che si legge nei SORGENTI (cucitura, chiavi, client);
 *   - la'  → cio' che si legge nel CONTRATTO e nell'APP SERVITA.
 * Le due librerie girano sempre insieme dentro lo stesso gate, quindi
 * `progetto-lib` importa da qui invece di riscrivere i primitivi: e' la stessa
 * scelta di gestionale-crafter, e per lo stesso motivo — la dipendenza non
 * accoppia niente che fosse separato.
 *
 * Il motivo per cui le regole stanno qui e non nei gusci: una regola che si puo'
 * eseguire solo con un progetto costruito e servito davanti e' una regola che
 * puo' restare spenta per mesi senza che nessuno lo sappia.
 */

// ------------------------------------------------------------------- comuni
export const senzaBom = (testo) => String(testo ?? "").replace(/^\uFEFF/, "");

/** CRLF e BOM non portano significato: si normalizzano una volta sola,
 *  all'ingresso, e solo loro. A Schema Forge sono gia' costati una regola morta
 *  e un confronto di tipi sempre fallito. */
export const righe = (testo) => senzaBom(testo).split(/\r?\n/);

/** Un valore che finisce dentro una RegExp va reso letterale, o un punto in un
 *  nome di file diventa «un carattere qualsiasi». */
export const perRegExp = (testo) => String(testo ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** I percorsi si confrontano con le barre in avanti: su Windows arrivano con
 *  le barre rovesce, e due percorsi uguali smettono di esserlo. */
export const conBarre = (percorso) => String(percorso ?? "").replace(/\\/g, "/");

export const dettaglioFindings = (findings) =>
  findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}`).join("\n");

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

/** Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano
 *  e finiscono nell'handoff, ma non bloccano. */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

/** Una riga di commento non dichiara niente. Senza questo, un commento che
 *  spiega perche' NON si usa `service_role` diventerebbe un rilievo su
 *  `service_role` — e il primo a scriverlo sarebbe questo repo. */
export const eCommento = (riga) => /^\s*(\/\/|\*|\/\*)/.test(riga);

// --------------------------------------------- eseguibili risolti a mano su Windows
// `spawnSync(cmd, args)` senza shell NON consulta PATHEXT: uno shim `.cmd`
// (npx, eslint installati da npm) risulta ENOENT sul nome e EINVAL sul percorso
// pieno — Node rifiuta `.cmd`/`.bat` senza shell dalla mitigazione della
// CVE-2024-27980. NON si abilita `shell: true`: li' gli argomenti vengono
// concatenati invece che passati come vettore, e questo gate passa URL e
// percorsi con spazi (questa skill vive sotto «Web Gun»).
// Prezzo gia' pagato da Schema Forge, Flow Sentinel e Speed Demon: non si ripaga.
const ESTENSIONE_ESEGUIBILE = /\.(exe|cmd|bat|com)$/i;

/** `where npx` elenca PER PRIMO lo script di shell senza estensione, quello per
 *  Git Bash, che Windows non sa eseguire. Prendere `[0]` fa fallire lo spawn su
 *  una macchina dove il comando funziona benissimo. */
export function primoEseguibile(uscitaWhere) {
  const trovate = righe(uscitaWhere).map((r) => r.trim()).filter(Boolean);
  return trovate.find((r) => ESTENSIONE_ESEGUIBILE.test(r)) ?? trovate[0] ?? null;
}

export function formaEseguibile(nome, cercaPercorso, piattaforma = process.platform) {
  if (piattaforma !== "win32") return { file: nome, prefisso: [] };
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: nome, prefisso: [] };
  return /\.(cmd|bat)$/i.test(trovato)
    ? { file: "cmd.exe", prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

/**
 * Gli argomenti che NON sopravvivono a `cmd /c`.
 *
 * `cmd` ri-analizza la riga che Node ha composto, e un argomento con spazi fa
 * collassare il virgolettato del PROGRAMMA — che sta all'inizio, e finisce
 * troncato al primo spazio del suo percorso. Misurato da Speed Demon il
 * 2026-07-30: l'errore parlava di `C:\Program`, cioe' di tutt'altro argomento.
 * La difesa non e' virgolettare meglio: e' non passarli, e riconoscerli prima.
 */
export function argomentiOstiliACmd(args, piattaforma = process.platform) {
  if (piattaforma !== "win32") return [];
  return args.filter((a) => typeof a === "string" && /\s/.test(a));
}

// ----------------------------------------------------------------- importazioni
/**
 * Le importazioni di un file, come `{ nomi, da }`.
 *
 * La clausola vieta `;` e le virgolette, ed e' la lezione che Flow Sentinel ha
 * pagato il 2026-07-28: il suo ritaglio partiva dal PRIMO import del file,
 * quindi in una spec vera i nomi raccolti erano quelli di tutti gli import
 * precedenti messi insieme. Vietare `;` e le virgolette impedisce alla clausola
 * di scavalcare il confine dell'istruzione anche quando il progetto non mette
 * il punto e virgola: il `from "..."` precedente contiene virgolette e la
 * fermerebbe comunque.
 */
const RE_IMPORT = /(^|\n)[ \t]*import\s+(?:type\s+)?([^;"'`]*?)\s*from\s*["']([^"']+)["']/g;

export function importazioni(testo) {
  const trovate = [];
  const codice = senzaBom(testo);
  for (const m of codice.matchAll(RE_IMPORT)) {
    trovate.push({ nomi: nomiImportati(m[2]), da: m[3].trim() });
  }
  return trovate;
}

/** `A`, `{ B, C as D }`, `* as ns` — l'alias conta come nome usato, non come
 *  nome importato: chi rinomina `Bottone` in `Btn` sta comunque importando
 *  `Bottone`, ed e' quello che la regola della cucitura deve vedere. */
function nomiImportati(clausola) {
  const nomi = [];
  const testo = String(clausola ?? "");
  const graffe = /\{([^}]*)\}/.exec(testo);
  if (graffe) {
    for (const pezzo of graffe[1].split(",")) {
      const nome = pezzo.trim().split(/\s+as\s+/)[0].trim();
      if (nome) nomi.push(nome);
    }
  }
  const fuori = testo.replace(/\{[^}]*\}/g, "").replace(/\*\s+as\s+\w+/g, "");
  for (const pezzo of fuori.split(",")) {
    const nome = pezzo.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(nome)) nomi.push(nome);
  }
  return [...new Set(nomi)];
}

/**
 * Un percorso di import punta a una cartella del progetto?
 *
 * EURISTICA DICHIARATA, e va letta per quello che e'. Gli alias (`@/`, `~/`) si
 * risolvono con `tsconfig.json`, i percorsi relativi con la posizione del file:
 * risolverli davvero vorrebbe dire implementare la risoluzione dei moduli di
 * TypeScript dentro un gate. Qui si confronta la CODA del percorso dichiarato
 * (`src/components/ui` → `components/ui`) con la coda dell'import, dopo aver
 * tolto prefissi relativi e alias.
 *
 * Cosa NON vede: due cartelle diverse con la stessa coda (`app/components/ui` e
 * `src/components/ui` in un monorepo). Cosa vede: tutte le forme che questa
 * skill genera e tutte quelle che un umano scrive a mano.
 */
export function puntaA(da, cartella) {
  const coda = conBarre(cartella)
    .replace(/^\.?\/*/, "")
    .replace(/^src\//, "")
    // L'estensione si toglie dal BERSAGLIO: `moduliClient` dichiara file
    // (`src/lib/supabase/public.ts`) e un import non porta mai l'estensione
    // (`@/lib/supabase/public`). Senza questa riga la regola che vieta alla
    // cucitura di importare il client dei dati non scattava MAI — trovato dal
    // suo stesso test, che si aspettava due rilievi e ne vedeva uno.
    .replace(/\.(m?[jt]sx?|cjs)$/i, "")
    .replace(/\/+$/, "");
  if (!coda) return false;
  const pulito = conBarre(da).replace(/^[@~]\//, "").replace(/^(\.\.?\/)+/, "").replace(/^src\//, "");
  return pulito === coda || pulito.startsWith(`${coda}/`) || pulito.endsWith(`/${coda}`) ||
    pulito.includes(`/${coda}/`);
}

const dentro = (percorso, cartella) => {
  const p = conBarre(percorso);
  const c = conBarre(cartella).replace(/\/+$/, "");
  return p === c || p.startsWith(`${c}/`);
};

/** `src/components/ui/Bottone.tsx` → `Bottone`. */
const nomeBase = (percorso) => conBarre(percorso).split("/").pop().replace(/\.[jt]sx?$/, "");

// ------------------------------------------------------------- regola: cucitura
/**
 * La cucitura regge: e' l'unica fonte delle primitive, e non sa niente di
 * dominio.
 *
 * La seconda meta' e' quella che quasi nessuno scrive, ed e' quella che rende
 * vera la promessa di DECISIONI.md §21 — «si riscrive il corpo di quei file,
 * non le pagine». Una primitiva che importa una query o il client dei dati non
 * e' sostituibile: sostituirla vorrebbe dire riscrivere anche cio' che ci sta
 * dentro.
 */
export function regolaCucitura(file, config) {
  const findings = [];
  const primitive = new Set(config.primitive ?? []);
  const cucitura = config.cucitura ?? "";
  const vietate = ["src/modules", "src/app", ...(config.moduliClient ?? [])];

  for (const { percorso, testo } of file) {
    const inCucitura = dentro(percorso, cucitura);

    for (const imp of importazioni(testo)) {
      if (inCucitura) {
        const colpevole = vietate.find((v) => puntaA(imp.da, v));
        if (colpevole) {
          findings.push({
            severity: "block",
            object: `${conBarre(percorso)} → ${imp.da}`,
            message: `la cucitura importa \`${colpevole}\`: una primitiva che sa di dominio o che legge dati non e' sostituibile, e la promessa di DECISIONI.md §21 smette di valere`,
            hint: "sposta la logica nella pagina o nel modulo che la usa, e lascia alla primitiva solo la sua forma",
          });
        }
        continue;
      }

      const daFuori = imp.nomi.filter((n) => primitive.has(n));
      if (daFuori.length > 0 && !puntaA(imp.da, cucitura)) {
        findings.push({
          severity: "block",
          object: `${conBarre(percorso)} → ${imp.da}`,
          message: `importa ${daFuori.map((n) => `\`${n}\``).join(", ")} da fuori la cucitura \`${cucitura}\`: e' una copia della primitiva, e il giorno della sostituzione ne resta indietro una`,
          hint: `importa da \`${cucitura}\`, oppure togli il nome dalle primitive dichiarate in vetrina.config.json`,
        });
      }
    }

    if (!inCucitura && primitive.has(nomeBase(percorso))) {
      findings.push({
        severity: "issue",
        object: conBarre(percorso),
        message: `si chiama come la primitiva \`${nomeBase(percorso)}\` ma non sta nella cucitura: due file con lo stesso nome sono due componenti diversi, e nessuno se ne accorge finche' non divergono`,
        hint: `spostalo in \`${cucitura}\` o rinominalo`,
      });
    }
  }

  return findings;
}

// ------------------------------------------------------ regola: chiavi e client
const CHIAVI_DI_SERVIZIO = Object.freeze([
  { segno: /\bservice_role\b/, nome: "service_role" },
  { segno: /\bSUPABASE_SERVICE_ROLE_KEY\b/, nome: "SUPABASE_SERVICE_ROLE_KEY" },
  { segno: /\bSERVICE_ROLE_KEY\b/, nome: "SERVICE_ROLE_KEY" },
]);

/** `NEXT_PUBLIC_` e' un contratto col browser: quel valore finisce nel bundle e
 *  lo legge chiunque apra gli strumenti di sviluppo. Un nome che promette un
 *  segreto con quel prefisso e' un segreto pubblicato. */
const PUBBLICA_MA_SEGRETA = /\bNEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)[A-Z0-9_]*\b/;

/** Le forme con cui nasce un client dei dati. `createClient` e' supabase-js;
 *  `createBrowserClient`/`createServerClient` sono `@supabase/ssr`. */
const COSTRUISCE_CLIENT = /\b(createClient|createBrowserClient|createServerClient)\s*\(/;

/**
 * Il sito pubblico resta anonimo.
 *
 * Su un progetto che ha anche il gestionale questa regola e il suo `admin-audit`
 * guardano lo stesso `src/`: e' voluto. Una vetrina senza backoffice e' un
 * prodotto normale di questa pipeline — il sito che non amministra niente — e
 * li' il gestionale non gira mai. Un controllo di sicurezza che esiste solo se
 * gira un altro agente manca proprio dove il sito e' tutto pubblico.
 */
export function regolaChiaviEClient(file, config) {
  const findings = [];
  const ammessi = (config.moduliClient ?? []).map(conBarre);

  for (const { percorso, testo } of file) {
    const percorsoPulito = conBarre(percorso);
    const eModuloAmmesso = ammessi.some((m) => m === percorsoPulito);

    righe(testo).forEach((riga, i) => {
      if (eCommento(riga)) return;
      const numero = i + 1;

      for (const { segno, nome } of CHIAVI_DI_SERVIZIO) {
        if (segno.test(riga)) {
          findings.push({
            severity: "block",
            object: `${percorsoPulito}:${numero}`,
            message: `\`${nome}\` raggiungibile dal sito pubblico: quella chiave scavalca OGNI policy, e su una superficie interamente anonima e' la differenza fra un catalogo e l'anagrafica`,
            hint: "un permesso che manca si chiede a schema-forge; non si cambia chiave",
          });
        }
      }

      if (PUBBLICA_MA_SEGRETA.test(riga)) {
        findings.push({
          severity: "block",
          object: `${percorsoPulito}:${numero}`,
          message: "variabile con prefisso `NEXT_PUBLIC_` e un nome che promette un segreto: quel valore entra nel bundle e lo legge chiunque",
          hint: "toglile il prefisso e leggila solo sul server, oppure smetti di chiamarla segreta",
        });
      }

      if (!eModuloAmmesso && COSTRUISCE_CLIENT.test(riga)) {
        findings.push({
          severity: "block",
          object: `${percorsoPulito}:${numero}`,
          message: `client dei dati costruito fuori dai moduli dichiarati: ${ammessi.length > 0 ? ammessi.map((m) => `\`${m}\``).join(", ") : "(nessun modulo dichiarato in vetrina.config.json)"}`,
          hint: "e' il punto in cui una chiave sbagliata entra senza che nessuno la veda: un client solo, in un posto solo",
        });
      }
    });
  }

  return findings;
}

// ------------------------------------------- il testo di uno slot nei sorgenti
/**
 * Il frammento di uno slot compare nei sorgenti?
 *
 * E' la seconda meta' della Legge n°3, e da sola non basterebbe nessuna delle
 * due: la prima («sta in pagina») non distingue un contenuto letto dal database
 * da uno cablato che per caso coincide; questa lo distingue.
 *
 * Il confronto e' sul testo con gli spazi compattati, perche' un testo cablato
 * dentro il JSX arriva quasi sempre con a capo e rientri in mezzo.
 */
export function frammentoNeiSorgenti(frammento, file) {
  const ago = normalizzaSpazi(frammento);
  if (!ago) return [];
  return file
    .filter(({ testo }) => normalizzaSpazi(testo).includes(ago))
    .map(({ percorso }) => conBarre(percorso));
}

export const normalizzaSpazi = (testo) => senzaBom(testo).replace(/\s+/g, " ").trim();
