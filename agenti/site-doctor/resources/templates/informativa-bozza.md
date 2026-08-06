# Informativa privacy — **bozza** generata da `certifica`

> Modello della pagina che il comando `certifica` scrive **quando la misura non
> ha trovato nessuna informativa raggiungibile** e la voce è **nostra**.
>
> **Perché questo file esiste.** Fino al 2026-08-06 la skill prescriveva di
> generare l'informativa in bozza, la dichiarava nel §Contratto d'uscita
> (`src/app/privacy/page.tsx`) ed elencava le sette voci che il gate cerca — ma
> **non dava nessun modello**. Il collaudo avversario ha misurato la
> conseguenza: la prima esecuzione vera di `certifica` doveva inventarsi da zero
> il documento più delicato della skill, e ogni esecuzione successiva ne avrebbe
> inventato uno diverso. Un documento legale scritto da un programma è la cosa
> che questa skill fa di più delicato ed era la meno prescritta.

## Le tre regole di questa bozza

1. **Nessuna riga qui è consulenza legale.** Questo modello mette la
   **struttura** che l'art. 13 del Regolamento pretende e i **segnaposto** dove
   va il contenuto che solo il titolare del trattamento conosce. Chi risponde
   davanti al Garante è lui, non questa skill.
2. **La bozza non può andare online così com'è, e il gate lo fa rispettare.** Il
   passo `informativa-privacy` **blocca sui segnaposto serviti** e sotto le 400
   battute di testo visibile. È voluto: una bozza pubblicata mezza vuota è peggio
   di nessuna informativa, perché chi la legge crede di aver letto qualcosa.
   Quindi finché i `{{…}}` non sono sostituiti **il gate resta rosso**, ed è il
   modo in cui questa skill impedisce che la bozza diventi il documento finale.
3. **Un segnaposto per ogni cosa che solo il titolare sa.** Non si inventano né
   il nome del titolare, né i tempi di conservazione, né i destinatari, né il
   responsabile della protezione dei dati. Inventarli sarebbe la forma peggiore
   di falso verde: un documento completo e falso passa ogni controllo automatico.

## Le sette voci, e dove stanno qui sotto

Il gate le cerca **nel testo servito**, nella forma in cui compaiono in italiano
(`references/gdpr-e-cookie.md` §1). Ogni intestazione qui sotto ne copre una:

| voce dell'art. 13 | sezione di questa bozza |
|---|---|
| titolare del trattamento | §1 |
| finalità | §2 |
| base giuridica | §3 |
| destinatari / responsabile del trattamento | §4 |
| tempi di conservazione | §5 |
| diritti dell'interessato (accesso, rettifica, cancellazione) | §6 |
| reclamo all'autorità di controllo (Garante) | §7 |

**Se il sito è multilingua** si genera **una bozza per lingua**, ciascuna
raggiungibile dal piè di pagina delle pagine di quella lingua, e le due si
dichiarano fra le pagine alternate con gli `hreflang` come tutte le altre. Il
passo `informativa-privacy` pretende che **ogni** pagina pubblica ne raggiunga
una: una sola informativa italiana su un sito con dieci pagine di cui cinque
inglesi lascia scoperte le cinque inglesi.

---

## Il testo della bozza

> Da qui in giù è il contenuto della pagina. Le sezioni sono obbligatorie; il
> testo fra `{{…}}` va sostituito prima di pubblicare.

# Informativa sul trattamento dei dati personali

Questa pagina spiega quali dati personali questo sito raccoglie, perché li
raccoglie, per quanto tempo li conserva e quali diritti ha chi li lascia. È
scritta ai sensi dell'art. 13 del Regolamento (UE) 2016/679.

## 1. Titolare del trattamento

Il **titolare del trattamento** dei dati raccolti da questo sito è
{{RAGIONE SOCIALE}}, con sede in {{INDIRIZZO COMPLETO}}, {{P. IVA / C.F.}}.
Per ogni questione riguardante i propri dati si può scrivere a
{{INDIRIZZO EMAIL DI CONTATTO}}.

Il **responsabile della protezione dei dati**, dove è stato nominato, è
raggiungibile a {{CONTATTO DEL DPO, oppure: non è stato nominato}}.

## 2. Finalità del trattamento

I dati vengono trattati per queste **finalità**, e per nessun'altra:

{{ELENCO DELLE FINALITÀ — una riga per ognuna. Esempio della forma attesa:
«rispondere alle richieste inviate con il modulo di contatto»; «gestire il
rapporto contrattuale con chi diventa cliente». Non si scrive «per finalità
gestionali»: chi legge deve capire cosa succede ai suoi dati.}}

