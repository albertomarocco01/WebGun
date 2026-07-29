import { Bottone } from "@/components/ui/Bottone";
import { Campo, Modulo } from "@/components/ui/Campo";
import { accedi } from "@/modules/admin/accesso";

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
