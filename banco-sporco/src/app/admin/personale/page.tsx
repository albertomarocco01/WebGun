import { Bottone } from "@/components/ui/Bottone";
import { Campo, CampoScelta, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { richiediRuolo } from "@/modules/admin/guardia";
import { aggiornaRecapiti, cambiaRuolo } from "@/modules/personale/azioni";
import { elencoPersonale } from "@/modules/personale/query";

const RUOLI = [
  { valore: "titolare", testo: "Titolare" },
  { valore: "magazziniere", testo: "Magazziniere" },
  { valore: "redattore", testo: "Redattore" },
];

/**
 * Il personale lo gestisce il titolare. Il ruolo NON e' un campo del modulo dei
 * recapiti: si cambia con la sua azione, che passa dalla funzione del database.
 * Un unico modulo che scrivesse anche `ruolo` prenderebbe *permission denied*
 * dal `grant` per colonna — e sarebbe auto-promozione se il grant ci fosse.
 */
export default async function Personale() {
  await richiediRuolo("titolare");
  const personale = await elencoPersonale();

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Personale</h1>

      <Tabella
        didascalia="Personale del negozio, con il ruolo assegnato"
        intestazioni={["Nome", "Telefono", "Ruolo", "Attivo"]}
      >
        {personale.map((p) => (
          <Riga key={p.id}>
            <Cella>{p.full_name}</Cella>
            <Cella>{p.phone ?? "—"}</Cella>
            <Cella>{p.ruolo}</Cella>
            <Cella>{p.is_active ? "sì" : "no"}</Cella>
          </Riga>
        ))}
      </Tabella>

      {personale.map((p) => (
        <article key={p.id} className="border-t border-slate-200 pt-4">
          <h2 className="text-lg font-semibold">{p.full_name}</h2>

          <Modulo azione={aggiornaRecapiti}>
            <input type="hidden" name="id" value={p.id} />
            <Campo
              nome="full_name"
              suffisso={p.id}
              etichetta="Nome e cognome"
              valore={p.full_name}
            />
            <Campo
              nome="phone"
              suffisso={p.id}
              etichetta="Telefono"
              valore={p.phone}
            />
            <Bottone>Salva i recapiti</Bottone>
          </Modulo>

          <div className="mt-4">
            <Modulo azione={cambiaRuolo}>
              <input type="hidden" name="id" value={p.id} />
              <CampoScelta
                nome="ruolo"
                suffisso={p.id}
                etichetta="Ruolo"
                valore={p.ruolo}
                opzioni={RUOLI}
              />
              <Bottone tono="secondario">Cambia ruolo</Bottone>
            </Modulo>
          </div>
        </article>
      ))}
    </section>
  );
}
