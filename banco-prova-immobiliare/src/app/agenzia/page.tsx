import type { Metadata } from "next";

/**
 * T4 — questo `metadata` non aveva `title`.
 *
 * Il layout non ne dichiara uno di riserva, quindi l'HTML servito usciva
 * **senza `<title>` nella testa**. Nel corpo pero' c'e' l'icona telefono col
 * suo `<title>`, che e' esattamente cio' che un revisore di accessibilita'
 * chiede di mettere — e il gate leggeva quello: `title = "Telefono"`, passo
 * `seo-meta` verde su una pagina senza titolo. Lighthouse invece lo vedeva
 * (`document-title`, categoria SEO a 91), e il difetto usciva solo perche' il
 * contratto pretendeva `seo 100`. Con una soglia SEO a 90 nessuno se ne
 * sarebbe accorto.
 */
export const metadata: Metadata = {
  title: "L'agenzia — Case di Langa",
  description: "Chi siamo: due agenti, ventidue anni di Langa, nessun intermediario.",
  alternates: { canonical: "/agenzia" },
};

export default function Agenzia() {
  return (
    <>
      <h1 className="text-3xl font-semibold">L&apos;agenzia</h1>
      <p className="mt-4 max-w-2xl">
        Siamo in due e lavoriamo solo fra Alba e la bassa Langa. Ogni casa la
        vediamo prima di pubblicarla, e se non la comprerebbe nessuno di noi lo
        scriviamo nell&apos;annuncio.
      </p>
      <p className="mt-6 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" role="img" aria-labelledby="icona-telefono" fill="currentColor">
          <title id="icona-telefono">Telefono</title>
          <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11 11 0 0 0 3.5.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.5 1 1 0 0 1-.3 1z" />
        </svg>
        0173 44 55 66
      </p>
    </>
  );
}
