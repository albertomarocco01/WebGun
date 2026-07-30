# Handoff — Speed Demon

> Template. Ogni `{{segnaposto}}` va sostituito: un file con `{{…}}` residui non è un
> handoff, e il passo `contratto-uscita` del gate lo boccia.
> Destinazione: `docs/handoff/<n>-speed-demon.md` del progetto generato, dove `<n>` è il
> numero successivo all'ultimo handoff già presente in `docs/handoff/`.
> Handoff da leggere prima di compilare questo: quello di **Flow Sentinel** (dice quali
> flussi non possono rompersi) e `docs/PROGETTO.md` (dice quali deroghe di stack esistono).

Questo handoff è l'unico posto in cui resta scritto **perché il sito è veloce così e non
di più**. Le tabelle 3, 4, 5 e 6 non sono burocrazia: sono le quattro domande che qualcuno
rifarà — «di quanto è migliorato», «cosa ci è costato», «perché non avete fatto X»,
«cosa si era rotto» — e l'unica alternativa a scriverle è rimisurare tutto da capo.

## 1. Cosa ho fatto

- **Contratto**: `docs/performance.md` — {{N}} pagine dichiarate con le loro soglie,
  `Confermato da: {{CHI}}` il {{DATA}}.
- **Baseline** e **misura finale** delle stesse pagine, stesso metodo, stessa macchina.
- **{{N}} ottimizzazioni applicate**, una alla volta, ognuna con rimisura e rete E2E
  rilanciata subito dopo (tabella §4).
- **{{N}} ottimizzazioni proposte e non applicate** (tabella §5).
- File toccati: {{ELENCO_PERCORSI}}.
- `docs/DEBITO-TECNICO.md` aggiornato con ciò che resta lento e perché.

I comandi con cui si rifà tutto, nell'ordine in cui vanno lanciati:

```bash
# 1. la misura si prende SOLO su una build di produzione, su una porta dedicata
npm run build
npx next start -p {{PORTA}}          # mai `next dev`: senza minificazione, senza cache e con
                                     # ricompilazione a ogni richiesta si misura il compilatore,
                                     # non il sito. Il gate lo rifiuta.

# 2. N giri per pagina (default 3), profilo dichiarato, output conservato.
#    Profilo desktop -> `--preset=desktop`. Profilo mobile -> NESSUN preset: il mobile e' la
#    configurazione di default di Lighthouse, e `--preset` accetta soltanto `perf`,
#    `experimental` o `desktop`. `--preset=mobile` non e' un profilo mobile: e' un valore
#    che Lighthouse rifiuta.
npx lighthouse http://127.0.0.1:{{PORTA}}/ \
  --preset=desktop --only-categories=performance,accessibility,seo \
  --output=json --output-path={{CARTELLA_MISURE}}/home-dopo-1.json \
  --chrome-flags="--headless=new" --quiet

# 3. la rete, dopo OGNI ottimizzazione e non solo alla fine
E2E_BASE_URL=http://127.0.0.1:{{PORTA}} npx playwright test

# 4. il gate di questo agente, sette passi
node {{PERCORSO_WEBGUN}}/agenti/speed-demon/scripts/verify.mjs --url http://127.0.0.1:{{PORTA}}
```

## 2. Metodo e condizioni della misura

Senza questa sezione la tabella §3 è un elenco di numeri senza unità di misura: due
esecuzioni fatte con profili diversi producono scarti che somigliano a ottimizzazioni.