## 3. Base giuridica

Ogni finalità ha la sua **base giuridica** ai sensi dell'art. 6 del Regolamento:

| dato raccolto | finalità | base giuridica |
|---|---|---|
| {{CAMPO}} | {{FINALITÀ}} | {{es. misure precontrattuali richieste dall'interessato, art. 6.1.b}} |

Questa tabella deve combaciare, riga per riga, con la sezione «Dati raccolti dai
moduli pubblici» del certificato `docs/conformita.md`: sono lo stesso fatto
scritto per due lettori diversi, e se divergono è quella pubblicata a valere.

## 4. Destinatari dei dati

I dati possono essere comunicati a questi **destinatari**, che agiscono come
**responsabili del trattamento** per conto del titolare:

{{ELENCO DEI DESTINATARI — fornitore dell'ospitalità del sito, fornitore della
posta elettronica, gestore dei pagamenti, consulenti. Per ognuno: chi è e cosa
tratta. Se non ce n'è nessuno si scrive «nessuno», non si lascia vuoto.}}

I dati **non** vengono diffusi né venduti a terzi.

## 5. Tempi di conservazione

| dato | per quanto tempo | perché |
|---|---|---|
| {{CAMPO}} | {{DURATA}} | {{MOTIVO}} |

Scaduto il termine i dati sono cancellati o resi anonimi.

## 6. Diritti dell'interessato

Chi lascia i propri dati ha in ogni momento i **diritti dell'interessato**
previsti dagli artt. 15-22 del Regolamento: il **diritto di accesso** ai propri
dati, la **rettifica** di quelli inesatti, la **cancellazione**, la limitazione
del trattamento, la portabilità e il diritto di opporsi al trattamento.

Per esercitarli basta scrivere a {{INDIRIZZO EMAIL DI CONTATTO}}. La risposta
arriva entro un mese dalla richiesta.

## 7. Reclamo all'autorità di controllo

Chi ritiene che il trattamento dei propri dati violi il Regolamento può
proporre **reclamo** al **Garante** per la protezione dei dati personali, che è
l'**autorità di controllo** italiana (www.garanteprivacy.it), oppure agire
davanti all'autorità giudiziaria.

## 8. Cosa questo sito mette nel browser

L'elenco completo di cookie e archiviazioni, con lo scopo di ognuna e se sia
necessaria al funzionamento, è nella sezione «Archiviazione dichiarata» del
certificato `docs/conformita.md`, ed è quello **misurato** sul sito servito.

{{RIASSUNTO IN PROSA DELLE ARCHIVIAZIONI — chiave, a cosa serve, quanto dura.
Se esiste anche una sola archiviazione non essenziale, qui va detto che si
attiva solo dopo il consenso, e il banner deve esistere davvero.}}

Ultimo aggiornamento: {{AAAA-MM-GG}}

---

## Il guscio Next, per lo stack standard

Sullo stack del `CLAUDE.md` (Next App Router + TypeScript) la bozza nasce come
`src/app/privacy/page.tsx`, e il collegamento nel piè di pagina è la seconda
cosa che `certifica` scrive: **un'informativa che esiste e che nessuna pagina
linka non esiste per chi visita**, ed è il rilievo che il passo produce.

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informativa privacy",
  robots: { index: true, follow: true },
};

export default function PaginaInformativa() {
  return (
    <main>
      <h1>Informativa sul trattamento dei dati personali</h1>
      {/* Le otto sezioni qui sopra, una per <section> con il proprio <h2>.
          I segnaposto {{…}} restano visibili di proposito: il gate blocca
          finché sono serviti, ed e' l'unica cosa che impedisce alla bozza di
          diventare il documento definitivo per dimenticanza. */}
    </main>
  );
}
```

Il collegamento va nel componente del piè di pagina, **non** nella sola home:

```tsx
<Link href="/privacy">Informativa privacy</Link>
```

## Cosa questa bozza NON risolve

- **Non dice il vero al posto del titolare.** Il gate prova che il documento
  *nomina* le sette voci; che dica la verità su ognuna lo firma chi risponde.
- **Non decide la base giuridica.** La colonna del §3 è un segnaposto perché la
  scelta fra consenso, contratto e legittimo interesse cambia gli obblighi, e
  non è una scelta che un programma possa fare guardando un `autocomplete`.
- **Non sostituisce il banner.** Il banner si mette **se e solo se** la misura
  ha trovato archiviazione non essenziale (`references/gdpr-e-cookie.md` §5).
