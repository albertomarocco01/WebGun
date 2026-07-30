import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Bottone } from "@/components/ui/Bottone";
import { esci } from "@/modules/admin/accesso";
import { richiediStaff, sezioniPer } from "@/modules/admin/guardia";

/**
 * Tutto il gestionale fuori dall'indice, ereditato da ogni rotta figlia.
 *
 * MISURATO il 2026-07-30, e va scritto perche' cambia il valore di questa riga:
 * un crawler **non la riceve mai**. `richiediStaff()` gira prima del rendering e
 * rimanda a `/accedi`, quindi cio' che esce da `/admin` senza sessione e' un
 * redirect, non un documento con dei metatag. L'esclusione dall'indice la fa
 * gia' la guardia.
 *
 * Resta qui come difesa in profondita', non come difesa: se un giorno una rotta
 * sotto `/admin` diventasse pubblica per errore, nascerebbe gia' `noindex`
 * invece di nascere indicizzabile. Una riga che oggi non fa niente e domani
 * potrebbe salvare una pagina — non una riga che oggi fa quello che dice.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * La guardia della sezione: gira sul server prima di ogni pagina figlia, e
 * nessuna rotta sotto `/admin` risponde senza passare di qui.
 * Il middleware NON basta — rinfresca i cookie e si puo' aggirare.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const persona = await richiediStaff();

  // Il menu mostra solo le sezioni che la guardia lascia davvero aprire: stessa
  // fonte, `SEZIONI`. Un menu che offre una porta chiusa non e' un dettaglio di
  // stile — insegna a chi lavora che il gestionale sbaglia a caso.
  const voci = sezioniPer(persona.ruolo);

  return (
    <div className="mx-auto flex max-w-6xl gap-8 p-6">
      <nav aria-label="Sezioni del gestionale" className="w-48 shrink-0">
        <p className="mb-3 text-sm text-slate-600">
          {persona.full_name} · {persona.ruolo}
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {voci.map((voce) => (
            <li key={voce.href}>
              <Link href={voce.href} className="hover:underline">
                {voce.testo}
              </Link>
            </li>
          ))}
        </ul>
        <form action={esci} className="mt-4">
          <Bottone tono="secondario">Esci</Bottone>
        </form>
      </nav>
      <main className="grow">{children}</main>
    </div>
  );
}
