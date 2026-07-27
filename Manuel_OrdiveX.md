---
title: Manuel Officiel d'Utilisation
author: OrdiveX
date: 2026
---

# PRÉFACE

Bienvenue dans le manuel officiel d'utilisation d'**OrdiveX ERP Pharmaceutique**. 
OrdiveX est une solution de gestion intégrée, moderne et sécurisée, spécialement conçue pour les pharmacies et officines. Son objectif est de simplifier vos opérations quotidiennes, de la vente au comptoir (Point de Vente) jusqu'à la gestion complexe des stocks, des péremptions et des commandes fournisseurs.

**À qui s'adresse ce guide ?**
Ce manuel s'adresse à tous les utilisateurs d'OrdiveX, quel que soit leur rôle :
- **Caissiers et Vendeurs** : Pour maîtriser les encaissements et la recherche de médicaments.
- **Gestionnaires de stock** : Pour l'inventaire, les réceptions de commandes et le suivi des péremptions.
- **Pharmaciens titulaires et Administrateurs** : Pour l'analyse financière, la gestion des permissions et le pilotage global de l'officine.

**Comment utiliser ce guide ?**
Ce document est organisé de manière logique, en suivant le cycle de vie d'un produit dans votre pharmacie (de sa création à sa vente, en passant par son analyse). N'hésitez pas à utiliser le sommaire ou la fonction de recherche (Ctrl+F) pour accéder directement à la section qui vous intéresse. Des encadrés de conseils et d'avertissements vous accompagneront tout au long de votre lecture.

---

# CHAPITRE 1 : Découverte d'OrdiveX

## 1.1. Présentation générale
OrdiveX est conçu pour être rapide, intuitif et capable de fonctionner **même sans connexion Internet**. Toutes vos données sont enregistrées localement et se synchronisent de manière transparente avec le cloud dès que la connexion est rétablie.

## 1.2. Architecture du logiciel
L'interface d'OrdiveX est divisée en plusieurs zones clés :
- **Le menu latéral (à gauche)** : Permet de naviguer entre les différents modules (Caisse, Stock, Achats, etc.).
- **La zone de travail (au centre)** : Affiche les informations du module sélectionné (tableaux, formulaires).
- **La barre supérieure** : Contient l'accès rapide aux notifications, au statut de synchronisation, et à votre profil.

## 1.3. Les rôles utilisateurs
OrdiveX intègre une gestion stricte des permissions :
- **Caissier** : Accès limité au Point de Vente (Caisse) et à la consultation de base des stocks. Ne peut pas modifier les prix ni supprimer des produits.
- **Gérant / Pharmacien** : Accès complet à la gestion des stocks, commandes, rapports et traçabilité.
- **Administrateur** : Contrôle total, incluant la configuration du système et la gestion des comptes utilisateurs.

> [!TIP]
> **Astuce :** Vous pouvez personnaliser votre interface (Mode Sombre, couleurs) en cliquant sur l'icône de votre profil en haut à droite, puis "Paramètres".

---

# CHAPITRE 2 : Connexion

## 2.1. Première connexion
Pour accéder à OrdiveX, lancez l'application ou ouvrez l'adresse dans votre navigateur.
1. Entrez votre **identifiant** (souvent votre prénom ou code employé).
2. Saisissez votre **mot de passe** à l'aide de votre clavier ou du pavé numérique virtuel affiché à l'écran.
3. Cliquez sur **Se connecter**.

