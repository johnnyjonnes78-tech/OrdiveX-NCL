-- OrdiveX — Ajout des colonnes lotNumber (saleItems) et paymentDetails (sales)
-- Non destructif : IF NOT EXISTS partout, aucune donnée existante touchée.
--
-- Contexte : ces deux champs étaient jusqu'ici systématiquement supprimés
-- avant l'envoi vers Supabase (voir js/db.js, _knownBadCols), car les
-- colonnes n'existaient pas. Conséquence concrète pour les pharmacies
-- multi-postes :
--   - saleItems.lotNumber : annulerVente() et le traitement des retours ont
--     besoin de ce champ pour recréditer le BON lot en stock. Sans lui
--     (vente synchronisée depuis un autre poste), le stock global est
--     recrédité mais pas le lot précis — dérive silencieuse de la
--     traçabilité par lot au fil du temps.
--   - sales.paymentDetails : la Caisse Journalière en a besoin pour
--     ventiler un paiement fractionné (espèces + Mobile Money, ou
--     assurance + ticket modérateur). Sans lui, une vente mixte vue depuis
--     un autre poste est comptée à tort comme 100% espèces, et une vente
--     assurance comme 100% créance — fausse la clôture de caisse et le
--     suivi des créances assurance.

ALTER TABLE IF EXISTS public."saleItems" ADD COLUMN IF NOT EXISTS "lotNumber" TEXT;

ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB;

-- Vérification : confirmer la présence des deux colonnes après exécution.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'saleItems' AND column_name = 'lotNumber')
    OR (table_name = 'sales' AND column_name = 'paymentDetails'));
