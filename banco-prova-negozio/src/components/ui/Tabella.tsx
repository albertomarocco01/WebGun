import type { ReactNode } from "react";

/**
 * Cucitura per Fly UI: quando la libreria di componenti esistera', si
 * riscrive il corpo di questi tre file e non le pagine. Le pagine importano
 * solo da `@/components/ui`, mai classi Tailwind sparse nel markup di dominio.
 *
 * `caption` non e' decorativa: e' cio' che un lettore di schermo annuncia
 * entrando nella tabella (costituzione, regola 5 — accessibilita').
 */
export function Tabella({
  intestazioni,
  didascalia,
  children,
}: {
  intestazioni: readonly string[];
  didascalia: string;
  children: ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{didascalia}</caption>
      <thead>
        <tr className="border-b border-slate-300 text-left">
          {intestazioni.map((testo) => (
            <th key={testo} scope="col" className="px-3 py-2 font-semibold">
              {testo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Riga({ children }: { children: ReactNode }) {
  return <tr className="border-b border-slate-200">{children}</tr>;
}

export function Cella({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
