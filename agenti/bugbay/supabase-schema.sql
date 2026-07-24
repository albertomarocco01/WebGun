-- ============================================================================
-- BugBay — schema delle tabelle per il backend Supabase (PostgreSQL).
-- Esegui questo SQL nello SQL Editor del tuo progetto Supabase, poi imposta
-- `storage.driver: "supabase"` in bugbay.config.json e fornisci le credenziali
-- (vedi README → "Salvare le segnalazioni su Supabase").
-- Il DB locale di sviluppo (default) rispecchia queste tabelle in SQLite.
--
-- IDEMPOTENTE: puoi rieseguirlo su un DB nuovo O già esistente. Gli ALTER
-- ...ADD COLUMN IF NOT EXISTS aggiornano i DB creati con lo schema precedente
-- (aggiunta della dimensione multi-progetto `project_id`).
-- ============================================================================

-- ── Progetti (hub multi-progetto) ───────────────────────────────────────────
-- Registro delle app/webapp gestite da BugBay. Un unico DB centrale può quindi
-- raccogliere le segnalazioni di TUTTI i tuoi software, ciascuna taggata col
-- proprio project_id. Ogni daemon `bugbay dev` conosce il proprio project.id
-- (bugbay.config.json) e lo stampa sulle scritture.
CREATE TABLE IF NOT EXISTS projects (
  id           uuid        PRIMARY KEY,
  name         text        NOT NULL,
  repo_path    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ── Segnalazioni della pipeline ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debug_reports (
  id               uuid        PRIMARY KEY,
  project_id       uuid,       -- progetto di appartenenza (hub multi-progetto)
  category         text        NOT NULL,
  priority         text        NOT NULL,
  area             text        NOT NULL,
  sub_area         text,
  url              text,
  notes            text        NOT NULL,
  reporter_name    text,
  status           text        NOT NULL DEFAULT 'Aperto',
  developer        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  resolution_notes text,
  attachments      jsonb       DEFAULT '[]'
);
-- Aggiorna i DB creati con lo schema pre-multi-progetto (nessun FK: una
-- segnalazione può arrivare prima che il progetto sia registrato).
ALTER TABLE debug_reports ADD COLUMN IF NOT EXISTS project_id uuid;
-- Testo grezzo del segnalatore, conservato quando l'auto-riformulazione AI
-- riscrive `notes` (workflow di default all'ingest).
ALTER TABLE debug_reports ADD COLUMN IF NOT EXISTS notes_original text;
CREATE INDEX IF NOT EXISTS debug_reports_created_at_idx ON debug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS debug_reports_status_idx     ON debug_reports (status);
CREATE INDEX IF NOT EXISTS debug_reports_project_idx    ON debug_reports (project_id);

-- ── Audit schedulati (cron in-process del daemon) ───────────────────────────
CREATE TABLE IF NOT EXISTS audits (
  id             uuid        PRIMARY KEY,
  project_id     uuid,
  nome           text        NOT NULL,
  schedule       text        NOT NULL DEFAULT '0 3 * * *',
  tipo           text        NOT NULL DEFAULT 'custom',
  focus          text        DEFAULT '',
  scope_globs    jsonb       DEFAULT '[]',
  profondita     text        DEFAULT 'standard',
  model          text        DEFAULT 'claude-sonnet-5',
  create_reports boolean     DEFAULT true,
  enabled        boolean     DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  last_run_at    timestamptz
);
CREATE TABLE IF NOT EXISTS audit_runs (
  id             uuid        PRIMARY KEY,
  audit_id       uuid        NOT NULL,
  started_at     timestamptz DEFAULT now(),
  finished_at    timestamptz,
  status         text        DEFAULT 'running',
  report         text,
  findings_count integer     DEFAULT 0,
  report_ids     jsonb       DEFAULT '[]',
  error          text
);
CREATE INDEX IF NOT EXISTS audit_runs_audit_idx ON audit_runs (audit_id, started_at DESC);
ALTER TABLE audits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;

-- ── Stato della Campagna di revisione QA (key-value) ────────────────────────
CREATE TABLE IF NOT EXISTS debug_checklist (
  id         text        PRIMARY KEY,
  status     text,
  note       text,
  developer  text,
  updated_at timestamptz DEFAULT now()
);

-- ── Voci della checklist QA (Refresh-with-AI) ───────────────────────────────
CREATE TABLE IF NOT EXISTS debug_checklist_items (
  id            text        PRIMARY KEY,
  project_id    uuid,       -- progetto di appartenenza (hub multi-progetto)
  section_title text        NOT NULL,
  section_order int         DEFAULT 0,
  label         text        NOT NULL,
  descr         text,
  files         jsonb       DEFAULT '[]',
  urls          jsonb       DEFAULT '[]',
  badges        jsonb       DEFAULT '[]',
  priority      text,
  status        text,
  note          text,
  is_new        boolean     DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE debug_checklist_items ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE INDEX IF NOT EXISTS debug_checklist_items_section_idx
  ON debug_checklist_items (section_order, section_title);
CREATE INDEX IF NOT EXISTS debug_checklist_items_project_idx
  ON debug_checklist_items (project_id);

-- ── Sicurezza ───────────────────────────────────────────────────────────────
-- BugBay accede con la service-role key (bypassa RLS) e NON autentica le route:
-- usalo SOLO in locale. Non esporre queste route in produzione. Se vuoi comunque
-- abilitare RLS sul progetto, ricordati di definire policy adeguate e testarle.

-- ── Ingestione diretta dalle app ONLINE (widget hosted → Supabase) ──────────
-- Le app DEPLOYATE non raggiungono il daemon locale (loopback): il widget in
-- modalità "hosted" scrive le segnalazioni DIRETTAMENTE via PostgREST con la ANON
-- key (pubblica). Per farlo in sicurezza serve RLS attiva + una policy SOLO-INSERT
-- per il ruolo `anon`, con vincoli sui valori. Il daemon locale continua a usare la
-- service_role (bypassa RLS), quindi la console non è toccata.
-- IDEMPOTENTE: rieseguibile senza danni. Esegui questo blocco DOPO le tabelle sopra.

-- id auto-generato: così il widget hosted può ometterlo (il daemon ne fornisce comunque uno).
ALTER TABLE debug_reports ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- RLS su TUTTE le tabelle esposte (public): senza, la anon key potrebbe leggerle.
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE debug_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE debug_checklist_items ENABLE ROW LEVEL SECURITY;

-- anon/authenticated NON devono leggere/modificare nulla: revoca tutto, poi concedi
-- il SOLO INSERT (a livello di COLONNA) su debug_reports — niente status/developer/
-- resolved_at/resolution_notes: l'app online non può manipolare la pipeline.
REVOKE ALL ON projects, debug_reports, debug_checklist_items FROM anon, authenticated;
GRANT INSERT (project_id, category, priority, area, sub_area, url, notes, reporter_name)
  ON debug_reports TO anon;

-- Policy SOLO-INSERT per anon: nessuna policy SELECT/UPDATE/DELETE → RLS li nega.
-- WITH CHECK vincola i valori (anti-abuso della chiave pubblica): status resta
-- 'Aperto' (default, anon non può settarlo), progetto obbligatorio, size limitate.
DROP POLICY IF EXISTS bugbay_anon_insert ON debug_reports;
CREATE POLICY bugbay_anon_insert ON debug_reports
  FOR INSERT TO anon
  WITH CHECK (
    status = 'Aperto'
    AND project_id IS NOT NULL
    AND char_length(notes) BETWEEN 1 AND 5000
    AND char_length(category) BETWEEN 1 AND 40
    AND char_length(priority) BETWEEN 1 AND 40
    AND char_length(area) BETWEEN 1 AND 200
    AND char_length(coalesce(url, '')) <= 2000
    AND char_length(coalesce(reporter_name, '')) <= 120
  );
