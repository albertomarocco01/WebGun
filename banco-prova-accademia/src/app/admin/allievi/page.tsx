import { Bottone } from "@/components/ui/Bottone";
import { Campo, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { iscriviAllievo } from "@/modules/allievi/azioni";
import { elencoAllievi } from "@/modules/allievi/query";

export default async function Allievi() {
  const allievi = await elencoAllievi();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Allievi</h1>
        <p className="mb-3 text-sm text-slate-600">
          L&apos;insegnante vede qui i soli allievi dei propri corsi: lo decide
          la policy, non questa pagina.
        </p>
        <Tabella
          didascalia="Allievi dell&apos;accademia"
          intestazioni={["Nome", "Nato il", "Telefono di riferimento"]}
        >
          {allievi.map((a) => (
            <Riga key={a.id}>
              <Cella>{a.full_name}</Cella>
              <Cella>{a.birth_date ?? "—"}</Cella>
              <Cella>{a.guardian_phone ?? "—"}</Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Nuovo allievo</h2>
        <Modulo azione={iscriviAllievo}>
          <Campo nome="full_name" etichetta="Nome e cognome" obbligatorio />
          <Campo nome="guardian_phone" etichetta="Telefono di riferimento" />
          <Bottone>Registra</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
