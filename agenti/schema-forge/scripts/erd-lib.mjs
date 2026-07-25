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
export const pulisci = (v) => (v ?? "").replace(/\r/g, "");

export const vero = (v) => {
  const s = pulisci(v);
  return s === "true" || s === "t";
};

const riga = (r) => r.map(pulisci);

/**
 * @param colonne   righe [tabella, colonna, tipo, notNull, isPk, isFk]
 * @param relazioni righe [origine, destinazione, nomeVincolo, obbligatoria]
 */
export function costruisciErd({ colonne, relazioni }) {
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
    const [origine, destinazione, nome, obbligatoria] = riga(r);
    // il figlio con FK obbligatoria appartiene sempre a un padre: ||--o{
    const cardinalita = vero(obbligatoria) ? "||--o{" : "|o--o{";
    righe.push(`    ${destinazione} ${cardinalita} ${origine} : "${nome}"`);
  }

  return righe.join("\n");
}
