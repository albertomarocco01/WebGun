import type { Metadata } from "next";
import Image from "next/image";
import CalcolatoreRata from "@/components/CalcolatoreRata";

export const metadata: Metadata = {
  title: "Case di Langa — agenzia immobiliare ad Alba",
  description:
    "Cascine, rustici e case di paese fra Alba e le Langhe. Selezione diretta, senza intermediari.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Case di Langa</h1>
      <p className="mt-3 max-w-2xl text-lg">
        Cascine, rustici e case di paese fra Alba e le Langhe. Le visitiamo tutte
        prima di pubblicarle.
      </p>

      {/*
        T1 — `next/image` sull'elemento LCP (ottimizzazioni.md §1 e §2).
        Prima: `<img>` nudo, file originale da 6,2 MB, nessuna dimensione.
        `width`/`height` riservano il box (CLS), `sizes` evita che un telefono
        scarichi la variante da desktop, `priority` e' su QUESTA immagine e su
        nessun'altra della pagina: §2, dieci `priority` non ordinano piu' niente.
        L'`alt` resta identico — non si tocca (§Ottimizzazioni vietate).
      */}
      <Image
        src="/foto/cascina-langa.png"
        alt="Cascina in pietra fra i vigneti, con il tetto in coppi e le colline sullo sfondo"
        width={1800}
        height={1200}
        sizes="(max-width: 1024px) 100vw, 896px"
        priority
        className="mt-8 h-auto w-full rounded-lg"
      />

      <CalcolatoreRata />
    </>
  );
}
