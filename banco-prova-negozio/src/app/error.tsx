"use client";

import Link from "next/link";

/**
 * Il confine d'errore dell'applicazione. Prima non esisteva, e le dodici azioni
 * server facevano `throw` senza avere dove atterrare: in sviluppo compariva
 * l'overlay di Next, in produzione una pagina bianca di sistema. Conseguenza
 * misurata da Flow Sentinel il 2026-07-30: **nessuna spec poteva asserire un
 * testo d'errore**, perche' a schermo non ce n'era nessuno da asserire.
 *
 * Dev'essere un componente client: React lo monta nel browser quando il
 * rendering di un figlio lancia.
 *
 * `error.message` NON si mostra. In produzione Next lo sostituisce comunque con
 * un `digest`, e in sviluppo sarebbe il messaggio grezzo di Postgres — cioe' i
 * nomi delle tabelle e delle colonne regalati a chi ha appena forzato una POST.
 * A schermo va la frase stabile; il `digest` serve a ritrovare la riga nei log
 * del server, dove il messaggio vero resta per intero.
 */
export default function ErroreApplicazione({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Qualcosa non ha funzionato</h1>

      <p role="alert" className="mt-3 text-sm text-red-700">
        L&apos;operazione non e&apos; stata completata. Riprova; se succede di
        nuovo, segnala il codice qui sotto.
      </p>

      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-600">
          codice: {error.digest}
        </p>
      ) : null}

      <div className="mt-6 flex gap-4 text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-slate-400 px-3 py-1 hover:bg-slate-100"
        >
          Riprova
        </button>
        <Link href="/admin" className="self-center underline">
          Torna al gestionale
        </Link>
      </div>
    </main>
  );
}
