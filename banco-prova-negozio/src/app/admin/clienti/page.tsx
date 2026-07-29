import { Bottone } from "@/components/ui/Bottone";
import { Campo, Modulo } from "@/components/ui/Campo";
import { Cella, Riga, Tabella } from "@/components/ui/Tabella";
import { registraCliente } from "@/modules/clienti/azioni";
import { elencoClienti } from "@/modules/clienti/query";

export default async function Clienti() {
  const clienti = await elencoClienti();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Clienti</h1>
        <Tabella
          didascalia="Anagrafica clienti, con e senza account sul sito"
          intestazioni={["Nome", "Email", "Telefono", "Account"]}
        >
          {clienti.map((c) => (
            <Riga key={c.id}>
              <Cella>{c.full_name}</Cella>
              <Cella>{c.email ?? "—"}</Cella>
              <Cella>{c.phone ?? "—"}</Cella>
              <Cella>{c.auth_user_id ? "sì" : "no"}</Cella>
            </Riga>
          ))}
        </Tabella>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Nuovo cliente</h2>
        <Modulo azione={registraCliente}>
          <Campo nome="full_name" etichetta="Nome e cognome" obbligatorio />
          <Campo nome="email" etichetta="Email" tipo="email" />
          <Campo
            nome="phone"
            etichetta="Telefono"
            descrizione="Per chi ordina al telefono e non ha un account."
          />
          <Bottone>Registra</Bottone>
        </Modulo>
      </div>
    </section>
  );
}
