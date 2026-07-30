import type { Metadata } from "next";

import { Bottone } from "@/components/ui/Bottone";
import { Campo, Modulo } from "@/components/ui/Campo";
import { accedi } from "@/modules/admin/accesso";

/**
 * Titolo e canonical propri: senza, questa pagina serviva gli stessi identici
 * tag della home, e il canonical (una volta introdotto nel layout) avrebbe
 * dichiarato che `/accedi` E' la home — cioe' avrebbe chiesto di non
 * indicizzarla e di attribuire tutto a un'altra pagina.
 *
 * Nessun `noindex`: la porta del gestionale non ha niente da nascondere e un
 * `noindex` qui sarebbe una scelta, non un obbligo. Ce l'ha invece `/admin/*`,
 * che sta dietro il suo layout.
 */
export const metadata: Metadata = {
  title: "Accesso al gestionale",
  description: "Area riservata al personale di Bottega Nord.",
  alternates: { canonical: "/accedi" },
};

/**
 * La porta d'ingresso del gestionale. Rotta pubblica per forza: e' l'unica.
 * Non compare in `gestionale.config.json` fra le rotte protette, ed e' l'unica
 * eccezione dichiarata.
 */
export default async function Accedi({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold">Accesso al gestionale</h1>

      {motivo === "non-autorizzato" ? (
        <p role="status" className="mt-3 text-sm text-red-700">
          Questo account non appartiene al personale del negozio.
        </p>
      ) : null}

      <div className="mt-6">
        <Modulo azione={accedi}>
          <Campo nome="email" etichetta="Email" tipo="email" obbligatorio />
          <Campo
            nome="password"
            etichetta="Password"
            tipo="password"
            obbligatorio
          />
          <Bottone>Entra</Bottone>
        </Modulo>
      </div>
    </main>
  );
}
