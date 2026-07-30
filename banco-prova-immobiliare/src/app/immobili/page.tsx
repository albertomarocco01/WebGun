import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

/**
 * T3 — il `canonical` di questa pagina era `/`, non `/immobili`.
 *
 * Errore di copia-incolla del blocco `metadata` della home: la pagina dichiarava
 * ai motori «l'originale e' quell'altra» e spariva dall'indice pur essendo
 * perfetta. Trovato dal collaudo del 2026-07-30 solo dopo aver insegnato al
 * gate a confrontare i canonical fra pagine diverse: prima, `seo-meta`
 * verificava che il tag CI FOSSE e chiudeva verde.
 */
export const metadata: Metadata = {
  title: "Immobili in vendita — Case di Langa",
  description: "Cascine, rustici e case di paese in vendita fra Alba, Barolo e Neive.",
  alternates: { canonical: "/immobili" },
};

const IMMOBILI = [
  { slug: "borgo-alto", nome: "Casa di paese a Borgo Alto", foto: "borgo-alto.png", prezzo: "185.000 €", mq: 140 },
  { slug: "casa-vigna", nome: "Casa con vigna a Neive", foto: "casa-vigna.png", prezzo: "420.000 €", mq: 260 },
  { slug: "rustico-noce", nome: "Rustico del Noce, Barolo", foto: "rustico-noce.png", prezzo: "310.000 €", mq: 210 },
];

export default function Immobili() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Immobili in vendita</h1>
      <ul className="mt-8 grid gap-8 sm:grid-cols-2">
        {IMMOBILI.map((i) => (
          <li key={i.slug} className="rounded-lg border border-stone-300 p-4">
            {/*
              T2 — `next/image` sulle schede (ottimizzazioni.md §1). Nessun
              `priority`: sono in griglia, non c'e' un elemento LCP da
              anticipare, e §2 dice che metterlo su tutte lo annulla. `sizes`
              dichiara che a schermo largo la scheda occupa meta' colonna: senza,
              il default e' `100vw` e ogni miniatura si porta a casa la variante
              da schermo intero.
            */}
            <Image
              src={`/foto/${i.foto}`}
              alt={i.nome}
              width={1600}
              height={1100}
              sizes="(max-width: 640px) 100vw, 448px"
              className="h-auto w-full rounded"
            />
            <h2 className="mt-3 text-xl font-semibold">
              <Link href={`/immobili/${i.slug}`}>{i.nome}</Link>
            </h2>
            <p className="mt-1">
              {i.prezzo} · {i.mq} m²
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
