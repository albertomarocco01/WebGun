import { Bottone } from "@/components/ui/Bottone";
import {
  Campo,
  CampoInterruttore,
  CampoTesto,
  Modulo,
} from "@/components/ui/Campo";
import { richiediRuolo } from "@/modules/admin/guardia";
import { aggiornaContenuto } from "@/modules/contenuti/azioni";
import { elencoContenuti } from "@/modules/contenuti/query";

export default async function Contenuti() {
  await richiediRuolo("segreteria", "direttore");
  const contenuti = await elencoContenuti();

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Contenuti del sito</h1>

      {contenuti.map((c) => (
        <article key={c.id} className="border-t border-slate-200 pt-4">
          <h2 className="text-lg font-semibold">{c.slot}</h2>
          <Modulo azione={aggiornaContenuto}>
            <input type="hidden" name="id" value={c.id} />
            <Campo nome="title" suffisso={c.id} etichetta="Titolo" valore={c.title} />
            <CampoTesto nome="corpo" suffisso={c.id} etichetta="Testo" valore={c.corpo} />
            <CampoInterruttore
              nome="is_published"
              suffisso={c.id}
              etichetta="Pubblicato"
              acceso={c.is_published}
            />
            <Bottone>Salva</Bottone>
          </Modulo>
        </article>
      ))}
    </section>
  );
}
