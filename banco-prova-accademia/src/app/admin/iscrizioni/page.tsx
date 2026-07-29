import { Bottone } from "@/components/ui/Bottone";
import { CampoScelta, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { cambiaStatoIscrizione } from "@/modules/iscrizioni/azioni";
import { TRANSIZIONI, elencoIscrizioni } from "@/modules/iscrizioni/query";

const euro = (centesimi: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    centesimi / 100,
  );

export default async function Iscrizioni() {
  const iscrizioni = await elencoIscrizioni();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Iscrizioni</h1>
      <Tabella
        didascalia="Iscrizioni ai corsi, con lo stato e le mosse ammesse"
        intestazioni={["Allievo", "Corso", "Quota", "Stato", "Avanza"]}
      >
        {iscrizioni.map((i) => {
          const ammesse = TRANSIZIONI[i.status] ?? [];

          return (
            <Riga key={i.id}>
              <Cella>{i.students?.full_name ?? "—"}</Cella>
              <Cella>{i.courses?.name ?? "—"}</Cella>
              <Cella>{euro(i.fee_cents)}</Cella>
              <Cella>{i.status}</Cella>
              <Cella>
                {ammesse.length === 0 ? (
                  "—"
                ) : (
                  <Modulo azione={cambiaStatoIscrizione}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="status_attuale" value={i.status} />
                    <CampoScelta
                      nome="status"
                      suffisso={i.id}
                      etichetta="Nuovo stato"
                      opzioni={ammesse.map((s) => ({ valore: s, testo: s }))}
                    />
                    <Bottone>Applica</Bottone>
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
