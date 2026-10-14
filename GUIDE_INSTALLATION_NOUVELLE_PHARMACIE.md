# Guide d'installation OrdiveX — Nouvelle pharmacie

Ce guide couvre la mise en place complète d'OrdiveX pour une nouvelle pharmacie,
de la création du projet Supabase jusqu'à la synchronisation vérifiée. Suivez les
étapes dans l'ordre.

## Fichiers nécessaires (déjà dans ce dépôt)

| Fichier | Rôle |
|---|---|
| `supabase_schema.sql` | Schéma principal (quasi toutes les tables + RLS + GRANT) |
| `supabase_nouvelle_pharmacie_complements.sql` | Les 3 ajouts manquants dans le schéma principal (`prep_transfers`, colonnes `invoices`, colonne `saleItems.lotNumber`) |

Aucun autre fichier `.sql` du dépôt n'est nécessaire pour une pharmacie neuve
(les autres — `supabase_complete_schema.sql`, `supabase_enable_rls.sql`,
`creer_tables_assurances.sql`, `creer_tables_manquantes_shifts_prep_assurances.sql`,
`reparer_table_invoices.sql`, `reparer_ventes_paiements_lots.sql` — sont des
scripts de réparation pour d'anciennes pharmacies déjà en place, déjà couverts
par les deux fichiers ci-dessus pour une installation neuve).

---

## Étape 1 — Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créez un **nouveau projet**.
2. Notez le mot de passe de base de données choisi (gardez-le en lieu sûr — pas
   nécessaire pour la suite, mais utile en cas de problème).
3. Attendez que le projet soit complètement provisionné (quelques minutes).

## Étape 2 — Exécuter le schéma SQL

⚠️ **`supabase_schema.sql` commence par des `DROP TABLE ... CASCADE` — à n'exécuter
que sur un projet neuf et VIDE.** Ne jamais le relancer sur un projet contenant déjà
des données réelles d'une pharmacie en activité : ça les supprimerait.

Dans l'éditeur SQL de Supabase (SQL Editor → New query) :

1. Collez et exécutez l'intégralité de **`supabase_schema.sql`**.
2. Puis collez et exécutez l'intégralité de **`supabase_nouvelle_pharmacie_complements.sql`**.

Les deux scripts se terminent par une requête de vérification (`SELECT ... FROM
information_schema...`) qui liste les tables/colonnes créées — confirmez que le
résultat n'est pas vide avant de continuer.

## Étape 3 — Activer la connexion anonyme

Dans le tableau de bord Supabase : **Authentication → Sign In / Providers →
Anonymous Sign-Ins** → activez le bouton, puis **sauvegardez explicitement**
(ne pas se fier au seul changement visuel du bouton).

OrdiveX se connecte anonymement à chaque démarrage pour satisfaire les
politiques RLS qui exigent une session (`insurances`, `insurancePayments`).
Sans cette option active, ces deux tables en particulier ne synchroniseront
jamais, sans erreur visible.

## Étape 4 — Récupérer l'URL et la clé API

Dans **Project Settings → API** :

- **Project URL** : ressemble à `https://xxxxxxxxxxxxx.supabase.co`
- **API Key** : utilisez la clé **`anon` / `public`** au format **legacy
  JWT** (une longue chaîne commençant par `eyJ...`), **pas** le nouveau format
  `sb_publishable_...`. La bibliothèque Supabase embarquée dans OrdiveX
  (`js/vendor/supabase.min.js`) ne gère pas encore le nouveau format de clé —
  si Supabase ne vous propose que le nouveau format par défaut, cherchez la
  section "Legacy API Keys" sur la même page pour révéler l'ancien format.

⚠️ **Piège vécu en production** : copiez **uniquement** l'URL ou la clé, jamais
toute la ligne d'un fichier `.env` (ex. ne collez pas
`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co`, collez seulement
`https://xxx.supabase.co`). Une URL ou une clé avec un préfixe de variable
d'environnement collé devant est invalide et fait échouer la synchronisation
**sans aucune erreur visible nulle part** — c'est la cause la plus fréquente
d'un "rien ne se synchronise" en nouvelle installation.

## Étape 5 — Configurer l'app

**Option A — Magic Link (recommandé pour un nouvel appareil)**

Ouvrez l'URL de l'app avec l'URL et la clé en paramètres :

```
https://johnnyjonnes78-tech.github.io/OrdiveX-NCL/?sb_url=<URL_SUPABASE_ENCODÉE>&sb_key=<CLE_ANON>
```

L'app enregistre automatiquement la configuration et recharge. Si l'appareil
avait déjà une autre pharmacie configurée, ses données locales sont
automatiquement effacées avant d'appliquer la nouvelle configuration (changement
de pharmacie = appareil neuf pour cette pharmacie).

**Option B — Saisie manuelle**

Dans l'app : **Paramètres → Cloud → Zone Sensible — Configuration du Serveur**,
collez l'URL et la clé (voir avertissement de l'étape 4), **Enregistrer la
configuration Cloud**. L'app recharge automatiquement.

## Étape 6 — Terminer la configuration de la pharmacie

Dans l'app (après le Magic Link ou la saisie manuelle) :

1. Terminer l'écran d'onboarding : nom de la pharmacie, informations légales,
   compte administrateur.
2. Créer ou importer le catalogue produits (Catalogue Produits → Importer, ou
   saisie manuelle).

Tant que ces deux points ne sont pas faits, il est normal que rien n'apparaisse
encore sur Supabase — la synchronisation n'envoie que ce qui existe localement.

## Étape 7 — Vérifier la synchronisation

1. Dans l'app : **Paramètres → Cloud → Réparer l'envoi Cloud** (force un envoi
   complet).
2. Dans Supabase : **Table Editor**, vérifiez que `app_users` et `settings`
   contiennent bien des lignes, puis que `products`/`stock` se remplissent après
   l'ajout du catalogue.

---

## Dépannage — problèmes déjà rencontrés en production

| Symptôme | Cause probable | Solution |
|---|---|---|
| Rien n'arrive sur Supabase, aucune erreur nulle part | URL ou clé collée avec un préfixe (`NEXT_PUBLIC_...=`) | Étape 4 — ne garder que la valeur pure |
| Rien n'arrive, `Authentication > Users` reste vide | Connexion anonyme non activée/sauvegardée | Étape 3 |
| Rien n'arrive, clé au format `sb_publishable_...` | Bibliothèque Supabase embarquée trop ancienne pour ce format | Étape 4 — utiliser la clé legacy `eyJ...` |
| Diagnostic du poste : "Tables absentes côté serveur" après avoir pourtant créé les tables | `pharma_missing_tables` (cache local) pas encore réactualisé | Paramètres → Cloud → "Récupérer les données" (pull manuel, redonne sa chance aux tables), ou "Réparer la synchro" |
| Script SQL : `policy already exists` à la ré-exécution | Ré-exécution d'un script déjà appliqué | Sans danger, c'est idempotent partout sauf cas déjà corrigés — relancez simplement |
| Ticket/devis imprimé illisible à un endroit précis | Bug d'affichage ponctuel déjà corrigé (v9.10.30+) | Vérifier que l'app est à jour |
