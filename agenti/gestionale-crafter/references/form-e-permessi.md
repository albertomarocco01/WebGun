# Moduli e permessi — la RLS filtra le righe, i `grant` filtrano le colonne

Come si costruisce un form che il database non rifiuta, e perché un form generico "su tutta la riga" o fallisce o promuove chi lo usa.

## La misura che cambia tutto: su Supabase i `grant` sono già dati

Misurato sul banco (Postgres 18, Supabase CLI 2.95.4, 2026-07-28):

```
select defaclacl from pg_default_acl;
→ {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
   authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Supabase imposta `alter default privileges in schema public grant all on tables to anon, authenticated, service_role`. Due conseguenze, entrambe provate:

1. **Ogni `grant` scritto in una migrazione è un no-op**: il privilegio c'era già. Anche `anon` ha `insert/update/delete` su ogni tabella nuova — a fermarlo è solo l'assenza di policy.
2. **`grant update (colonna)` da solo non restringe niente.** Il permesso per colonna è **additivo**: se il permesso di tabella intera c'è, la colonna esclusa resta scrivibile.

Il test pgTAP del banco l'ha dimostrato prima che qualcuno lo argomentasse: con la sola riga `grant update (full_name, phone) on public.staff to authenticated`, il magazziniere ha eseguito `update public.staff set ruolo = 'titolare'` **sulla propria riga** ed è diventato titolare — e da lì ha scritto i contenuti del sito, che il suo ruolo non gli permetteva.

La forma corretta è quella di `schema-forge/references/rls-supabase.md` §Il caso peggiore, e va scritta per intero:

```sql
revoke all on public.staff from anon, authenticated;
grant select, insert, delete on public.staff to authenticated;
grant update (full_name, phone, is_active) on public.staff to authenticated;
```

**Prima si toglie, poi si concede.** Questa migrazione la scrive schema-forge: se manca, è una richiesta da mettere nell'handoff §6, non qualcosa da aggirare.

## Dove si legge la verità sui permessi

| Fonte | Cosa dice | Verdetto |
|---|---|---|
| `pg_class.relacl` | privilegi sull'**intera tabella** (`w` = update, `a` = insert) | è la prima domanda |
| `pg_attribute.attacl` | i **soli** grant per colonna: `full_name │ {authenticated=w/postgres}` | è la seconda |
| `information_schema.column_privileges` | **inutilizzabile per questo**: espande il permesso di tabella su ogni colonna, quindi mostra la stessa riga nei due casi opposti | — |

`scripts/audit-lib.mjs` legge le prime due. La terza è nominata qui perché è la scelta ovvia e sbagliata: sembra la vista fatta apposta, e conflaziona esattamente la distinzione che serve.

## Il modulo si costruisce sulle colonne, non sul tipo della riga

`Update` di `database.types.ts` è il tipo della **tabella**, non il tipo di ciò che *questo* utente può scrivere. Sono due cose diverse, e il tipo non lo sa.

```ts
// giusto: il modulo scrive le colonne concesse
.update({
  full_name: String(dati.get("full_name") ?? ""),
  phone: String(dati.get("phone") ?? "") || null,
})

// sbagliato: `ruolo` non è concessa → l'INTERA istruzione fallisce
.update({ full_name: …, phone: …, ruolo: … })
```

Postgres **non** scrive le colonne permesse ignorando le altre: rifiuta tutto con `permission denied for table staff`. Il difetto non si manifesta come «il ruolo non cambia», ma come «il salvataggio non funziona più», e chi indaga guarda la RLS — dove non c'è niente da trovare.

## Le colonne di privilegio non stanno nei form

Una colonna che decide *chi sei* (`ruolo`, `role`, `is_admin`, `job_title`, `permessi`…) non entra in un modulo insieme a nome e telefono. Il cambio passa da una funzione del database che verifica **chi chiama**:

```sql
create or replace function public.cambia_ruolo(persona uuid, nuovo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
    if not public.ha_ruolo('titolare') then
        raise exception 'solo il titolare cambia i ruoli';
    end if;
    if nuovo is null or nuovo not in ('titolare', 'magazziniere', 'redattore') then
        raise exception 'ruolo non ammesso';
    end if;
    update public.staff set ruolo = nuovo where id = persona;
    if not found then raise exception 'persona inesistente'; end if;
end;
$$;
```

```ts
await supabase.rpc("cambia_ruolo", { persona: id, nuovo: ruolo });
```

Perché una funzione e non un `grant update (ruolo)` al titolare: **il `grant` è per ruolo Postgres, non per persona.** `authenticated` sono tutti gli utenti autenticati, titolare compreso — concederlo a lui significa concederlo a chiunque. La distinzione fra le persone la sa fare solo il codice dentro la funzione.

Gli argomenti di un RPC li sceglie il chiamante: si validano tutti (`rls-supabase.md` §Gli argomenti di un RPC).

## Due controlli, e nessuno dei due è di troppo

L'interfaccia controlla il ruolo per non offrire un pulsante che porterà a un errore; il database controlla perché è l'unica difesa vera. Quando i due divergono ha **sempre** ragione il database, e la divergenza è un difetto da chiudere: un pulsante che c'è e non funziona è un difetto di interfaccia, un pulsante che manca ma l'operazione passerebbe è un difetto di modello.

Non si copiano le policy nell'applicazione. Si chiama la stessa funzione che usa la policy (`ha_ruolo`, `e_staff`) o si legge lo stesso dato: due implementazioni della stessa regola divergono al primo cambiamento, e quella che continua a dire di sì è l'applicazione.

## Quando arriva un `permission denied`

Nell'ordine, e senza saltare passi:

1. **quale colonna?** Il messaggio dice la tabella, non il campo: si confronta l'oggetto scritto con `attacl` (`audit`);
2. **quel campo lo deve davvero scrivere l'utente?** Se no, esce dal modulo — il difetto era il form;
3. **se sì, serve un permesso a monte**: si chiede a schema-forge un `grant` per colonna o una funzione. Va in handoff §6 e resta aperto finché non è chiuso;
4. **non si cambia chiave.** `service_role` fa sparire il messaggio e con esso ogni policy: è la scorciatoia che trasforma un problema di permessi in un buco di sicurezza.

## Righe che spariscono senza errore

Non è un caso di permessi, ma si presenta identico e vale ricordarlo qui: se un `update` tocca **zero righe** e nessuno solleva niente, la causa è quasi sempre la RLS — manca la policy di `select` per lo stesso ruolo, o la riga non appartiene a chi scrive. `rls-supabase.md` §`update` e `delete` hanno bisogno di una policy di `select`. Nel gestionale si vede come «salva e non cambia nulla»: leggere il conteggio delle righe toccate, invece di ignorarlo, fa risparmiare mezza giornata.

## Errori classici

| Errore | Conseguenza |
|---|---|
| `grant update (col)` senza `revoke` prima | non restringe niente: su Supabase il permesso di tabella c'era già (**misurato**) |
| un solo form per tutta la riga | o `permission denied` sull'intera istruzione, o auto-promozione |
| colonna di privilegio nel form | chi si modifica il proprio profilo si modifica i propri permessi |
| `information_schema.column_privileges` per sapere se una colonna è ristretta | risposta identica nei due casi opposti |
| la policy riscritta in TypeScript | due regole che divergono, e quella permissiva è l'applicazione |
| `permission denied` risolto con `service_role` | ogni policy scavalcata |
| `update` che tocca 0 righe letto come «riuscito» | il dato non cambia e nessuno se ne accorge |
