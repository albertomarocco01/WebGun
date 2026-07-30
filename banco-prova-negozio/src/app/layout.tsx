import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * `metadataBase` serve a `alternates.canonical`: senza, Next non sa risolvere un
 * percorso relativo in un URL assoluto e il tag canonical **non esce** nell'HTML
 * servito. In sviluppo vale l'indirizzo locale; in produzione lo passa
 * l'ambiente, ed e' l'unico valore che DEVE essere giusto — un canonical che
 * punta al dominio sbagliato e' peggio di un canonical assente, perche' regala a
 * un altro indirizzo l'autorita' di questo.
 */
const ORIGINE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(ORIGINE),
  // Il titolo di ogni pagina passa da qui: `%s` e' il `title` della pagina, e
  // `default` vale per chi non ne dichiara uno. Prima ogni rotta serviva lo
  // stesso identico «Bottega Nord», gestionale compreso: due pagine con lo
  // stesso titolo sono, per chi indicizza, una pagina sola raddoppiata.
  title: {
    default: "Bottega Nord — maglieria di Biella",
    template: "%s — Bottega Nord",
  },
  description: "Maglieria di lana lavorata a Biella, tinta in capo.",
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-white text-slate-900">{children}</body>
    </html>
  );
}