![Écran de connexion](./Image/capture_connexion.jpeg) *(Remplacez par le nom de l'image de la page de login)*

## 2.2. Mot de passe oublié
En cas de perte de votre mot de passe, vous devez vous adresser à l'**Administrateur** de la pharmacie. Celui-ci pourra réinitialiser votre mot de passe depuis le module *Paramètres > Utilisateurs*.

## 2.3. Déconnexion et verrouillage
- **Déconnexion complète** : Cliquez sur votre profil en haut à droite, puis sur **Déconnexion**.
- **Verrouillage rapide** : Le logiciel se verrouille automatiquement après une période d'inactivité pour sécuriser votre session. Vous devrez retaper votre code pour reprendre votre travail.

> [!WARNING]
> **Avertissement :** Ne partagez jamais votre code d'accès. Toutes les actions (ventes, retraits de stock) sont tracées et associées à votre profil.

---

# CHAPITRE 3 : Gestion des médicaments (Le Catalogue)

Le catalogue est le cœur de votre pharmacie. Il contient la liste de tous vos produits.

## 3.1. Accéder au catalogue
Cliquez sur **Médicaments** ou **Catalogue** dans le menu latéral. Vous y verrez un tableau regroupant tous vos produits, triés par ordre alphabétique par défaut.

## 3.2. Ajouter un médicament
1. Cliquez sur le bouton **+ Nouveau Produit**.
2. Remplissez le formulaire :
   - **Nom et DCI** : Le nom commercial et le principe actif.
   - **Code** : Le code-barres (vous pouvez utiliser une douchette pour le scanner).
   - **Prix** : Le prix d'achat et le prix de vente.
   - **Catégorie & Forme** : (ex: Comprimés, Sirop).
   - **Stock Minimum** : Très important pour que l'IA vous recommande quand recommander !
3. Cliquez sur **Enregistrer**.

> [!TIP]
> **Astuce IA :** Si le champ "Forme" est vide, OrdiveX essaiera de le deviner automatiquement à partir du nom du produit (ex: "DOLIPRANE 1000MG COMP" sélectionnera automatiquement "Comprimé").

## 3.3. Rechercher et Filtrer
Utilisez la barre de recherche en haut du catalogue. Vous pouvez taper le nom, le code-barres, ou la DCI. Utilisez les menus déroulants pour filtrer par catégorie ou par forme.

## 3.4. Gestion des numéros de lots et des péremptions
Lors de l'ajout de stock, le logiciel vous demandera (si activé) de préciser le numéro de lot et la date de péremption. Ces données sont fondamentales pour la traçabilité.

---

# CHAPITRE 4 : Gestion des fournisseurs

## 4.1. Liste des fournisseurs
Dans le menu **Fournisseurs**, vous retrouvez tous les grossistes et laboratoires avec lesquels vous travaillez.

## 4.2. Ajouter / Modifier un fournisseur
1. Cliquez sur **Ajouter un Fournisseur**.
2. Renseignez son nom, ses coordonnées (téléphone, email, adresse).
3. Cliquez sur **Enregistrer**.
Pour modifier, cliquez sur l'icône de crayon (Modifier) sur la ligne du fournisseur.

## 4.3. Historique du fournisseur
En cliquant sur le nom d'un fournisseur, vous accédez à sa fiche détaillée. Celle-ci regroupe :
- Le total des achats effectués chez lui.
- L'historique des bons de commandes et des factures.

---

# CHAPITRE 5 : Gestion des achats (Entrées en stock)

Ce module permet d'enregistrer les livraisons (réceptions de marchandises).

## 5.1. Créer une facture d'achat
1. Allez dans **Achats / Réceptions**.
2. Cliquez sur **Nouvel Achat**.
3. Sélectionnez le **Fournisseur** et renseignez le numéro de la facture/bon de livraison.
4. **Ajoutez les produits** : Scannez les codes-barres ou recherchez par nom.
5. Pour chaque produit, vérifiez le **Prix d'achat**, indiquez la **Quantité reçue**, le **Numéro de lot** et la **Date de péremption**.

## 5.2. Validation de l'achat
Une fois tous les produits listés, cliquez sur **Valider**. 
> [!WARNING]
> **Important :** Une fois validé, les quantités sont immédiatement ajoutées à votre stock réel. Le prix de vente en rayon peut également être mis à jour si vous l'avez modifié.

## 5.3. Annulation d'un achat
Si vous avez fait une erreur majeure, un administrateur peut annuler un achat dans l'historique. Cela retirera automatiquement les quantités du stock (attention aux ventes qui auraient eu lieu entre-temps !).

---

# CHAPITRE 6 : Commandes fournisseurs

Ce module (différent des "Achats/Réceptions") sert à préparer vos besoins avant l'arrivée de la marchandise.

## 6.1. Créer une commande
1. Allez dans **Commandes**.
2. Cliquez sur **Nouvelle Commande**.
3. Choisissez le fournisseur.
4. Ajoutez les produits et les quantités que vous souhaitez commander.
5. **Valider** la commande. Elle passe au statut "En cours".

## 6.2. Recommandations de l'IA (Intelligence Artificielle)
OrdiveX possède une assistante intelligente nommée Naomi. Lors de la création d'une commande, Naomi peut scanner votre stock et vous suggérer automatiquement les produits à commander en se basant sur :
- Le Stock Minimum défini dans le catalogue.
- L'historique des ventes récentes (si un produit se vend beaucoup).

## 6.3. Réception d'une commande
Quand le livreur arrive avec les cartons :
1. Ouvrez la commande "En cours".
2. Cliquez sur **Réceptionner**.
3. Le système bascule automatiquement vers l'écran d'**Achats** (Chapitre 5), prérempli avec les produits de la commande. Il ne vous reste qu'à confirmer les numéros de lots et les dates de péremption !

---

# CHAPITRE 7 : Gestion des ventes (Point de vente)

Le Point de Vente (POS) est l'interface que vous utiliserez le plus souvent au comptoir.

## 7.1. Créer une vente
1. Cliquez sur **Point de Vente** dans le menu principal.
2. L'interface affiche un panier vide.
3. **Scannez** le code-barres du produit ou **cherchez-le** par nom dans la barre de recherche.
4. Cliquez sur le produit pour l'ajouter au panier. S'il y a plusieurs lots disponibles, le logiciel choisira automatiquement le lot qui périme en premier (méthode FIFO).

## 7.2. Ajuster les quantités et appliquer des remises
- Pour augmenter la quantité, cliquez sur le "+" dans le panier ou tapez directement le nombre.
- Pour appliquer une remise (si vous en avez le droit), cliquez sur l'icône de pourcentage à côté du prix.

## 7.3. Paiement et Impression
1. Une fois le panier rempli, cliquez sur le gros bouton **Valider (Payer)**.
2. Choisissez le mode de paiement (Espèces, Carte, Mobile Money).
3. Si le client paie en espèces, entrez le montant donné : OrdiveX calculera automatiquement la **monnaie à rendre**.
4. Validez. Un ticket de caisse (reçu) s'imprime automatiquement (si configuré) ou peut être imprimé manuellement.

## 7.4. Devis
Au lieu de cliquer sur Valider, vous pouvez cliquer sur **Devis** pour imprimer une estimation chiffrée (sans déduire le stock).

---

# CHAPITRE 8 : Gestion des stocks

Le module Stock vous permet d'avoir une vue globale et précise de vos entrepôts/rayons.

## 8.1. Entrées et Sorties (Mouvements)
Tout mouvement de stock (Vente, Achat, Perte, Péremption) est tracé. L'onglet **Mouvements** vous montre un historique complet (Qui a sorti quoi ? Quand ?).

## 8.2. Suivi des stocks faibles et ruptures
Le tableau de bord "Stock" met en évidence :
- Les **Ruptures** (quantité = 0).
- Les **Stocks Faibles** (quantité < stock minimum).

## 8.3. Produits dormants
Ce sont les produits qui sont en rayon depuis très longtemps sans aucune vente. Les repérer vous permet de faire des promotions pour récupérer de la trésorerie avant qu'ils ne périment.

## 8.4. Péremptions et Traçabilité (Pharmacovigilance)
OrdiveX possède un onglet dédié : **Traçabilité & Pharmacovigilance**.
- **Médicaments expirés** : Ils sont regroupés par médicament et date. Le logiciel affiche directement la **perte financière** correspondante !
- **Proches de l'expiration (< 90 jours)** : À surveiller.
- **Destruction** : Un bouton permet de détruire officiellement les produits périmés, avec un rapport de destruction pour l'audit.

---

# CHAPITRE 9 : Inventaire

L'inventaire permet de corriger les écarts entre le stock théorique de l'ordinateur et le stock réel sur les étagères.

## 9.1. Faire un inventaire
1. Allez dans le module **Stock**, onglet **Inventaire**.
2. Les produits sont listés (généralement triés par ordre alphabétique pour faciliter le comptage en rayon).
3. Comptez les boîtes physiques et entrez le chiffre dans la case Qté Réelle.
4. Le système vous montre l'écart (ex: -2 ou +1).
5. Cliquez sur **Appliquer les écarts**. Le stock est mis à jour et un historique est créé.

> [!TIP]
> **Astuce :** Ne faites pas un inventaire complet en une fois si votre pharmacie est grande. Faites un "Inventaire tournant" (ex: compter uniquement les sirops aujourd'hui, les comprimés demain). Vous pouvez exporter la liste en Excel/PDF pour la confier à vos magasiniers.

---

# CHAPITRE 10 : Rapports

Le module **Rapports** est indispensable pour analyser la santé de la pharmacie.

## 10.1. Types de rapports
- **Rapport des ventes (Clôture de caisse)** : Indispensable en fin de journée pour compter la caisse (Montant théorique vs Montant réel).
- **Rapport des achats** : Suivi des dépenses par fournisseur.
- **Rapport des mouvements** : Suivi détaillé de chaque boîte.

## 10.2. Filtres et Exports
Vous pouvez filtrer n'importe quel rapport par **Date** (Aujourd'hui, Cette semaine, Ce mois, Personnalisé) et par **Utilisateur**.
Tous les rapports sont exportables en :
- **PDF** (pour impression propre).
- **Excel / CSV** (pour le comptable).

# CHAPITRE 11 : Analyse financière (Tableau de bord)

Le tableau de bord (Dashboard) est votre centre de commandement. Il traduit vos opérations en données financières concrètes.

## 11.1. Les indicateurs de base
- **Chiffre d'Affaires (CA)** : Le total des ventes réalisées (argent encaissé).
- **Marge brute** : La différence entre le Prix de Vente et le Prix d'Achat. C'est votre véritable bénéfice avant frais de fonctionnement. Plus il est élevé, plus la pharmacie est rentable.
- **Panier Moyen** : Le chiffre d'affaires divisé par le nombre de tickets. Il indique combien dépense en moyenne un client. S'il est bas, vous devez former vos vendeurs aux "ventes complémentaires".

## 11.2. Les indicateurs avancés
- **Trésorerie estimée** : Montant des ventes - Montant des achats.
- **Rotation du stock** : Vitesse à laquelle vous écoulez votre stock. Une rotation forte = excellente santé. Une rotation faible = l'argent dort en rayon.
- **Produits les plus vendus** : Votre Top 10. Assurez-vous de ne jamais être en rupture sur ces produits "Vache à Lait".
- **Couverture du stock** : Combien de jours vous pouvez tenir avec le stock actuel si les livraisons s'arrêtent. 

> [!TIP]
> **Conseil :** L'intelligence artificielle Naomi analyse tous ces chiffres chaque soir et génère une petite "météo" de votre pharmacie en vous alertant sur les anomalies (ex: marge en baisse anormale).

---

# CHAPITRE 12 : Synchronisation (LiveSync)

OrdiveX fonctionne grâce à un moteur "Offline-First".

## 12.1. Travailler sans Internet
Si l'Internet de la pharmacie coupe, **rien ne s'arrête**. Vous pouvez continuer à vendre, à encaisser et à faire des inventaires. L'application stocke les données dans la mémoire locale de l'ordinateur.

## 12.2. La synchronisation automatique
Dès que la connexion Internet revient, la technologie *LiveSync* prend le relais silencieusement. Le système envoie toutes vos ventes locales vers le Cloud Supabase de manière sécurisée.
L'icône de connexion en haut de l'écran vous informe de l'état :
- **Pastille Verte** : Tout est synchronisé.
- **Pastille Orange** : Synchronisation en cours ou en attente d'Internet.

## 12.3. Gestion des conflits
Si un caissier vend le dernier Paracétamol sur l'ordinateur A (hors ligne), et qu'un autre caissier vend le même produit sur l'ordinateur B (hors ligne), la synchronisation privilégiera toujours l'action la plus récente (règle du dernier enregistré).

---

# CHAPITRE 13 : Impression et Exports

OrdiveX est conçu pour limiter l'utilisation du papier, mais l'impression reste parfois obligatoire.

## 13.1. Tickets de caisse
Vous pouvez imprimer les reçus au format imprimante thermique (80mm). Le ticket comprend le nom de la pharmacie, l'opérateur, les produits, le montant payé et la monnaie rendue.

## 13.2. Documents au format A4 (PDF)
Les commandes fournisseurs, les rapports de clôture, les devis et les inventaires sont conçus pour être imprimés sur des feuilles A4 classiques. 
- Cliquez sur le bouton **Imprimer** ou **Exporter PDF** présent dans chaque module. 
- L'aperçu avant impression du navigateur s'ouvrira automatiquement.

## 13.3. Export CSV / Excel
Pour la comptabilité externe, préférez l'export CSV. Il crée un fichier lisible par Microsoft Excel contenant toutes les données brutes d'une table.

---

# CHAPITRE 14 : Administration et Sécurité

Seul le Gérant (Pharmacien Titulaire) ou l'Administrateur a accès à cette section.

## 14.1. Gestion des Utilisateurs
1. Allez dans **Paramètres > Utilisateurs**.
2. Cliquez sur **Nouvel Utilisateur**.
3. Définissez son **Rôle** (très important pour restreindre l'accès à la caisse).
4. Définissez un mot de passe temporaire qu'il devra changer.

## 14.2. Journal des activités (Audit Log)
Chaque action (connexion, vente, modification de prix, suppression d'un produit, destruction de lot) est enregistrée de façon inaltérable dans le **Journal d'Audit**.
C'est indispensable en cas de vol, de litige, ou d'inspection (BPD / DNPM).

## 14.3. Sauvegardes
La sauvegarde est automatique dans le cloud. Cependant, l'Administrateur peut (et devrait) faire des exports périodiques des tables clés (Stock, Ventes) en CSV sur un disque dur externe par mesure de précaution absolue.

---

# CHAPITRE 15 : Paramètres du logiciel

Personnalisez votre expérience dans **Paramètres**.

## 15.1. Infos de la pharmacie
Nommez votre pharmacie, ajoutez son adresse et son slogan. Ces informations apparaîtront sur l'en-tête de tous les tickets de caisse et PDF imprimés.

## 15.2. Préférences d'affichage
- Mode Sombre (Dark Mode) / Mode Clair.
- Tri par défaut du catalogue (Alphabétique).

## 15.3. Paramètres avancés
C'est ici que l'Administrateur configure les accès aux bases de données Supabase, les clés d'API (Magic Link) et d'autres paramètres techniques. Ne modifiez jamais ces champs sans savoir ce que vous faites, au risque de casser la synchronisation.

# CHAPITRE 16 : Intelligence Artificielle (Naomi)

OrdiveX ne se contente pas de stocker vos données, il les analyse.

## 16.1. Comment fonctionne Naomi ?
Naomi est un widget d'assistance disponible en bas à droite de l'écran (bulle de dialogue). Elle croise les données de vos ventes, de vos stocks et des péremptions pour générer des recommandations en langage naturel.

## 16.2. Interpréter les alertes
- **Alertes Rouges (Critique)** : Stock épuisé sur un produit très demandé.
- **Alertes Oranges (Attention)** : Un produit tourne mal, risque de péremption imminente avec perte financière associée.
- **Alertes Vertes (Optimisation)** : Le système vous félicite sur vos marges ou vous suggère une quantité précise à commander.

## 16.3. Limites
L'IA se base sur les données que **vous** lui fournissez. Si vos inventaires sont faux, si vos prix d'achat ne sont pas à jour ou si vos vendeurs ne scannent pas tous les articles (ventes "hors système"), Naomi fera des recommandations erronées. 

---

# CHAPITRE 17 : Bonnes Pratiques de Gestion

Utiliser un ERP pharmaceutique exige de la rigueur. Voici comment tirer le meilleur d'OrdiveX.

## 17.1. Gestion des achats et du stock
- **Entrez les marchandises le jour même** de la livraison. Un produit en rayon non enregistré dans le système empêchera le caissier de le vendre correctement.
- **Utilisez toujours le code-barres (Scanner)** pour éviter les confusions entre deux dosages d'un même médicament.

## 17.2. Gestion financière
- **Clôturez la caisse tous les soirs** et confrontez le rapport logiciel avec l'argent physique.
- Le gérant doit observer sa **Marge brute globale** chaque semaine. Une baisse soudaine indique souvent une erreur de prix d'achat lors d'une saisie.

## 17.3. Prévention des pertes
- Saisissez rigoureusement **toutes les dates de péremption** lors des réceptions.
- Surveillez l'onglet Pharmacovigilance 1 fois par semaine. Mettez en avant (sur un comptoir spécifique) les produits qui expirent dans les 90 jours.

---

# CHAPITRE 18 : Foire Aux Questions (FAQ)

**Question : Puis-je modifier le prix de vente au moment du passage en caisse ?**
*Réponse : Non, seul un administrateur peut modifier un prix, et cela doit se faire dans le catalogue (Médicaments) pour éviter la fraude.*

**Question : Que faire si je valide un achat fournisseur avec une erreur de quantité ?**
*Réponse : Demandez à l'administrateur d'annuler cet achat dans l'historique et de le recréer proprement.*

**Question : La synchronisation cloud est bloquée au rouge, que faire ?**
*Réponse : Vérifiez la connexion Internet de l'ordinateur. Dès qu'elle reviendra, OrdiveX s'occupera du reste. Ne désinstallez jamais le navigateur ou l'application sans que la pastille soit verte.*

---

# CHAPITRE 19 : Dépannage (Résolution de problèmes)

Un problème technique ? Voici comment le résoudre par vous-même.

## 19.1. "Impossible d'ajouter le produit au panier" au Point de Vente
**Cause probable** : Le stock de ce produit est affiché à 0 dans le système.
**Solution** : 
1. Vérifiez s'il reste vraiment des boîtes en rayon. 
2. S'il en reste, c'est une erreur d'inventaire. Allez dans Stock > Inventaire et corrigez la quantité, ou bien enregistrez la facture fournisseur si elle a été oubliée.

## 19.2. "Erreur de mot de passe" lors de la connexion
**Solution** : Vérifiez que la touche "Verr Maj" (Caps Lock) n'est pas activée. Si l'erreur persiste, l'Administrateur doit réinitialiser votre code.

## 19.3. Le code-barres n'est pas reconnu
**Cause probable** : Le produit est nouveau, ou le code-barres a changé suite à un nouveau packaging.
**Solution** : Allez dans le Catalogue, cherchez le produit par son nom, cliquez sur Modifier, et scannez le nouveau code-barres dans le champ "Code".

## 19.4. Je ne trouve pas la facture fournisseur que je viens d'enregistrer
**Cause probable** : Vous avez peut-être créé une *Commande* (qui n'ajoute pas de stock réel) au lieu d'un *Achat / Réception*.

---

# CHAPITRE 20 : Glossaire

Pour mieux comprendre le jargon d'OrdiveX et de la pharmacie.

- **DCI (Dénomination Commune Internationale)** : Nom de la molécule (ex: Paracétamol).
- **FIFO (First In, First Out)** : Règle d'or de la gestion de stock. Le premier produit entré (ou celui qui périme le premier) doit être le premier vendu.
- **Stock minimum** : Seuil d'alerte. Si le stock passe en dessous, OrdiveX le signale comme "Stock faible".
- **COGS (Cost of Goods Sold - Coût d'Achat des Marchandises Vendues)** : L'argent que vous a coûté la marchandise qui a été vendue. Sert à calculer la vraie marge.
- **Marge brute** : Prix de vente - Prix d'achat.
- **Traçabilité** : Suivi ininterrompu d'un lot de médicament, du fournisseur jusqu'au patient, obligatoire pour des raisons de sécurité de santé publique.

---

# ANNEXES

## Raccourcis clavier (Si disponibles dans les futures versions)
- Ctrl + F : Recherche rapide (fonction standard du navigateur).
- F5 ou Ctrl + R : Recharger l'application (forcer la mise à jour).

## Précautions matérielles
- **Onduleur** : Toujours brancher l'ordinateur de caisse sur un onduleur pour éviter les coupures soudaines de l'ordinateur, qui pourraient corrompre les données du navigateur.
- **Scanner (Douchette)** : Configurez toujours la douchette pour qu'elle ajoute un saut de ligne ("Enter") après chaque scan.

---

*Fin du Manuel Officiel.*
