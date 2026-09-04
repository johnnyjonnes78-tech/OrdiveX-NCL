-- ═══════════════════════════════════════════════════════════════
-- OrdiveX — Création des 4 tables manquantes signalées par le
-- diagnostic ("Conformité schéma serveur") : shifts, prep_transfers,
-- insurances, insurancePayments.
--
-- À exécuter UNE FOIS dans l'éditeur SQL du projet Supabase de CETTE
-- pharmacie. Idempotent (CREATE TABLE IF NOT EXISTS partout) : sûr à
-- ré-exécuter même si une partie existe déjà.
--
-- Après exécution : dans l'app, Diagnostic du poste > "Réparer la
-- synchro" (ou simplement "Récupérer les données"), pour que ces 4
-- tables soient retirées de la liste des tables absentes et que leurs
-- données locales déjà existantes soient poussées vers le serveur.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- TABLE : shifts — Gestion des équipes (Shifts)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id            TEXT PRIMARY KEY,
  type          TEXT,                  -- 'matin', 'soir', 'nuit'
  "managerName" TEXT,
  "managerId"   TEXT,
  members       JSONB DEFAULT '[]',    -- tableau d'IDs utilisateurs
  note          TEXT DEFAULT '',
  status        TEXT DEFAULT 'open',   -- 'open' ou 'closed'
  "openedAt"    BIGINT,
  "closedAt"    BIGINT,
  date          TEXT,
  "updatedAt"   BIGINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shifts_updated ON public.shifts ("updatedAt");
CREATE INDEX IF NOT EXISTS idx_shifts_status  ON public.shifts (status);
CREATE INDEX IF NOT EXISTS idx_shifts_date    ON public.shifts (date);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shifts_full_access" ON public.shifts;
CREATE POLICY "shifts_full_access" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────
-- TABLE : prep_transfers — File de préparation → Caisse
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "prep_transfers" (
  id              BIGINT PRIMARY KEY,
  items           JSONB,
  "patientId"     BIGINT,
  "patientName"   TEXT,
  rx              JSONB,
  "preparerId"    BIGINT,
  "preparerName"  TEXT,
  "deviceId"      TEXT,
  "itemCount"     INTEGER DEFAULT 0,
  total           NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'pending', -- 'pending' | 'claimed' | 'completed' | 'cancelled'
  "claimedBy"     BIGINT,
  "claimedByName" TEXT,
  "claimedAt"     BIGINT,
  "completedAt"   BIGINT,
  "createdAt"     BIGINT,
  "updatedAt"     BIGINT
);
ALTER TABLE "prep_transfers" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prep_transfers_policy_select" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_insert" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_update" ON "prep_transfers";
DROP POLICY IF EXISTS "prep_transfers_policy_delete" ON "prep_transfers";
CREATE POLICY "prep_transfers_policy_select" ON "prep_transfers" FOR SELECT USING (true);
CREATE POLICY "prep_transfers_policy_insert" ON "prep_transfers" FOR INSERT WITH CHECK (true);
CREATE POLICY "prep_transfers_policy_update" ON "prep_transfers" FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "prep_transfers_policy_delete" ON "prep_transfers" FOR DELETE USING (true);
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "prep_transfers";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────────────
-- TABLES : insurances / insurancePayments — Assurances / Tiers payant
-- (colonnes volontairement NON quotées : Postgres les crée en
-- minuscules — ex. updatedat, coveragepercent — exactement ce que
-- js/db.js attend déjà pour ces deux tables spécifiquement, cf.
-- _insTablesNoCamel dans le code applicatif. Ne pas "corriger" la casse.)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurances (
  id                BIGINT PRIMARY KEY,
  name              TEXT NOT NULL,
  code              TEXT,
  contact           TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  referent          TEXT,
  conditions        TEXT,
  coveragePercent   NUMERIC(5,2) DEFAULT 0,
  paymentMode       TEXT DEFAULT 'invoice',
  status            TEXT DEFAULT 'active',
  observations      TEXT,
  createdAt         BIGINT,
  updatedAt         BIGINT,
  _synced           BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_insurances_status    ON public.insurances (status);
CREATE INDEX IF NOT EXISTS idx_insurances_name      ON public.insurances (name);
CREATE INDEX IF NOT EXISTS idx_insurances_updatedat ON public.insurances (updatedAt);
ALTER TABLE public.insurances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insurances_all" ON public.insurances;
CREATE POLICY "insurances_all" ON public.insurances FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public."insurancePayments" (
  id              BIGINT PRIMARY KEY,
  insuranceId     BIGINT REFERENCES public.insurances(id) ON DELETE SET NULL,
  amount          NUMERIC(15,2) DEFAULT 0,
  paymentMethod   TEXT DEFAULT 'transfer',
  reference       TEXT,
  observations    TEXT,
  userId          BIGINT,
  date            TEXT,
  timestamp       BIGINT,
  createdAt       BIGINT,
  updatedAt       BIGINT,
  _synced         BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_inspaym_insuranceid  ON public."insurancePayments" (insuranceId);
CREATE INDEX IF NOT EXISTS idx_inspaym_date         ON public."insurancePayments" (date);
CREATE INDEX IF NOT EXISTS idx_inspaym_updatedat    ON public."insurancePayments" (updatedAt);
ALTER TABLE public."insurancePayments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insurancePayments_all" ON public."insurancePayments";
CREATE POLICY "insurancePayments_all" ON public."insurancePayments" FOR ALL USING (auth.role() = 'authenticated');

-- Colonnes sales/patients liées aux assurances (sans effet si déjà présentes)
ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS insuranceId          BIGINT,
  ADD COLUMN IF NOT EXISTS insurancePaidAmount  NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assuranceAmount      NUMERIC(15,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS assurances JSONB;

-- ───────────────────────────────────────────────────────────────
-- Vérification finale : confirme que les 4 tables existent bien
-- ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('shifts', 'prep_transfers', 'insurances', 'insurancePayments')
ORDER BY table_name;
