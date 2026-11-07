-- ═══════════════════════════════════════════════════════════════════════════════
-- OrdiveX — Paiement partiel (crédit/dette) + suppression douce des patients
--
-- À exécuter UNE SEULE FOIS, dans le projet Supabase de CHAQUE pharmacie déjà
-- en place (pour une pharmacie neuve, ces colonnes sont déjà incluses dans
-- supabase_nouvelle_pharmacie_complements.sql). Idempotent (IF NOT EXISTS
-- partout) : sûr à ré-exécuter sans danger.
--
-- Contexte (demandé par l'utilisateur, v9.13.3) :
--   1. Un patient peut désormais payer une PART du total à la vente à crédit
--      (le reste part en dette), et régler une dette en PLUSIEURS fois au
--      lieu d'un seul versement complet. "sales" n'avait aucune colonne
--      pour cumuler ce qui a déjà été payé sur une dette en cours.
--   2. Un patient peut désormais être supprimé de Dossiers Patients (son
--      historique d'achat reste intact dans Historique Ventes — suppression
--      douce, jamais un vrai DELETE). "patients" n'avait aucune colonne pour
--      marquer cet état.
--
-- Sans ce script : chaque appareil continue de retirer ces champs de ses
-- envois (colonne inconnue silencieusement ignorée par la synchro, voir
-- js/db.js) — les paiements partiels et les suppressions restent locaux à
-- l'appareil d'origine, jamais visibles sur un autre poste de la pharmacie.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. TABLE : sales — paiement partiel sur dette (crédit et assurance)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "amountPaid" NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "lastPaymentAt" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "lastPaymentMethod" TEXT;
-- creditStatus existe déjà (ajout_colonnes_sales_dettes_assurance.sql) ;
-- accepte désormais aussi la valeur 'partial' en plus de 'paid' — simple
-- chaîne TEXT, aucune contrainte à modifier.

-- ───────────────────────────────────────────────────────────────
-- 2. TABLE : patients — suppression douce
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "deletedAt" BIGINT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS "deletedBy" BIGINT;

-- ───────────────────────────────────────────────────────────────
-- Vérification finale
-- ───────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'sales' AND column_name IN ('amountPaid', 'lastPaymentAt', 'lastPaymentMethod'))
    OR (table_name = 'patients' AND column_name IN ('deletedAt', 'deletedBy')))
ORDER BY table_name, column_name;
