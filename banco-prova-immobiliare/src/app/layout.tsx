import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/**
 * NOTA DI BANCO — questo layout NON dichiara un `title`.
 *
 * Non e' una dimenticanza: e' la condizione che serve a mostrare cosa succede a
 * una pagina che si scorda il proprio titolo. Con un `title.default` qui, ogni
 * rotta ne erediterebbe uno e il caso non si potrebbe piu' osservare.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3200"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">
        <header className="border-b border-stone-300">
          <nav className="mx-auto flex max-w-5xl gap-6 px-4 py-4 text-sm">
            <Link href="/" className="font-semibold">Case di Langa</Link>
            <Link href="/immobili">Immobili</Link>
            <Link href="/agenzia">Agenzia</Link>
            <Link href="/contatti">Contatti</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-stone-300 px-4 py-6 text-center text-sm">
          Case di Langa — agenzia immobiliare, Alba (CN)
        </footer>
      </body>
    </html>
  );
}
