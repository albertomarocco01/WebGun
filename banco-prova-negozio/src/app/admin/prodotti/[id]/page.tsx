import { notFound } from "next/navigation";

import { Bottone } from "@/components/ui/Bottone";
import {
  Campo,
  CampoInterruttore,
  CampoTesto,
  Modulo,
} from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import {
  aggiornaProdotto,
  aggiornaVariante,
  eliminaProdotto,
} from "@/modules/catalogo/azioni";
import { prodotto, variantiDi } from "@/modules/catalogo/query";

const euro = (centesimi: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(centesimi / 100);

export default async function SchedaProdotto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scheda = await prodotto(id);

  if (!scheda) notFound();

  const varianti = await variantiDi(id);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{scheda.name}</h1>
        <Modulo azione={aggiornaProdotto}>
          <input type="hidden" name="id" value={scheda.id} />
          <Campo nome="name" etichetta="Nome" valore={scheda.name} obbligatorio />
          <Campo nome="slug" etichetta="Slug" valore={scheda.slug} obbligatorio />
          <CampoTesto
            nome="description"
            etichetta="Descrizione"
            valore={scheda.description}
          />
          <CampoInterruttore
            nome="is_published"
            etichetta="Pubblicato"
            acceso={scheda.is_published}
          />
          <Bottone>Salva</Bottone>
        </Modulo>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Varianti</h2>
        <Tabella
          didascalia="Varianti del prodotto: taglia, prezzo e giacenza"
          intestazioni={["SKU", "Taglia", "Prezzo", "Giacenza", ""]}
        >
          {varianti.map((v) => (
            <Riga key={v.id}>
              <Cella>{v.sku}</Cella>
              <Cella>{v.size}</Cella>
              <Cella>{euro(v.price_cents)}</Cella>
              <Cella>{v.quantity}</Cella>
              <Cella>
                {/* Solo `id`. `sku` e `size` non si modificano da qui, quindi
                    non viaggiano: un campo nascosto che l'azione riscrive e' un
                    campo modificabile con un aspetto rassicurante. */}
                <Modulo azione={aggiornaVariante}>
                  <input type="hidden" name="id" value={v.id} />
                  <Campo
                    nome="prezzo_euro"
                    suffisso={v.id}
                    etichetta="Prezzo in euro"
                    tipo="number"
                    valore={v.price_cents / 100}
                  />
                  <Campo
                    nome="quantity"
                    suffisso={v.id}
                    etichetta="Giacenza"
                    tipo="number"
                    valore={v.quantity}
                  />
                  <Bottone>Aggiorna</Bottone>
                </Modulo>
              </Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Elimina</h2>
        <Modulo azione={eliminaProdotto}>
          <input type="hidden" name="id" value={scheda.id} />
          <Bottone tono="secondario">Elimina il prodotto</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
