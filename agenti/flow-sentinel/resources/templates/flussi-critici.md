# Flussi critici — {{NOME_PROGETTO}}

> Template. Ogni `{{segnaposto}}` va sostituito.
> Destinazione: `docs/flussi-critici.md` del progetto generato.
>
> Questo file **lo legge il gate**, non solo un umano: `verify.mjs` ne estrae gli
> id e i tipi. Il formato delle intestazioni e della riga `Confermato da:` non e'
> stile, e' sintassi.

Contratto della batteria End-to-End: l'elenco dei flussi che non possono
rompersi. Ogni flusso qui dentro ha un id stabile e almeno una spec che lo
attacca — il passo `spec-coverage` del gate e' rosso se non e' cosi'.

Confermato da: {{UMANO | ORCHESTRATORE}} ({{QUANDO}})

<!--
La riga qui sopra e' obbligatoria e senza di essa il passo `flussi-critici` e'
una VERIFICA MANCANTE, non un passo superato: un elenco che nessuno ha
confermato e' l'opinione dell'agente su cosa fosse critico. In modalita'
interattiva conferma l'umano con un si' esplicito; in pipeline conferma
l'orchestratore, e i flussi che muovono denaro vero, mandano comunicazioni
reali o cancellano dati tornano comunque all'umano.
-->

{{RIGA_DA_DOVE_VENGONO_GLI_OSTILI}}
<!--
Una o due righe: da quale tabella del modello di accesso (handoff di Schema
Forge) sono stati derivati i flussi ostili. Ogni cella «—» e ogni «sola
lettura» e' un attacco da tentare via browser.
-->

## `{{id-del-flusso}}` — {{positivo | ostile-lettura | ostile-scrittura}}

<!--
Forma dell'intestazione, quella che il gate riconosce:
  ## `id-stabile` — tipo
Gli apici inversi sono facoltativi; il separatore puo' essere -, – o —.
L'id e' minuscolo, con trattini, e comincia con lettera o cifra
(`checkout-ospite`, `admin-negato-al-cliente`). E' la chiave che lega questo
contratto alle spec: rinominarlo rompe la copertura, e la rompe in silenzio se
non si rinomina anche l'etichetta `@flusso:` nel titolo del test.
Il tipo e' uno dei tre, scritto esattamente cosi'.
-->

1. {{PRIMO_PASSO}}
2. {{SECONDO_PASSO}}

**Effetto atteso sul database:** {{QUALE_RIGA_ESISTE_O_QUALE_STATO_AVANZA}}

<!--
Per un flusso `ostile-lettura` questa riga diventa:
  **Rifiuto atteso:** {{redirect, 403, contenuto assente}} — non c'e' effetto
  sul database da confrontare.
Per un flusso `ostile-scrittura` servono ENTRAMBE le meta':
  **Rifiuto atteso:** {{...}} **e** database invariato ({{quale conteggio}}).

Questa parte il gate NON la verifica: e' prosa, e nessuno strumento sa leggere
«l'ordine esiste». Si scrive lo stesso perche' e' quello che chi scrive la spec
deve asserire, ed e' quello che chi legge il rosso usa per capire se il test
guardava la cosa giusta.
-->
