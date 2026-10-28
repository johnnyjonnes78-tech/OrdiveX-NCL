-- OrdiveX — Ajout de colonnes Supabase pour les nouvelles fonctionnalités
-- (statut de paiement des factures fournisseurs + catégorie des mouvements
-- de caisse manuels). Non destructif : chaque instruction est idempotente
-- (IF NOT EXISTS partout) — sûr à exécuter même si une colonne existe déjà.
--
-- Contexte : le code applicatif (js/pages/invoices.js, js/pages/suppliers.js,
-- js/pages/caisse.js) écrit désormais ces champs, mais la synchronisation
-- Supabase (js/db.js) supprime silencieusement tout champ correspondant à une
-- colonne absente avant l'envoi ("apprentissage de colonne local-only") pour
-- ne jamais bloquer la synchro des autres champs. Résultat sans ce script :
-- la fonctionnalité marche sur UN SEUL appareil (IndexedDB local), mais le
-- statut de paiement et la catégorie de caisse ne se répliquent JAMAIS vers
-- le cloud ni vers les autres appareils de la même pharmacie.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "paidDate" TEXT;

ALTER TABLE public."cashRegister" ADD COLUMN IF NOT EXISTS category TEXT;

-- Vérification : confirmer la présence des nouvelles colonnes après exécution.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'invoices' AND column_name IN ('paid', 'paidDate'))
    OR (table_name = 'cashRegister' AND column_name = 'category')
  )
ORDER BY table_name, column_name;
