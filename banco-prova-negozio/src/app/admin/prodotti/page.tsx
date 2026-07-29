import Link from "next/link";

import { Bottone } from "@/components/ui/Bottone";
import {
  Campo,
  CampoInterruttore,
  CampoScelta,
  CampoTesto,
  Modulo,
} from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { creaProdotto } from "@/modules/catalogo/azioni";
import { elencoCategorie, elencoProdotti } from "@/modules/catalogo/query";

export default async function Prodotti() {
  const [prodotti, categorie] = await Promise.all([
    elencoProdotti(),
    elencoCategorie(),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Prodotti</h1>
        <Tabella
          didascalia="Prodotti a catalogo, con stato di pubblicazione"
          intestazioni={["Nome", "Categoria", "Stato", ""]}
        >
          {prodotti.map((p) => (
            <Riga key={p.id}>
              <Cella>{p.name}</Cella>
              <Cella>{p.categories?.name ?? "—"}</Cella>
              <Cella>{p.is_published ? "pubblicato" : "bozza"}</Cella>
              <Cella>
                <Link
                  href={`/admin/prodotti/${p.id}`}
                  className="underline"
                >
                  Apri
                </Link>
              </Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Nuovo prodotto</h2>
        <Modulo azione={creaProdotto}>
          <Campo nome="name" etichetta="Nome" obbligatorio />
          <Campo
            nome="slug"
            etichetta="Slug"
            obbligatorio
            descrizione="Finisce nell'indirizzo della pagina: solo minuscole e trattini."
          />
          <CampoScelta
            nome="category_id"
            etichetta="Categoria"
            opzioni={categorie.map((c) => ({ valore: c.id, testo: c.name }))}
          />
          <CampoTesto nome="description" etichetta="Descrizione" />
          <CampoInterruttore
            nome="is_published"
            etichetta="Pubblicato"
            acceso={false}
          />
          <Bottone>Crea</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
