# Lo Specchio della Commessa

La fase human-in-the-loop in cui l'agente **dimostra di aver capito** e chiede conferma, **prima** di toccare codice. È la regola n°0 della costituzione.

> Costruire la cosa sbagliata e rifarla costa 10× una conferma. Lo Specchio è il singolo risparmio di token più grande della skill.

## Quando scatta

- **Sempre** in onboarding (`init`) e sui task non banali.
- **Si salta** sui fix davvero banali (altrimenti diventa burocrazia — sarebbe anti-minimalismo).

**Soglia "non banale"** (basta uno): tocca più di 1 file · crea codice/file nuovi · cambia comportamento osservabile · è ambiguo o interpretabile in più modi · è irreversibile o difficile da annullare. Refactor di rinomina locale, fix di un typo, edit a un solo punto chiaro → banali, niente Specchio.

## Come deve essere fatto

- **Abbastanza da dimostrare davvero di aver capito** — non un telegramma, non un wall of text.
- Riformula il **cosa**, il **perché** e i **vincoli** — non solo l'azione secca.
- **Lingua semplice e parlata**, niente gergo, niente form a campi.
- Si ferma quando ha dimostrato comprensione, **prima** di diventare un riassunto esaustivo.
- Chiude con **una domanda di conferma** e **aspetta sul serio** (no domande retoriche).
- **Mai in stile caveman.** Lo Specchio è prosa che l'umano legge per decidere → resta chiaro e leggibile.

## La calibrazione (la parte delicata)

*Quanto basta perché l'utente sia sicuro che hai intuito bene — non una riga in meno, né un wall of text in più.*

**Task normale** → qualche frase scorrevole:

> Ok, ho capito. Vuoi che prenda la Hero scritta inline nella home e la sposti in un componente `Hero` dedicato, con le props per titolo, sottotitolo e call-to-action.
>
> L'aspetto e il comportamento restano identici — è solo un'estrazione, non un redesign. La pagina si limiterà a importare `<Hero>` e passargli i dati.
>
> Il senso è il riuso: la stessa Hero la potrai mettere anche in altre pagine cambiando solo le props. Ho inquadrato bene la commessa?

**Onboarding** (commessa grande) → un po' più ampio, sempre in prosa scorrevole: cosa fa il progetto, per chi, l'obiettivo che conta, i vincoli, e la definizione di "fatto". Mai un modulo a campi.

## L'artefatto

La commessa, una volta confermata, **non è solo una battuta**: viene scritta in `docs/PROGETTO.md` come fonte di verità. I task futuri vengono controllati contro di essa ("questa richiesta è coerente con la commessa confermata?"). Se la skill graphify è attiva, la si salva anche come nodo nel grafo con `graphify save-result --question "Commessa di <progetto>" --answer "<riformulazione confermata>" --type query --nodes <entità citate>` — richiede tutti e quattro gli argomenti (`--question/--answer/--type/--nodes`) e passa per l'interprete di graphify (vedi `skill-esterne.md`).

## Mini-struttura mentale (non un template da incollare)

Per costruire l'eco, copri — in prosa — questi punti, **solo quelli rilevanti**:

- **Cosa** ho capito che vuoi (riformulato)
- **Perché** / l'obiettivo che conta davvero
- **Vincoli** / cosa NON tocco
- **Definizione di "fatto"** (come sapremo che è finito — testabile)
- → una domanda secca di conferma
