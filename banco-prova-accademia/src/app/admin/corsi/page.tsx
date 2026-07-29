import { Bottone } from "@/components/ui/Bottone";
import { Campo, CampoScelta, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { creaCorso } from "@/modules/corsi/azioni";
import { elencoCorsi, elencoInsegnanti } from "@/modules/corsi/query";

const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab"].map((g) => ({
  valore: g,
  testo: g,
}));

export default async function Corsi() {
  const [corsi, insegnanti] = await Promise.all([
    elencoCorsi(),
    elencoInsegnanti(),
  ]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Corsi</h1>
        <Tabella
          didascalia="Corsi attivi, con insegnante e giorno"
          intestazioni={["Corso", "Strumento", "Insegnante", "Giorno", "Posti"]}
        >
          {corsi.map((c) => (
            <Riga key={c.id}>
              <Cella>{c.name}</Cella>
              <Cella>{c.instrument}</Cella>
              <Cella>{c.staff?.full_name ?? "—"}</Cella>
              <Cella>{c.giorno}</Cella>
              <Cella>{c.seats}</Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Nuovo corso</h2>
        <Modulo azione={creaCorso}>
          <Campo nome="name" etichetta="Nome del corso" obbligatorio />
          <Campo nome="instrument" etichetta="Strumento" obbligatorio />
          <CampoScelta
            nome="teacher_id"
            etichetta="Insegnante"
            opzioni={insegnanti.map((i) => ({ valore: i.id, testo: i.full_name }))}
          />
          <CampoScelta nome="giorno" etichetta="Giorno" opzioni={GIORNI} />
          <Campo nome="seats" etichetta="Posti" tipo="number" valore={6} />
          <Bottone>Crea</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