| Voce | Valore |
|---|---|
| URL misurato | `{{URL}}` — build di produzione, non `next dev` |
| Commit della baseline / della misura finale | `{{SHA_PRIMA}}` / `{{SHA_DOPO}}` |
| Comando di build | `{{COMANDO}}` |
| Profilo Lighthouse | {{desktop / mobile}}, throttling {{simulato / applicato / nessuno}} |
| Giri per pagina | {{N}} (default 3), statistica riportata: **mediana** |
| Dispersione dichiarata | {{come è calcolata: min–max dei giri, o scarto dalla mediana}} |
| Versione Lighthouse / Chrome | {{X.Y.Z}} / {{X}} |
| Macchina e stato | {{CPU, RAM, se c'era altro in esecuzione}} |
| Dati nel database | seed {{quante righe nelle tabelle che alimentano le pagine misurate}} |

<!--
La versione dello strumento e la macchina stanno qui per una ragione precisa: fra sei mesi
qualcuno rimisurera' e trovera' numeri diversi. Senza queste righe non potra' distinguere
"il sito e' peggiorato" da "Lighthouse ha cambiato i pesi delle categorie" o da "quella
misura era stata presa mentre giravano i test di un altro progetto". Sono i due modi in
cui una baseline diventa inutilizzabile senza che nessuno se ne accorga.
La riga sul seed c'e' perche' una pagina che vola con dieci prodotti puo' crollare con la
lista vera: chi legge deve sapere su quanti dati sono stati presi questi numeri.
La statistica dichiarata e' la mediana e non la media perche' basta un giro sporco — un
antivirus che parte, un indicizzatore che si sveglia — a trascinare la media e a far
sembrare guadagno (o perdita) qualcosa che e' successo fuori dal browser: la mediana di
tre giri quel giro lo scarta, la media se lo porta dentro.
-->

## 3. Delta per metrica, pagina per pagina

Una tabella per ogni pagina **dichiarata nel contratto**. Le pagine non dichiarate non
stanno qui: se ne è stata misurata una in più, va prima aggiunta a `docs/performance.md` e
fatta riconfermare, altrimenti questo handoff certifica una scelta che nessuno ha preso.

### `{{ROTTA}}` — soglia dichiarata: {{SOGLIA}}

| Metrica | Prima (mediana di {{N}}) | Dopo (mediana di {{N}}) | Delta | Dispersione dopo | Esito vs soglia |
|---|---|---|---|---|---|
| Punteggio performance | {{}} | {{}} | {{}} | {{}} | {{PASS / sotto soglia + rimando alla deroga}} |
| LCP | {{}} ms | {{}} ms | {{}} ms | {{}} | {{}} |
| CLS | {{}} | {{}} | {{}} | {{}} | {{}} |
| TBT | {{}} ms | {{}} ms | {{}} ms | {{}} | {{}} |
| JS trasferito | {{}} kB | {{}} kB | {{}} kB | — | {{}} |
| Punteggio accessibilità | {{}} | {{}} | {{}} | {{}} | **non deve scendere** |

**Delta più piccoli della dispersione si scrivono `nel rumore`, non come guadagni.** È la
terza legge in forma di tabella: due giri identici sulla stessa build danno punteggi
diversi, quindi un delta che sta dentro l'oscillazione dei giri non dice niente sul codice.
Scriverlo come miglioramento è il modo in cui un'ottimizzazione inutile — e con un costo
vero — sopravvive a tutte le revisioni successive.

<!--
Perche' la riga dell'accessibilita' e' in una tabella di performance: e' l'unico posto in
cui si vede il punteggio rubato. Cancellare testo per alleggerire il DOM, togliere un
`alt`, spegnere un focus visibile: sono interventi fatti in nome della velocita' e pagati
in accessibilita' — che nella costituzione di Web Gun sta PRIMA. Quanto facciano guadagnare
in performance non e' scontato (spesso niente che esca dal rumore dei giri); quanto fanno
perdere si vede subito qui. Se questa riga scende, l'ottimizzazione che l'ha fatta scendere
va tolta, non giustificata.
Nota su INP: Lighthouse in laboratorio non lo produce, perche' serve un'interazione vera.
Il surrogato di laboratorio e' TBT, ed e' quello che sta in tabella. Chi vuole INP guarda
i dati di campo, che questo agente non vede (§11).
-->

## 4. Ottimizzazioni applicate — la colonna COSTO è obbligatoria

| # | Ottimizzazione | Cosa tocca | Metrica bersaglio | Guadagno **misurato** | **COSTO** | Confermata da | Rete E2E dopo |
|---|---|---|---|---|---|---|---|
| {{1}} | {{}} | {{file/rotta}} | {{}} | {{delta, non "atteso"}} | {{cosa peggiora o cambia}} | {{CHI}} | {{verde / §6}} |

<!--
Una cella COSTO vuota, o con scritto «nessuno», invalida la riga: un'ottimizzazione senza
costo non e' gratis, e' incompresa. I costi veri hanno tutti la stessa forma — qualcosa di
non misurato paga per qualcosa di misurato:
  - lazy loading sotto la piega  -> un lampo bianco a chi scorre veloce;
  - `priority` su un'immagine    -> banda tolta a tutto il resto: la precedenza e' a somma zero;
  - font di sistema al posto del font del marchio -> identita' visiva;
  - `ssr: false`                 -> contenuto tolto ai motori di ricerca e ai lettori senza JS;
  - cache piu' lunga             -> contenuto vecchio servito piu' a lungo dopo un aggiornamento.
La colonna «Confermata da» serve perche' un'ottimizzazione che cambia cosa si VEDE non e'
una decisione di questo agente: e' una decisione di chi ha confermato lo Specchio.
-->

Esempio di riga compilata, con il codice che la realizza:

```tsx
// src/app/page.tsx — immagine dell'hero, elemento LCP della home
import Image from "next/image";

export default function Home() {
  return (
    <Image
      src="/hero.avif"
      alt="Il bancone della bottega al mattino"
      width={1440}
      height={810}
      sizes="100vw"
      priority        // esce dal lazy loading e sale di precedenza nel fetch
    />
  );
}
```

Costo da scrivere in tabella: **la precedenza è a somma zero**. Questa immagine parte prima,
tutte le altre risorse della stessa pagina partono dopo. Se `priority` finisce su tre
immagini, non ne ha priorità nessuna e il guadagno sparisce senza che il codice sembri
cambiato — motivo per cui la riga deve dire su **quale** elemento è stato messo e perché
quello è l'LCP di **quella** pagina, misurato, non supposto.

## 5. Ottimizzazioni proposte e rifiutate

| Proposta | Guadagno atteso (e su cosa si basa la stima) | **Chi l'ha rifiutata** | Perché | Cosa la farebbe rientrare |
|---|---|---|---|---|
| {{}} | {{}} | {{umano / orchestratore / questo agente}} | {{}} | {{condizione verificabile}} |

Questa tabella esiste per un motivo solo, ed è il futuro: **fra sei mesi qualcuno rifarà la
stessa proposta.** Se il rifiuto non è scritto, la seconda volta la proposta passa — e passa
perché chi la valuta non conosce il costo che era già stato considerato e respinto. Il caso
peggiore non è ripetere la discussione: è vincerla senza sapere cosa si sta comprando.

Due colonne meritano attenzione. **Chi ha rifiutato** cambia il peso del rifiuto: un «no»
dell'orchestratore in modalità pipeline è una regola applicata, un «no» del cliente è un
vincolo di prodotto, un «no» di questo agente è un giudizio tecnico e vale quanto la sua
motivazione. **Cosa la farebbe rientrare** trasforma un rifiuto in una condizione: «rientra
se il font del marchio viene sostituito», «rientra se quella pagina esce dall'area
riservata», «rientra se il carrello smette di dipendere da quel componente». Un rifiuto
senza condizione di rientro è definitivo per caso, non per decisione.

## 6. Regressioni trovate e rientrate

| Spec diventata rossa | Ottimizzazione che l'ha rotta | Cosa mostrava il rosso | Cosa si è fatto | Stato finale |
|---|---|---|---|---|
| `{{e2e/xxx.spec.ts}}` — `@flusso:{{id}}` | riga {{n}} della §4 | {{messaggio o asserzione caduta}} | {{rollback / correzione dell'ottimizzazione / spec aggiornata + CHI l'ha autorizzato}} | {{verde / ottimizzazione ritirata}} |

**Nessuna regressione** è una riga legittima solo se la batteria è girata **dopo ciascuna**
ottimizzazione. Se è girata una volta sola alla fine, va scritto qui: un giro solo su
cinque modifiche non sa quale ha rotto e quale ha riparato, e il verde finale può nascondere
una rottura compensata da un'altra.

**La spec non si allenta mai per far passare un'ottimizzazione.** Se la cella «cosa si è
fatto» dice «spec aggiornata», deve dire anche chi ha confermato che il comportamento nuovo
è quello voluto: se il comportamento è cambiato, l'ottimizzazione ha modificato **cosa** fa
il sito, e questo agente cambia solo **come** lo fa.

Le tre ottimizzazioni che producono la maggior parte delle regressioni, e cosa rompono:

```tsx
// src/components/mappa-negozio.tsx
"use client";                    // obbligatorio: in App Router `ssr: false` non e'
                                 // ammesso dentro un Server Component
import dynamic from "next/dynamic";

const Mappa = dynamic(() => import("./mappa"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded bg-neutral-200" />,
});
```

`ssr: false` toglie il contenuto dall'HTML servito: rompe ogni spec ostile che asserisce
sul **corpo servito** (`risposta.text()`), rompe i metatag se il componente li generava, e
toglie quel contenuto ai motori di ricerca — che è un costo, non un effetto collaterale.
Il **lazy loading sotto la piega** rompe le spec che si aspettano un elemento visibile
subito, e il rosso arriva come timeout su un locator, cioè con la faccia di un flaky. La
**rimozione di JavaScript «non usato»** rompe ciò che veniva usato da un percorso che
nessuno percorreva a mano: è la classe che il gate non vede affatto e che solo la batteria
può mostrare.

## 7. Metatag e indicizzazione

| Rotta | `title` | `description` | `canonical` | Indicizzabile | Dove è generato |
|---|---|---|---|---|---|
| `{{/}}` | {{}} | {{}} | {{}} | {{sì / no + perché}} | {{`export const metadata` / `generateMetadata` / layout}} |

Tutte le celle si compilano leggendo **l'HTML servito**, non il sorgente. Il sorgente mente
in due modi: un `export const metadata` scritto in un file `"use client"` non diventa mai un
tag — l'App Router non ammette quell'export e lo respinge con un errore esplicito, quindi un
metadato che nel sorgente si legge benissimo non descrive nessuna pagina; e un metatag
generato da un componente reso solo nel browser non esiste per chi legge la risposta del
server.

```bash
# quello che il server consegna davvero, che e' l'unica cosa che conta
curl -s http://127.0.0.1:{{PORTA}}/prodotti/{{slug}} \
  | grep -Eio '<title>[^<]*</title>|<link[^>]+rel="canonical"[^>]*>|<meta[^>]+name="robots"[^>]*>'
```

```ts
// src/app/prodotti/[slug]/page.tsx — in Next 15 `params` e' una Promise
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const prodotto = await leggiProdotto(slug);
  return {
    title: prodotto.nome,
    description: prodotto.descrizione_breve,
    alternates: { canonical: `/prodotti/${slug}` },
  };
}
```

## 8. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| {{pagine dichiarate nel contratto}} | {{}} | {{chi le ha scelte, su quale criterio}} |
| {{profilo di misura}} | {{}} | {{}} |
| {{soglia derogata su una pagina}} | {{}} | {{la deroga è scritta nel contratto PRIMA della misura, non qui dopo}} |

<!--
Una soglia non raggiunta si giustifica nel contratto, e la giustificazione va scritta prima
di misurare. Scritta dopo e' un'altra cosa: e' la soglia riscritta attorno al risultato, e
da quel momento il contratto non puo' piu' bocciare niente.
-->

## 9. Cosa si aspetta chi viene dopo

- **Cyber Shield** — le ottimizzazioni di questo giro hanno spostato **superficie
  d'attacco**, non solo millisecondi, e questi sono i punti da guardare per primi:
  - **origini nuove** entrate nel progetto (`images.remotePatterns`, `preconnect`,
    `dns-prefetch`, un CDN di font): ogni origine aggiunta è qualcuno di cui il sito adesso
    si fida, e nessuna misura di velocità lo dice. Elenco: {{ELENCO_O_NESSUNA}};
  - **cache**: `{{Cache-Control / revalidate / unstable_cache}}` toccati. Il difetto da
    cercare è una risposta che varia per utente servita da una cache la cui chiave non
    contiene l'utente — `unstable_cache` che si porta dentro un dato di sessione, o un
    `Cache-Control: public` messo a mano su una rotta autenticata. È una fuga di dati
    personali con la faccia di un miglioramento di TTFB;
  - **logica passata al client** con `ssr: false` o con un componente reso solo nel browser:
    se lì dentro è finito un controllo di ruolo, adesso è un controllo che l'utente può
    disattivare. Righe interessate: {{ELENCO_O_NESSUNA}};
  - header e `next.config.ts` modificati: {{ELENCO_O_NESSUNO}}.
- **Launchpad** — i numeri della §3 sono presi in locale su `next start` e **non valgono per
  la produzione**:
  - la baseline di questo handoff serve come **termine di paragone dopo il deploy**: se la
    produzione è molto peggio a parità di commit, la causa è nell'infrastruttura (runtime,
    regione, cache del CDN, database remoto) e non nel codice — è un'informazione che si ha
    solo perché esiste una misura locale;
  - gli header di cache dipendono da chi serve il sito: quelli verificati qui sono quelli
    di `next start`, non quelli della piattaforma di destinazione;
  - le variabili d'ambiente usate al momento della build entrano nel bundle: la build di
    produzione va rifatta con le sue, non promossa questa;
  - **non si pubblica su gate rosso**, né su quello di Flow Sentinel né su questo.

## 10. Problemi noti e residui del gate

**Gate: {{VERDE|ROSSO}}** ({{N}} falliti, {{N}} verifiche mancanti su 7 passi) — rilanciato
il {{DATA}} con `{{COMANDO}}`.

> Questa riga **la verifica il gate stesso**, ultimo passo (`contratto-uscita`): se dichiara
> un verdetto diverso da quello dell'esecuzione in corso, il passo fallisce. Un handoff che
> dice «tutto verde» mentre il gate chiude rosso è il modo in cui un difetto arriva a valle
> con un timbro sopra. Dichiarare ROSSO su un gate rosso **passa**: dichiarare non è fallire.
> La forma è fissa: una riga che comincia con `Gate:` seguito da `VERDE` o `ROSSO`.

| Passo | Stato | Cosa resta | Rientro previsto |
|---|---|---|---|
| `contratto-performance` | {{pass/fail/skipped}} | {{}} | {{}} |
| `rete-verde` | {{}} | {{}} | {{}} |
| `build-produzione` | {{}} | {{}} | {{}} |
| `misura` | {{}} | {{}} | {{}} |
| `budget` | {{}} | {{}} | {{}} |
| `seo-meta` | {{}} | {{}} | {{}} |
| `contratto-uscita` | {{}} | {{}} | {{}} |

Verifiche mancanti (strumenti non eseguiti): {{ELENCO_O_NESSUNA}}.

<!--
Una verifica mancante non e' una verifica superata: se qui c'e' una riga, il gate e' rosso
e la riga `Gate:` qui sopra dice ROSSO. Qui conta doppio: senza Lighthouse questo agente
non ha nessun numero da consegnare, e un handoff senza numeri che dichiarasse VERDE
starebbe certificando un lavoro che non e' stato misurato.
-->

Cosa resta lento, e perché — le stesse righe stanno in `docs/DEBITO-TECNICO.md`:

| Pagina / risorsa | Quanto manca alla soglia | Perché non è stato risolto | A chi tocca |
|---|---|---|---|
| {{}} | {{}} | {{}} | {{}} |

Residuo di `code-maniac scan`: {{PULITO / ELENCO}}.

## 11. Cosa questi numeri NON dimostrano

- **Non dimostrano che il sito sia veloce per gli utenti.** Lighthouse misura un laboratorio:
  una macchina, una rete simulata, una cache fredda, nessuna estensione del browser. I dati
  di campo (CrUX, RUM) sono un'altra cosa e questo agente non li vede: il primo posto dove
  guardare dopo il lancio è quello, non questo handoff.
- **Non dimostrano che le pagine misurate siano quelle giuste.** Il gate legge la firma del
  contratto, non la sua verità. Una baseline impeccabile sulle pagine sbagliate è comunque
  da buttare — e l'errore tipico è misurare la home e lasciare lenta la pagina che vende.
- **Non dimostrano che le ottimizzazioni reggano al contenuto vero.** Il banco ha dati di
  seed ({{quante righe}}): una lista che vola con dieci prodotti può crollare con
  diecimila, e nessun numero preso qui lo anticipa.
- **Non dimostrano che il costo dichiarato in §4 sia il costo vero.** «Il lampo bianco è
  accettabile» è un giudizio di chi ha confermato, non una misura: se si rivela sbagliato,
  la riga da riaprire è quella, con il nome di chi l'aveva accettato accanto.
- **Un gate verde non dice niente sull'hosting.** Tutto ciò che c'è qui dentro è stato
  misurato su `next start` in locale: runtime, regione, CDN e latenza del database in
  produzione sono ingressi che nessuno di questi sette passi ha guardato.
