-- ═══════════════════════════════════════════════════════════════════════════════
-- OrdiveX — CORRECTIF CRITIQUE : colonnes manquantes sur la table "sales"
--
-- À EXÉCUTER UNE SEULE FOIS dans le projet Supabase de CHAQUE pharmacie déjà
-- en place, PUIS lire la note "APRÈS AVOIR EXÉCUTÉ CE SCRIPT" en bas de ce
-- fichier — cette seconde étape, dans l'application elle-même, est
-- OBLIGATOIRE pour que le correctif prenne effet sur les appareils déjà
-- utilisés. Non destructif : chaque instruction est idempotente (IF NOT
-- EXISTS partout) — sûr à exécuter même si une colonne existe déjà.
--
-- ─────────────────────────────────────────────────────────────────────────
-- BUG CORRIGÉ : un règlement de dette (créance patient/assurance) se
-- faisait normalement sur le moment, mais réapparaissait comme "en cours"
-- après fermeture et réouverture de l'app (ou sur un autre appareil).
--
-- CAUSE : la table "sales" de supabase_schema.sql n'a jamais eu les
-- colonnes creditStatus, paidAt, paidDate, paidMethod, preparerId,
-- preparerName, insuranceId, assuranceName, assuranceRef, assuranceAmount,
-- insurancePaidAmount, paymentDetails — pourtant écrites par l'application
-- à chaque vente et à chaque règlement de dette (POS, Historique Ventes,
-- Dossier Patient, Assurances & Tiers Payant). La synchronisation Supabase
-- (js/db.js) supprime silencieusement tout champ correspondant à une
-- colonne absente avant l'envoi ("apprentissage de colonne local-only"),
-- pour ne jamais bloquer la synchro des autres champs — ce règlement ne
-- quittait donc JAMAIS l'appareil où il a été fait. Résultat : l'appareil
-- d'origine le marque "synchronisé" (la requête Supabase réussit, juste
-- sans ces colonnes) ; au prochain pull (fermeture/réouverture, autre
-- poste), l'app re-télécharge la version toujours non-réglée restée sur
-- Supabase et écrase la version locale correctement réglée.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "creditStatus" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidAt" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidDate" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paidMethod" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "preparerId" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "preparerName" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "insuranceId" BIGINT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceName" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceRef" TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "assuranceAmount" NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "insurancePaidAmount" NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;

-- Vérification : confirmer la présence des nouvelles colonnes après exécution.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sales'
  AND column_name IN (
    'creditStatus', 'paidAt', 'paidDate', 'paidMethod',
    'preparerId', 'preparerName', 'insuranceId', 'assuranceName',
    'assuranceRef', 'assuranceAmount', 'insurancePaidAmount', 'paymentDetails'
  )
ORDER BY column_name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- APRÈS AVOIR EXÉCUTÉ CE SCRIPT — étape obligatoire, SUR CHAQUE APPAREIL :
--
-- Ce script ajoute les colonnes côté Supabase, mais chaque appareil qui a
-- déjà tenté (et échoué silencieusement) de synchroniser ces champs a mis
-- en cache localement "ces colonnes n'existent pas" — il continuerait à
-- les retirer de ses envois même après ce script, tant que ce cache n'est
-- pas vidé. Sur CHAQUE poste de la pharmacie :
--
--   Paramètres → Cloud → Zone Sensible → "Réparer l'envoi Cloud"
--
-- Cette action vide ce cache ET renvoie tout ce qui n'a encore jamais
-- correctement atteint Supabase (y compris les dettes déjà réglées
-- localement). Une fois fait sur tous les appareils, le bug ne doit plus
-- se reproduire.
-- ═══════════════════════════════════════════════════════════════════════════════
