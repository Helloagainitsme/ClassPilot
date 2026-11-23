# ClassPilot pour Windows — Version de travail 0.1

Il s'agit d'une **première application de bureau**, pas simplement d'une page HTML. Elle utilise une base SQLite locale chiffrée avec un mot de passe.

## Lancer le logiciel

1. Décompressez l'archive ZIP.
2. Installez Node.js LTS (recommandation : Node 24) depuis https://nodejs.org/.
3. Double-cliquez sur `RUN_CLASS_PILOT.cmd` pour installer les dépendances (connexion Internet nécessaire à cette étape) et lancer l'application.
4. Créez votre mot de passe, choisissez la langue et cochez vos matières.
5. Choisissez une classe vide ou les **39 élèves fictifs de démonstration**.

## Créer l'installateur Windows

Double-cliquez sur `BUILD_WINDOWS_INSTALLER.cmd`, puis récupérez le fichier `ClassPilot-Setup-0.1.0.exe` dans le dossier `dist` si la compilation aboutit.

**Important :** l'archive fournie ne contient pas encore le fichier `.exe` compilé. Les scripts de compilation Windows sont inclus. Le logiciel n'a pas été testé sur un ordinateur Windows dans cet environnement.

## Fonctionnalités disponibles

- Tableau de bord global, groupe 1 et groupe 2 séparés, graphiques d'évolution.
- Dossier individuel de l'élève avec pré-test et positionnement actuel en haut.
- Gestion des compétences et niveaux de positionnement par matière.
- Enregistrement des tests et journal d'observations.
- Saisie collective des niveaux par groupe.
- Groupes de remédiation et affectation des élèves.
- Français, arabe, anglais ; matières activées par cases à cocher.
- Export CSV/JSON et sauvegardes SQLite chiffrées.

La planification « IA » est **simulée localement**, et aucun service d'IA externe n'est connecté dans cette version. Les données d'élèves réels ne doivent pas être utilisées sans autorisation et validation préalable des exigences de protection des données.
