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
CREATE POLICY "insurances_all" ON public.insurances
  FOR ALL USING (auth.role() = 'authenticated');

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
CREATE POLICY "insurancePayments_all" ON public."insurancePayments"
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE IF EXISTS public.sales
  ADD COLUMN IF NOT EXISTS insuranceId          BIGINT,
  ADD COLUMN IF NOT EXISTS insurancePaidAmount  NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assuranceAmount      NUMERIC(15,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS assurances JSONB;

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('insurances', 'insurancePayments')
ORDER BY table_name;
