# Guide de Connexion des Scanners — OrdiveX

Ce guide s'adresse aux équipes qui installent ou raccordent un lecteur de codes-barres/QR dans une pharmacie utilisant OrdiveX. Il couvre les 4 façons de scanner supportées par l'application — aucune ne nécessite d'acheter un modèle de scanner en particulier.

## Les 4 niveaux de scan OrdiveX

| Niveau | Matériel | Où ça sert |
|---|---|---|
| 1 | Caméra du téléphone/tablette/PC qui fait tourner OrdiveX | Vente (POS), dépannage sans scanner physique |
| 2 | Scanner physique USB ou Bluetooth (douchette), **toute marque** | Vente (POS) et comptage d'inventaire, en temps réel |
| 3 | Lecteur autonome hors-ligne ("data collector") | Comptage d'inventaire, par lot/fichier |
| 4 | Un appareil dédié de plus, avec OrdiveX installé dessus | Scan en parallèle sur un poste séparé |

Rien à activer ni à configurer dans OrdiveX pour les niveaux 1, 2 et 4 : ça fonctionne automatiquement dès qu'un scanner est branché/appairé. Seul le niveau 3 demande une action manuelle (importer un fichier).

---

## Niveau 2 — Scanner physique (USB ou Bluetooth), la méthode recommandée

C'est la méthode à privilégier dès qu'une pharmacie possède un scanner physique : plus rapide et plus fiable que la caméra, et elle fonctionne sur **tous les appareils**, y compris les iPhone (où le scan caméra ne fonctionne pas — voir plus bas).

### Comment reconnaître le bon type de scanner

La quasi-totalité des scanners du marché (même les modèles génériques/sans marque trouvés localement) fonctionnent en mode **"douchette clavier"** (keyboard wedge / HID) : l'appareil ne fait rien de spécial à l'ordinateur ou au téléphone — il se fait juste passer pour un clavier, et "tape" le code scanné suivi de la touche Entrée. C'est exactement ce qu'OrdiveX attend, et c'est pour ça qu'**aucune marque particulière n'est requise**.

**Avant d'installer quoi que ce soit dans une pharmacie**, faites ce test en 30 secondes avec le scanner reçu :
1. Ouvrez le Bloc-notes (Windows) ou n'importe quel champ de texte sur le téléphone.
2. Cliquez/touchez dans le champ pour y mettre le curseur.
3. Scannez un code-barres quelconque.
4. **Résultat attendu :** le code apparaît instantanément dans le champ, suivi d'un retour à la ligne (comme si quelqu'un avait tapé le code puis appuyé sur Entrée).

Si ce test fonctionne, le scanner est compatible à 100% avec OrdiveX, sans aucune configuration côté logiciel.

### Connexion filaire (USB)

