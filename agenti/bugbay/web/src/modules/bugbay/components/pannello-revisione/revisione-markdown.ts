/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Generazione del prompt Markdown per LLM dalla Campagna di revisione QA nel
 * modello DB-backed: le voci (`ChecklistItemRow`) — problemi / risolti / in
 * sospeso — raggruppate per area, con note del revisore e fasi operative
 * (analisi → piano → convenzioni → esecuzione). Funzione pura: riceve le voci
 * e le note libere e restituisce il documento.
 *
 * @indice
 * - generaPromptMarkdown → prompt completo dalle voci della campagna
 */

import type { ChecklistItemRow } from '@/modules/bugbay/data/revisione-checklist';
import { GENERAL_NOTE_KEY, raggruppaPerSezione, sezKey } from './revisione-stato';

interface VoceMd {
  sectionTitle: string;
  label: string;
  path: string;
  note: string;
}

export function generaPromptMarkdown(items: ChecklistItemRow[], notes: Record<string, string>): string {
  const now = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const sezioni = raggruppaPerSezione(items);
  const secNotes: Record<string, string> = {};
  for (const sez of sezioni) {
    const n = notes[sezKey(sez.title)]?.trim();
    if (n) secNotes[sez.title] = n;
  }

  const resolved: VoceMd[] = [];
  const issues: VoceMd[] = [];
  const pending: VoceMd[] = [];
  for (const it of items) {
    const e: VoceMd = {
      sectionTitle: it.sectionTitle,
      label: it.label,
      path: it.files[0] || it.urls[0]?.url || '-',
      note: (it.note || '').trim(),
    };
    if (it.status === 'ok') resolved.push(e);
    else if (it.status === 'problema') issues.push(e);
    else pending.push(e);
  }

  const bySection = (arr: VoceMd[]) => {
    const map: Record<string, VoceMd[]> = {};
    arr.forEach((e) => { (map[e.sectionTitle] = map[e.sectionTitle] || []).push(e); });
    return map;
  };

  let md = '';
  md += `# Prompt di Fix & Revisione QA — Campagna generata da Refresh con AI\n`;
  md += `> Sessione di revisione del ${now} · ${resolved.length} risolti · ${issues.length} problemi segnalati · ${pending.length} in sospeso\n\n`;
  md += `Sei un agente AI di sviluppo software senior con elevata competenza in Next.js (App Router), Supabase, Tailwind CSS e TypeScript.\n`;
  md += `Il tuo obiettivo è prendere in carico le segnalazioni QA riportate in questo documento, analizzarle e risolverle in modo sistematico seguendo le fasi sotto descritte.\n\n`;

  md += `## FASE 1: ANALISI E DOCUMENTAZIONE (\`segnalazioni_revisione.md\`)\n`;
  md += `Prima di apportare modifiche al codice:\n`;
  md += `1. Analizza accuratamente ogni problema descritto nell'elenco sotto riportato.\n`;
  md += `2. Crea o aggiorna il file \`docs/revisioni/segnalazioni_revisione.md\` nel workspace.\n`;
  md += `3. In questo documento, riscrivi ciascun problema in modo chiaro, dettagliato e professionale, indicando:\n`;
  md += `   - Il comportamento anomalo riscontrato e la causa tecnica (se evidente o da te riscontrata).\n`;
  md += `   - I file di codice o le rotte di routing direttamente interessati.\n`;
  md += `   - Eventuali note di implementazione.\n\n`;

  md += `## FASE 2: PIANO DI LAVORO OTTIMIZZATO (DALL'EASIEST AL HARDEST)\n`;
  md += `All'interno di \`docs/revisioni/segnalazioni_revisione.md\`, stila un piano di lavoro (Work Plan) sequenziale e prioritizzato:\n`;
  md += `1. **Attività Facili (Low Effort / Low Risk):** Inizia con correzioni di testo, stringhe hardcoded da spostare, layout/padding CSS errati tramite classi Tailwind, refactoring di import o warning TypeScript semplici.\n`;
  md += `2. **Attività Medie (Medium Effort):** Prosegui con validazioni di form, logiche di visualizzazione, gestione dello stato dei componenti, o bug di flusso semplici.\n`;
  md += `3. **Attività Complesse (High Effort / High Risk):** Concludi con modifiche strutturali, integrazioni con Supabase/database (tabelle, query, RLS), Server Actions complesse, notifiche, o flussi finanziari/Stripe.\n\n`;

  md += `## FASE 3: RIGIDO RISPETTO DELLE CONVENZIONI DI PROGETTO (\`docs/convenzioni/strutturaFile.md\`)\n`;
  md += `Ogni modifica al codice deve rispettare pedissequamente le convenzioni del repository:\n`;
  md += `1. **Header Obbligatorio:** Ogni file \`.ts\` o \`.tsx\` creato o modificato deve iniziare con l'header JSDoc contenente \`@convenzione\`, \`@descrizione\` e \`@indice\` aggiornato.\n`;
  md += `2. **Lunghezza File:** Se un file supera le 350 righe, è obbligatorio suddividerlo in sottomoduli. Mantieni idealmente ogni file sotto le 200 righe.\n`;
  md += `3. **Nessun Valore Hardcoded:** Sposta tutte le stringhe visibili all'utente in \`src/config/testi.ts\`, e le costanti di dominio in \`src/config/costanti.ts\`.\n`;
  md += `4. **Design System & Tailwind:** Non utilizzare mai valori arbitrari inline (es. NO \`text-[64px]\` o \`mt-[13px]\`). Usa esclusivamente i token definiti in \`tailwind.config.ts\` (es. spaziature \`s-1\` -> \`s-10\`, colori come \`navy\`, \`red\`, \`green\`, \`sky\`).\n`;
  md += `5. **Nessun File Jolly:** È vietato l'uso di \`utils.ts\` o \`helpers.ts\`. Crea file tematici coerenti.\n`;
  md += `6. **Strict TypeScript:** Evita categoricamente l'uso di \`any\`. Definisci tipi rigorosi.\n\n`;

  md += `## FASE 4: ESECUZIONE, BUILD E TESTING\n`;
  md += `1. Esegui le correzioni seguendo rigorosamente l'ordine del piano di lavoro da te redatto.\n`;
  md += `2. Ad ogni passo, verifica la validità del codice eseguendo:\n`;
  md += `   \`npm run type-check && npm run lint\`\n`;
  md += `3. Assicurati che non vengano introdotti nuovi warning TypeScript o errori ESLint.\n\n`;

  md += `---\n\n`;

  const general = (notes[GENERAL_NOTE_KEY] || '').trim();
  if (general) {
    md += `## NOTE GENERALI DEL REVISORE QA\n`;
    md += `\`\`\`text\n${general}\n\`\`\`\n\n`;
  }

  const secNoteEntries = Object.entries(secNotes);
  if (secNoteEntries.length > 0) {
    md += `## NOTE PER AREA DI REVISIONE\n`;
    secNoteEntries.forEach(([title, note]) => {
      md += `- **${title}:** ${note}\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  if (issues.length > 0) {
    md += `## ELENCO DEI PROBLEMI DA SISTEMARE (${issues.length})\n\n`;
    Object.entries(bySection(issues)).forEach(([title, voci]) => {
      md += `### Area: ${title}\n`;
      if (secNotes[title]) md += `> **Nota specifica dell'area:** ${secNotes[title]}\n\n`;
      voci.forEach((e) => {
        md += `#### [FIX] ${e.label}\n`;
        md += `- **Rotta / Path di riferimento:** \`${e.path}\`\n`;
        md += `- **Note del revisore:** ${e.note || '*(nessuna nota specifica fornita — esegui un\'analisi del comportamento previsto)*'}\n\n`;
      });
    });
  } else {
    md += `## ELENCO DEI PROBLEMI DA SISTEMARE\n\n> Nessun problema è attualmente segnalato come da sistemare.\n\n`;
  }

  if (resolved.length > 0) {
    md += `---\n\n## ELEMENTI VERIFICATI E RISOLTI (${resolved.length})\n\n`;
    Object.entries(bySection(resolved)).forEach(([title, voci]) => {
      md += `**${title}**\n`;
      voci.forEach((e) => { md += `- [OK] ${e.label} — \`${e.path}\`${e.note ? `\n  > Nota: ${e.note}` : ''}\n`; });
      md += '\n';
    });
  }

  if (pending.length > 0) {
    md += `---\n\n## ELEMENTI ANCORA DA VERIFICARE (${pending.length})\n\n`;
    Object.entries(bySection(pending)).forEach(([title, voci]) => {
      md += `**${title}**\n`;
      voci.forEach((e) => { md += `- [TODO] ${e.label} — \`${e.path}\`\n`; });
      md += '\n';
    });
  }
  return md.trimEnd();
}
