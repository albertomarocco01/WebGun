import { Bottone } from "@/components/ui/Bottone";
import { Campo, CampoInterruttore, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { creaCategoria } from "@/modules/catalogo/azioni";
import { elencoCategorie } from "@/modules/catalogo/query";

export default async function Categorie() {
  const categorie = await elencoCategorie();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Categorie</h1>
        <Tabella
          didascalia="Categorie del catalogo"
          intestazioni={["Nome", "Slug", "Visibile"]}
        >
          {categorie.map((c) => (
            <Riga key={c.id}>
              <Cella>{c.name}</Cella>
              <Cella>{c.slug}</Cella>
              <Cella>{c.is_visible ? "sì" : "no"}</Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Nuova categoria</h2>
        <Modulo azione={creaCategoria}>
          <Campo nome="name" etichetta="Nome" obbligatorio />
          <Campo nome="slug" etichetta="Slug" obbligatorio />
          <CampoInterruttore
            nome="is_visible"
            etichetta="Visibile sul sito"
            acceso
          />
          <Bottone>Crea</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
