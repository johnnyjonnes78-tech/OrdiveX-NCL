-- ═══════════════════════════════════════════════════════════════════════════════
-- OrdiveX — Compléments schéma pour une NOUVELLE pharmacie
--
-- À exécuter UNE SEULE FOIS, JUSTE APRÈS supabase_schema.sql (dans cet ordre),
-- sur un projet Supabase tout neuf. Idempotent (IF NOT EXISTS partout) : sûr
-- à ré-exécuter sans danger si besoin.
--
-- Contexte : supabase_schema.sql couvre déjà la quasi-totalité des tables que
-- l'app synchronise (voir js/db.js, storesToSync/storesToPull), SAUF les
-- écarts identifiés en comparant précisément son contenu au code applicatif
-- actuel :
--   1. La table "prep_transfers" (file de préparation → caisse) n'existe pas
--      du tout dans supabase_schema.sql.
--   2. "invoices" dans supabase_schema.sql n'a pas les colonnes subtotal et
--      tvaAmount, que js/pages/invoices.js écrit pourtant à chaque facture.
--   3. "saleItems" dans supabase_schema.sql n'a pas la colonne lotNumber, dont
--      annulerVente() et le traitement des retours ont besoin pour recréditer
--      le BON lot en stock (pas juste le total global).
--   4. "invoices" n'a pas les colonnes paid/paidDate (statut de paiement
--      fournisseur) et "cashRegister" n'a pas la colonne category
--      (catégorisation des mouvements de caisse manuels) — ajoutées en
--      octobre 2026. Sans elles, ces deux fonctionnalités marchent sur un
--      seul appareil mais ne se synchronisent jamais entre postes ni vers le
--      cloud (le champ est silencieusement ignoré par la synchro).
--   5. "app_users" n'a pas les colonnes termsAccepted/termsAcceptedAt
--      (acceptation des Conditions d'Utilisation, posée automatiquement à
--      la création de tout compte depuis octobre 2026) — même conséquence
--      sans elles : jamais synchronisé entre postes ni vers le cloud.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. TABLE : prep_transfers — File de préparation → Caisse
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "prep_transfers" TO anon, authenticated, service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "prep_transfers";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────────────
-- 2. TABLE : invoices — colonnes manquantes dans supabase_schema.sql
-- ───────────────────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "tvaAmount" NUMERIC(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS _synced BOOLEAN DEFAULT TRUE;

-- ───────────────────────────────────────────────────────────────
-- 3. TABLE : saleItems — colonne manquante dans supabase_schema.sql
-- ───────────────────────────────────────────────────────────────
ALTER TABLE "saleItems" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

-- ───────────────────────────────────────────────────────────────
-- 4. TABLE : invoices (statut de paiement) + cashRegister (catégorie)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidDate" TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS category TEXT;

-- ───────────────────────────────────────────────────────────────
-- 5. TABLE : app_users — acceptation des Conditions d'Utilisation
-- ───────────────────────────────────────────────────────────────
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" BIGINT;

-- ───────────────────────────────────────────────────────────────
-- Vérification finale
-- ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'prep_transfers';

SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'invoices' AND column_name IN ('subtotal', 'tvaAmount', '_synced', 'paid', 'paidDate'))
    OR (table_name = 'saleItems' AND column_name = 'lotNumber')
    OR (table_name = 'cashRegister' AND column_name = 'category')
    OR (table_name = 'app_users' AND column_name IN ('termsAccepted', 'termsAcceptedAt')))
ORDER BY table_name, column_name;
