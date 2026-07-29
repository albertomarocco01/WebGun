import type { ReactNode } from "react";

/**
 * Cucitura per Fly UI (vedi `Tabella.tsx`).
 *
 * `nome` e' il nome del campo nel `FormData` — lo legge l'azione server e non
 * puo' cambiare. `suffisso` serve solo a rendere unico l'`id` nel documento
 * quando la stessa pagina ripete lo stesso modulo per piu' righe: due `id`
 * uguali romperebbero il collegamento `label`/`input`, cioe' l'unica cosa che
 * dice a un lettore di schermo di che campo si tratta.
 */
function idDom(nome: string, suffisso?: string) {
  return suffisso ? `${nome}-${suffisso}` : nome;
}

export function Campo({
  nome,
  etichetta,
  valore,
  tipo = "text",
  obbligatorio = false,
  descrizione,
  suffisso,
}: {
  nome: string;
  etichetta: string;
  valore?: string | number | null;
  tipo?: "text" | "number" | "email" | "password" | "url";
  obbligatorio?: boolean;
  descrizione?: string;
  suffisso?: string;
}) {
  const id = idDom(nome, suffisso);
  const idAiuto = descrizione ? `${id}-aiuto` : undefined;

  return (
    <p className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      <input
        id={id}
        name={nome}
        type={tipo}
        defaultValue={valore ?? ""}
        required={obbligatorio}
        aria-describedby={idAiuto}
        className="rounded border border-slate-400 px-2 py-1"
      />
      {descrizione ? (
        <span id={idAiuto} className="text-xs text-slate-600">
          {descrizione}
        </span>
      ) : null}
    </p>
  );
}

export function CampoScelta({
  nome,
  etichetta,
  valore,
  opzioni,
  suffisso,
}: {
  nome: string;
  etichetta: string;
  valore?: string | null;
  opzioni: readonly { valore: string; testo: string }[];
  suffisso?: string;
}) {
  const id = idDom(nome, suffisso);

  return (
    <p className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      <select
        id={id}
        name={nome}
        defaultValue={valore ?? ""}
        className="rounded border border-slate-400 px-2 py-1"
      >
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.testo}
          </option>
        ))}
      </select>
    </p>
  );
}

export function CampoTesto({
  nome,
  etichetta,
  valore,
  suffisso,
}: {
  nome: string;
  etichetta: string;
  valore?: string | null;
  suffisso?: string;
}) {
  const id = idDom(nome, suffisso);

  return (
    <p className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      <textarea
        id={id}
        name={nome}
        rows={4}
        defaultValue={valore ?? ""}
        className="rounded border border-slate-400 px-2 py-1"
      />
    </p>
  );
}

export function CampoInterruttore({
  nome,
  etichetta,
  acceso,
  suffisso,
}: {
  nome: string;
  etichetta: string;
  acceso: boolean;
  suffisso?: string;
}) {
  const id = idDom(nome, suffisso);

  return (
    <p className="flex items-center gap-2">
      <input
        id={id}
        name={nome}
        type="checkbox"
        defaultChecked={acceso}
        className="size-4"
      />
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
    </p>
  );
}

export function Modulo({
  azione,
  children,
}: {
  azione: (dati: FormData) => Promise<void>;
  children: ReactNode;
}) {
  return (
    <form action={azione} className="flex flex-col gap-3">
      {children}
    </form>
  );
}
