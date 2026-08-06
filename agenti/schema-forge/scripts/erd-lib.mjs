/**
 * erd-lib.mjs — La COSTRUZIONE del diagramma ER, senza una riga di I/O.
 *
 * COSA FA: prende le righe gia' lette dal catalogo di Postgres (array di array
 * di stringhe, come le restituisce `query()` di erd.mjs) e ritorna la stringa
 * `erDiagram` di Mermaid.
 *
 * PERCHE': stesso motivo di audit-lib.mjs — il cast booleano sbagliato aveva
 * spento PK, FK, "obbligatorio" e le cardinalita' obbligatorie senza che nulla
 * lo segnalasse, perche' il diagramma si poteva provare solo con un database.
 */

// Vedi audit-lib.mjs: CRLF di psql su Windows e rese booleane 'true'/'t'.
const pulisci = (v) => (v ?? "").replace(/\r/g, "");

const vero = (v) => {
  const s = pulisci(v);
  return s === "true" || s === "t";
};

const riga = (r) => r.map(pulisci);

// Vedi audit-lib.mjs: si divide sul separatore di record di psql, non sui
// newline. Qui il rischio e' minore (nomi di colonna e di tabella non contengono
// a capo) ma il guscio e' lo stesso e la regola dev'essere una sola.
export function righeDaPsql(stdout, sep = "\x1f", rs = "\x1e") {
  return (stdout ?? "")
    .split(rs)
    .map((r) => r.replace(/\r?\n$/, ""))
    .filter((r) => r.length > 0)
    .map((r) => r.split(sep));
}

/**
 * L'ARITA' ANCHE QUI (2026-08-06).
 *
 * `audit-lib.mjs` l'ha guadagnata col § H5 del referto — un separatore di campo
 * dentro un testo libero del catalogo sposta le colonne — e questa libreria era
 * rimasta indietro: misurato lo stesso giorno con una sonda ostile,
 * `righeDaPsql("a\x1fb\x1fc\x1fd\x1e")` restituisce quattro campi dove la query
 * ne dichiara tre, e nessuno lo diceva.
 *
 * Qui il danno e' minore e va scritto: questo file produce un DIAGRAMMA, non un
 * verdetto, e un nome di tabella o di colonna un separatore di controllo non lo
 * contiene. Ma il commento che diceva «qui il rischio e' minore» e' esattamente
 * la frase che questo pacchetto ha visto smentita tre volte in due giorni, e uno
 * scanner immune per fortuna torna difettoso al primo riuso.
 *
 * Le otto righe sono duplicate da `audit-lib.mjs` per la stessa decisione
 * dichiarata di sempre: le due librerie di Schema Forge restano indipendenti.
 */
export function recordDiAritaSbagliata(record, arita) {
  return (record ?? [])
    .map((campi, indice) => ({ indice, quanti: campi.length }))
    .filter((r) => r.quanti !== arita);
}

export function motivoAritaSbagliata(nomeQuery, arita, rotti) {
  const primi = rotti.slice(0, 3)
    .map((r) => `record ${r.indice + 1}: ${r.quanti} campi invece di ${arita}`)
    .join("; ");
  return `la query \`${nomeQuery}\` ha restituito ${rotti.length} record con un numero di campi diverso da quello dichiarato (${primi}). ` +
    "Quasi certamente un separatore di campo (\\x1f) o di record (\\x1e) dentro un testo del catalogo. " +
    "Diagramma NON generato: meglio nessun diagramma di uno che descrive un altro catalogo.";
}

/**
 * @param colonne   righe [tabella, colonna, tipo, notNull, isPk, isFk]
 * @param relazioni righe [origine, destinazione, nomeVincolo, obbligatoria,
 *                         schemaDestinazione, esclusiva]
 * @param schemi    gli schemi richiesti: cio' che sta fuori si qualifica
 */
export function costruisciErd({ colonne, relazioni, schemi = ["public"] }) {
  const righe = ["erDiagram"];

  let tabellaCorrente = null;
  for (const r of colonne) {
    const [tabella, colonna, tipo, notNull, isPk, isFk] = riga(r);
    if (tabella !== tabellaCorrente) {
      if (tabellaCorrente !== null) righe.push("    }");
      righe.push(`    ${tabella} {`);
      tabellaCorrente = tabella;
    }
    const chiave = vero(isPk) ? " PK" : vero(isFk) ? " FK" : "";
    const obbligatorio = vero(notNull) ? ' "obbligatorio"' : "";
    // Mermaid non accetta parentesi ne' virgole nel nome del tipo.
    righe.push(`        ${tipo.replace(/[^a-zA-Z0-9_]/g, "_")} ${colonna}${chiave}${obbligatorio}`);
  }
  if (tabellaCorrente !== null) righe.push("    }");

  for (const r of relazioni) {
    const [origine, destinazione, nome, obbligatoria, schemaDestinazione, esclusiva] = riga(r);
    // Se l'insieme di colonne della FK e' anche unico (o chiave primaria, come
    // profiles.id verso auth.users) la riga figlia non puo' ripetersi: e' 1:1.
    // Altrimenti il figlio con FK obbligatoria appartiene sempre a un padre.
    const cardinalita = vero(esclusiva)
      ? (vero(obbligatoria) ? "||--||" : "||--o|")
      : (vero(obbligatoria) ? "||--o{" : "|o--o{");
    // Un'entita' fuori dagli schemi richiesti si qualifica: `auth.users` e una
    // eventuale `public.users` non sono la stessa cosa e non devono collidere.
    const entita = schemaDestinazione && !schemi.includes(schemaDestinazione)
      ? `${schemaDestinazione}_${destinazione}`
      : destinazione;
    righe.push(`    ${entita} ${cardinalita} ${origine} : "${nome}"`);
  }

  return righe.join("\n");
}
