# Référence visuelle — STM existant (à reproduire dans Snomark)

Captures extraites de la présentation officielle « Solution Traffic Management (STM) »
(Direction Marketing et Programmation TV SNRT). Elles servent de **référence de GUI** :
Snomark doit reprendre ce look, en plus moderne et soigné, avec les couleurs et le logo SNRT.

## Écrans de référence
- `01-fiche-programme.png` — Saisie / définition d'un programme (formulaire). → écran Programmes (P7)
- `02-segments-infos-generales.png` — Liste des segments, onglet Infos générales. → Programmes/Segments (P7)
- `03-segments-supports.png` — Segments, onglet Supports. → Programmes/Segments (P7)
- `04-segments-evenements.png` — Segments, onglet Événements secondaires. → Programmes/Segments (P7)
- `05-contrat-info-generale.png` — Édition d'un contrat (infos générales, modal). → Contrats (P12)
- `06-contrat-info-paiement.png` — Édition d'un contrat (paiement, modal). → Contrats (P12)
- `07-grille-hebdomadaire.png` — **Grille des programmes par semaine (calendrier, blocs colorés par genre).** → Grille linéaire (P8) [ÉCRAN CLÉ]
- `08-conducteur.png` — Conducteur de diffusion (tableau, bascule Table/Calendar). → Conducteur (P11)
- `09-liste-programmes.png` — « Trouver un programme » : liste filtrable + pagination + export Excel. → Programmes (P7)
- `10-accueil-statistiques.png` — Tableau de bord d'accueil : cartes KPI + camemberts par genre. → Accueil (P6/P13)

## Logo SNRT
- `snrt-etoile-blanc.png` — étoile SNRT blanche (pour la sidebar sombre).
- `stm-logo-couleur.png` — logo STM couleur (étoile SNRT + « Traffic Management »).

## Repères de style (observés)
- Sidebar sombre (bleu marine) avec icônes + libellés : Accueil, Pré-Grille, Grille, Programmes, Conducteur, Administration.
- Top bar claire, logo SNRT + nom d'utilisateur à droite.
- Accents bleus ; boutons d'action verts (＋ ajouter, Enregistrer).
- Blocs de grille colorés par catégorie (rose, vert, turquoise… par genre).
- Grille = calendrier semaine (colonnes = jours, lignes = créneaux 30 min), bascule Mois/Semaine/Jour.

## Usage avec Claude Code
Déposer ce dossier dans le repo. Lors des phases GUI (P6) et grilles (P8/P9),
pointer Claude Code vers ces images pour caler la mise en page, ex. :
« Reproduis la grille hebdomadaire en t'inspirant de
design-reference/stm-existant/07-grille-hebdomadaire.png, en plus moderne. »