La plus simple et la plus fiable pour un poste fixe de comptoir :
1. Brancher le câble USB du scanner sur l'ordinateur/la tablette.
2. Attendre quelques secondes (le système l'installe automatiquement comme périphérique clavier).
3. Faire le test du Bloc-notes ci-dessus pour confirmer.
4. C'est prêt — ouvrir OrdiveX, aller sur **Point de Vente** ou **Inventaires**, et scanner directement.

### Connexion sans fil (Bluetooth)

Utile pour scanner en se déplaçant dans les rayons (réception de commande, inventaire) sans être relié par un câble :
1. Mettre le scanner en mode appairage (généralement : maintenir un bouton, ou scanner un code-barres "pairing/BT" imprimé dans le manuel du scanner — chaque modèle a sa propre procédure, toujours détaillée dans sa notice).
2. **Si le scanner propose plusieurs modes de connexion** (souvent affiché comme SPP / HID / BLE dans le manuel), toujours choisir **HID** — c'est le mode "clavier" compatible avec OrdiveX. Le mode SPP (port série) ne fonctionnera PAS directement avec OrdiveX sans logiciel additionnel.
3. Sur l'appareil (téléphone/tablette/PC) : Paramètres → Bluetooth → Rechercher un appareil → sélectionner le scanner dans la liste → Appairer.
4. Une fois appairé, refaire le test du Bloc-notes pour confirmer.
5. Ouvrir OrdiveX et scanner normalement.

**Attention batterie :** un scanner Bluetooth qui se déconnecte en pleine vente ou en plein comptage est presque toujours un problème de batterie faible ou d'appairage perdu — vérifier la charge en premier avant de chercher un problème logiciel.

### Utilisation dans OrdiveX

Aucun bouton à cliquer pour "activer" le scanner physique : dès qu'il est connecté, taper/scanner n'importe où sur la page **Point de Vente** (y compris dans la barre de recherche) ajoute automatiquement le produit au panier. Sur la page **Inventaires**, pendant la saisie du comptage, scanner un produit incrémente directement sa quantité physique de 1, sans besoin de cliquer dans une case précise au préalable.

---

## Niveau 1 — Scan par caméra (dépannage, sans scanner physique)

Utile en attendant qu'une pharmacie reçoive son scanner physique, ou en secours ponctuel.

- **Fonctionne** : Chrome et Edge sur Android, Windows, et la plupart des PC.
- **Ne fonctionne PAS** : Safari et tout navigateur sur iPhone/iPad (limitation du système d'exploitation d'Apple, pas d'OrdiveX). Dans ce cas, OrdiveX affiche maintenant un message clair et bascule automatiquement vers la saisie manuelle — ce n'est plus un blocage silencieux.
- **Sur iPhone/iPad**, toujours privilégier un scanner physique (Niveau 2, qui fonctionne partout) plutôt que la caméra.

Bouton caméra disponible sur la page Point de Vente (icône caméra à côté de la recherche) et sur la page Inventaires (bouton "Scanner").

---

## Niveau 3 — Lecteur autonome hors-ligne ("data collector")

Certains scanners d'entrée de gamme fonctionnent sans être connectés en permanence : on scanne toute une série de produits en se déplaçant dans la pharmacie, puis on "vide" la mémoire du scanner dans un fichier une fois revenu au comptoir.

### Récupérer le fichier de scans

La méthode dépend du modèle de l'appareil (toujours dans son manuel) :
- Câble USB vers l'ordinateur, avec un logiciel ou un dossier qui apparaît comme une clé USB.
- Application mobile du fabricant qui transfère le fichier par Bluetooth.
- Parfois un simple export par e-mail.

Dans tous les cas, on obtient un fichier texte (`.txt`) ou tableau (`.csv`) contenant la liste des codes scannés.

### Importer le fichier dans OrdiveX

1. Aller sur **Inventaires** → ouvrir ou démarrer un comptage.
2. Cliquer sur **"Importer fichier scan"**.
3. Sélectionner le fichier `.txt` ou `.csv` récupéré depuis le scanner.
4. OrdiveX applique chaque ligne du fichier et affiche un résumé (nombre de lignes reconnues / non reconnues).

**Formats de ligne acceptés** (une ligne = un scan) :
- `CODE` seul → ajoute 1 unité.
- `CODE,3` ou `CODE;3` ou `CODE` + tabulation + `3` → ajoute 3 unités d'un coup (si l'appareil du fabricant exporte déjà un total par code plutôt qu'une ligne par scan individuel).

Si un fichier exporté par un appareil ne correspond à aucun de ces formats, ouvrez-le avec le Bloc-notes pour voir sa structure réelle et contactez l'équipe technique — l'import peut être adapté.

---

## Niveau 4 — Poste de scan dédié

Si une pharmacie veut un appareil uniquement pour scanner (par exemple une tablette fixée en rayon), il n'y a rien de spécial à faire :
1. Installer OrdiveX normalement sur cet appareil (même procédure que pour tout nouveau poste).
2. Se connecter avec un compte de la pharmacie.
3. C'est tout — cet appareil se synchronise automatiquement avec les autres postes de la même pharmacie. On peut y utiliser un scanner physique (Niveau 2) ou la caméra (Niveau 1) exactement comme sur n'importe quel autre poste.

---

## Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le scanner ne tape rien du tout, même dans le Bloc-notes | Pas connecté / batterie à plat / mauvais mode (SPP au lieu de HID) | Vérifier la connexion USB/Bluetooth, charger le scanner, revérifier le mode dans son manuel |
| Le scanner tape le code dans le Bloc-notes, mais rien ne se passe dans OrdiveX | Le navigateur n'a pas le focus sur la page, ou une fenêtre/modale bloque | Cliquer une fois sur la page OrdiveX avant de scanner |
| Le produit scanné n'est "pas trouvé" | Le code scanné (EAN du fabricant) n'est pas enregistré sur la fiche produit dans OrdiveX | Vérifier/compléter le champ code-barres du produit dans Catalogue Produits |
| Les caractères scannés arrivent mélangés ou incomplets | Scanner mal configuré en vitesse de frappe, ou câble/Bluetooth instable | Réduire la distance (Bluetooth), tester un autre câble USB, consulter le réglage "vitesse d'émission" dans le manuel du scanner s'il existe |
| Ça scanne caméra mais rien ne se passe sur iPhone | Limitation Safari (normal, pas un bug) | Utiliser un scanner physique ou la saisie manuelle sur cet appareil |

## Checklist avant de quitter une pharmacie après installation

- [ ] Test du Bloc-notes réussi avec le scanner fourni
- [ ] Scan testé en conditions réelles sur la page Point de Vente (un produit ajouté au panier)
- [ ] Scan testé sur la page Inventaires (quantité physique incrémentée)
- [ ] Si scanner Bluetooth : appairage confirmé stable après redémarrage de l'appareil
- [ ] Si lecteur autonome (Niveau 3) : un export test importé avec succès dans OrdiveX
- [ ] L'équipe de la pharmacie a vu une démonstration complète (scanner un vrai produit, pas juste un code de test)
