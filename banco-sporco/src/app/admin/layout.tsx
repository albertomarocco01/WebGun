import Link from "next/link";
import type { ReactNode } from "react";

import { Bottone } from "@/components/ui/Bottone";
import { esci } from "@/modules/admin/accesso";
import { richiediStaff } from "@/modules/admin/guardia";

const VOCI = [
  { href: "/admin/prodotti", testo: "Prodotti" },
  { href: "/admin/categorie", testo: "Categorie" },
  { href: "/admin/ordini", testo: "Ordini" },
  { href: "/admin/clienti", testo: "Clienti" },
  { href: "/admin/contenuti", testo: "Contenuti" },
  { href: "/admin/personale", testo: "Personale" },
];

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

  return (
    <div className="mx-auto flex max-w-6xl gap-8 p-6">
      <nav aria-label="Sezioni del gestionale" className="w-48 shrink-0">
        <p className="mb-3 text-sm text-slate-600">
          {persona.full_name} · {persona.ruolo}
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {VOCI.map((voce) => (
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
