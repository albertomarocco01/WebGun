import { richiediStaff } from "@/modules/admin/guardia";

/** I motivi che le guardie sanno scrivere nell'URL, e come si dicono a chi legge. */
const MOTIVI: Record<string, string> = {
  "ruolo-insufficiente":
    "Quella sezione non e' aperta al tuo ruolo: chiedi al titolare.",
};

export default async function Cruscotto({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const persona = await richiediStaff();

  // `richiediRuolo` rimanda qui con `?motivo=ruolo-insufficiente`. Finche'
  // nessuno leggeva questo parametro il rifiuto era MUTO: la porta si chiudeva
  // e la pagina non diceva perche'. Un rifiuto senza spiegazione si legge come
  // un guasto, e chi lavora ricarica invece di chiedere il permesso.
  const { motivo } = await searchParams;
  const spiegazione = motivo ? MOTIVI[motivo] : undefined;

  return (
    <section>
      <h1 className="text-2xl font-semibold">Gestionale</h1>

      {spiegazione ? (
        <p role="status" className="mt-3 text-sm text-red-700">
          {spiegazione}
        </p>
      ) : null}

      <p className="mt-2 text-sm text-slate-700">
        Ciao {persona.full_name}. Da qui gestisci catalogo, ordini, clienti e
        contenuti del sito.
      </p>
    </section>
  );
}
