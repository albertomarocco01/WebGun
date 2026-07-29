import { Bottone } from "@/components/ui/Bottone";
import { CampoScelta, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { avanzaOrdine } from "@/modules/ordini/azioni";
import { TRANSIZIONI, elencoOrdini } from "@/modules/ordini/query";

const euro = (centesimi: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(centesimi / 100);

export default async function Ordini() {
  const ordini = await elencoOrdini();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Ordini</h1>
      <Tabella
        didascalia="Ordini ricevuti, con lo stato e le mosse ammesse"
        intestazioni={["Cliente", "Città", "Totale", "Stato", "Avanza"]}
      >
        {ordini.map((o) => {
          const ammesse = TRANSIZIONI[o.status] ?? [];

          return (
            <Riga key={o.id}>
              <Cella>{o.customers?.full_name ?? o.shipping_name}</Cella>
              <Cella>{o.shipping_city}</Cella>
              <Cella>{euro(o.total_cents)}</Cella>
              <Cella>{o.status}</Cella>
              <Cella>
                {ammesse.length === 0 ? (
                  "—"
                ) : (
                  // Si offrono SOLO le mosse legali: le altre le rifiuta il
                  // trigger del database, ma un pulsante che porta a un errore
                  // e' un difetto dell'interfaccia.
                  <Modulo azione={avanzaOrdine}>
                    <input type="hidden" name="id" value={o.id} />
                    <input
                      type="hidden"
                      name="status_attuale"
                      value={o.status}
                    />
                    <CampoScelta
                      nome="status"
                      etichetta="Nuovo stato"
                      opzioni={ammesse.map((s) => ({ valore: s, testo: s }))}
                    />
                    <Bottone>Avanza</Bottone>
                  </Modulo>
                )}
              </Cella>
            </Riga>
          );
        })}
      </Tabella>
    </section>
  );
}
