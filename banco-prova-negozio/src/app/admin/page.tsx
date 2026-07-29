import { richiediStaff } from "@/modules/admin/guardia";

export default async function Cruscotto() {
  const persona = await richiediStaff();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Gestionale</h1>
      <p className="mt-2 text-sm text-slate-700">
        Ciao {persona.full_name}. Da qui gestisci catalogo, ordini, clienti e
        contenuti del sito.
      </p>
    </section>
  );
}
