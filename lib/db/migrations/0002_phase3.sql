-- Phase 3: learnerships vertical, monitoring, submit form, interest signals

-- 1. Add opportunity_type to sources (identifies what vertical a source produces)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS opportunity_type text NOT NULL DEFAULT 'bursary';

-- 2. Learnership opportunity type — config row; NO schema rebuild needed.
--    The schema, template, gate, and freshness loop already handle any type.
INSERT INTO opportunity_types (type, label, url_prefix, schema_org_type, enabled)
VALUES ('learnership', 'Learnerships', 'learnerships', 'EducationalOccupationalProgram', true)
ON CONFLICT (type) DO NOTHING;

-- 3. Collector run logs (per-source, per-run record count for silent-failure detection)
CREATE TABLE IF NOT EXISTS collector_run_logs (
  id               serial PRIMARY KEY,
  source_name      text    NOT NULL,
  ran_at           timestamptz NOT NULL DEFAULT NOW(),
  records_found    integer NOT NULL DEFAULT 0,
  records_upserted integer NOT NULL DEFAULT 0,
  duration_ms      integer,
  error            text
);
CREATE INDEX IF NOT EXISTS collector_run_logs_source_ran
  ON collector_run_logs (source_name, ran_at DESC);

-- 4. Monitoring alerts (raised by silent-failure detection or manual inspection)
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id           serial PRIMARY KEY,
  alert_type   text    NOT NULL,   -- 'silent_collector' | 'source_quiet' | 'source_error'
  source_name  text    NOT NULL,
  message      text    NOT NULL,
  details      jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

-- 5. Interest signals (aggregate/anonymous — POPIA: no PII ever stored here)
--    Groundwork for education-provider lead-gen. Date-only granularity reduces
--    re-identification risk. Full POPIA compliance gate must pass before any
--    personal data (CV, student ID, contact info) is captured — see Phase 4 spec.
CREATE TABLE IF NOT EXISTS interest_signals (
  id               serial PRIMARY KEY,
  opportunity_type text NOT NULL,
  field_of_study   text,
  province         text,
  signal_type      text NOT NULL DEFAULT 'page_view',
  created_date     date NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS interest_signals_date ON interest_signals (created_date DESC);
