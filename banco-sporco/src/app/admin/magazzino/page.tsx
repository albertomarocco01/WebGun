// CONTROLLO NEGATIVO — pagina senza guardia propria, ma sotto il layout che ce
// l'ha: NON deve produrre findings. E' il caso che distingue una regola utile
// da una che segnala tutto.
import { elencoProdotti } from "@/modules/catalogo/query";

export default async function Magazzino() {
  const prodotti = await elencoProdotti();
  return <p>{prodotti.length} prodotti</p>;
}
