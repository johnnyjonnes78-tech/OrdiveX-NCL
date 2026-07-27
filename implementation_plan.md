# Création du Manuel Officiel OrdiveX (PDF)

Le projet consiste à rédiger un manuel d'utilisation complet (20 chapitres + annexes) pour OrdiveX, au format PDF.

## User Review Required

> [!IMPORTANT]
> **Taille du document** : Rédiger un manuel aussi complet prendra plusieurs étapes. Je vais devoir le générer chapitre par chapitre pour garantir un niveau de détail professionnel.
> **Génération du PDF** : Je vais d'abord écrire le manuel en format Markdown/HTML pour bien structurer le texte. Ensuite, j'utiliserai un outil (comme un script Node.js) pour le convertir en vrai fichier PDF avec sommaire, pagination et en-têtes.
> **Captures d'écran** : Prendre des captures d'écran *réelles et automatiques* de toutes les fenêtres de l'application (qui nécessitent d'être connecté, d'avoir des données, etc.) est techniquement très complexe à scripter de zéro.
> **Proposition pour les images** : Je peux générer la structure avec des espaces réservés (ex: [Insérer capture de la page Vente]), ou essayer d'utiliser un script d'automatisation (Puppeteer), mais cela risque d'être fragile. Es-tu d'accord pour qu'on se concentre d'abord sur un texte extrêmement qualitatif et exhaustif, quitte à ce que tu insères toi-même les captures finales dans le document, ou préfères-tu que je tente un script automatisé de captures d'écran ?

## Proposed Changes

### Étape 1 : Rédaction du contenu (Markdown)
- Création d'un fichier manuel_ordivex.md.
- Rédaction détaillée des 20 chapitres, de la préface aux annexes.
- Formatage professionnel avec alertes, astuces, et tableaux.

### Étape 2 : Conversion en PDF
- Création d'un script Node.js utilisant une librairie (ex: md-to-pdf ou puppeteer).
- Application d'une feuille de style CSS pour le PDF (page de garde avec le logo OrdiveX, pagination, sommaire interactif).
- Génération du fichier Manuel_Utilisation_OrdiveX.pdf.

## Verification Plan
- Vérifier que tous les chapitres demandés sont présents.
- S'assurer que le langage est accessible et que chaque fonctionnalité de l'ERP est expliquée.
- Générer un PDF lisible et bien paginé.
