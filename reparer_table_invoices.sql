-- OrdiveX — Réparation de la table invoices (Supabase)
-- Non destructif : chaque instruction est idempotente (IF NOT EXISTS partout).
-- Sûr à exécuter même si la table existe déjà avec une partie des colonnes.
--
-- Contexte : un diagnostic client a signalé la table "invoices" comme absente
-- (pharma_missing_tables) sur son projet Supabase, alors que le code
-- applicatif (js/pages/invoices.js) écrit ces colonnes depuis longtemps.
-- Ce script aligne le schéma réel sur ce que l'application écrit
-- effectivement — voir js/pages/invoices.js (const invoiceData = {...}).

CREATE TABLE IF NOT EXISTS public.invoices (
  id              BIGINT PRIMARY KEY,
  "invoiceNumber" TEXT,
  "supplierId"    BIGINT,
  "supplierName"  TEXT,
  date            TEXT,
  subtotal        NUMERIC(15,2) DEFAULT 0,
  "tvaAmount"     NUMERIC(15,2) DEFAULT 0,
  "totalAmount"   NUMERIC(15,2) DEFAULT 0,
  items           JSONB,
  status          TEXT DEFAULT 'draft',
  "paymentMethod" TEXT,
  note            TEXT,
  "createdBy"     BIGINT,
  "updatedAt"     BIGINT,
  _synced         BOOLEAN DEFAULT TRUE
);

-- Si la table existait déjà avec un schéma incomplet ou différent (ancienne
-- version), complète sans jamais toucher aux colonnes/données existantes.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "supplierId"    BIGINT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "supplierName"  TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date            TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "tvaAmount"     NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "totalAmount"   NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS items           JSONB;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'draft';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS note            TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "createdBy"     BIGINT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "updatedAt"     BIGINT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS _synced         BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_invoices_supplierid ON public.invoices ("supplierId");
CREATE INDEX IF NOT EXISTS idx_invoices_date       ON public.invoices (date);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_updatedat  ON public.invoices ("updatedAt");

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices
  FOR ALL USING (auth.role() = 'authenticated');

-- Fiabilisation — les champs locaux 'coverage'/'refPerson' de la table
-- insurances sont désormais envoyés sous les noms 'coveragePercent'/
-- 'referent' (voir js/db.js, correctif client) — s'assurer que ces colonnes
-- existent bien (déjà créées par creer_tables_assurances.sql normalement ;
-- IF NOT EXISTS rend cette ligne sûre à exécuter même sans ce script).
ALTER TABLE IF EXISTS public.insurances ADD COLUMN IF NOT EXISTS "coveragePercent" NUMERIC(5,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.insurances ADD COLUMN IF NOT EXISTS referent TEXT;

-- Vérification : confirmer la présence et les colonnes réelles après exécution.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoices'
ORDER BY ordinal_position;
