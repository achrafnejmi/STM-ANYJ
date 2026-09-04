# PLAN — Snomark / STM Next

> PoC d'une refonte complète de STM, alignée sur le **cahier des charges STM Next**.
> Piloté avec Claude Code. Règle d'or : **une phase = tâches + test ✅**, on ne code la
> phase N+1 qu'après validation de N. Avant de coder : présenter le plan + **lister les
> ambiguïtés** et s'arrêter (règle d'approbation).

---

## 1. Références (sources de vérité, par ordre d'autorité)

1. **`design-reference/Cahier_des_charges_STM_Next.docx`** — LE contrat. 10 modules (M0–M9) + recherche globale (M10), exigences numérotées **EXG-Mx-nn** avec priorité (Essentiel / Important / Souhaitable), règles de gestion **RG**, modèle de données, interfaces tierces. En cas de doute, il fait foi.
2. **`design-reference/stm-next-mockup.html`** — le **résultat visuel voulu** (prototype fonctionnel). Cible de GUI/UX.
3. **`design-reference/stm-existant/`** — captures de l'ancien STM + logos SNRT (référence historique).

## 2. Ambition

Viser **l'ensemble des modules M0–M9 (+ M10)**, construits **brique par brique**, en priorisant les exigences **Essentiel** de chaque module. GUI très soignée, aux couleurs et logo SNRT.

## 3. Principes directeurs (chap. 2 du cahier — font foi en cas d'ambiguïté)

1. **La grille est le produit** : tout converge vers le Plan de diffusion, sans changement de contexte.
2. **Le contrôle intervient au moment du geste** : un titre hors droits n'est pas proposé et son dépôt est refusé, motif énoncé. Vaut aussi pour les moteurs auto.
3. **Le système propose, l'utilisateur décide** : les moteurs n'écrivent jamais sans action explicite ; chaque exécution produit un rapport ; tout est annulable.
4. **Une saisie unique, des exceptions déclarées** : grille unique TNT/Satellite, différences = exceptions ; répétition d'un titre sur plusieurs jours.
5. **Le pilotage se fait par exception** : un centre d'anomalies recense les écarts ; on travaille la liste, pas la relecture créneau par créneau.

## 4. Conventions communes (chap. 3.3)

- **Journée d'antenne 06:00 → 06:00** le lendemain (un programme à 00:30 appartient à la veille).
- **Couleur = genre**, jamais autre chose ; habillage app neutre.
- **Signalisation** : rouge = bloquant (refusé), ambre = alerte (arbitrage), vert = conforme.
- **Horaires/durées** en police à chasse fixe, `HH:MM`.
- **Annulation/rétablissement** sur toute écriture (une génération auto = 1 opération).
- **Langues** : interface FR ; métadonnées titres saisissables FR/AR/EN (AR en RTL).

## 5. Acquis réutilisé (P0–P8 = fondation, ne rien jeter)

- P0 scaffold · P1 import+nettoyage xlsx (peuple le catalogue/plan) · P2 storage (session) · P5 Supabase + `db.js` · P6 coquille GUI SNRT · P7 fiche + segments · P8 grille calendrier.
- **Mapping conceptuel** (on garde les noms de tables physiques pour ne rien casser) :
  `programme` = **Titre** · `segment` = **Épisode** · `diffusion_lineaire` = **Transmission**.
- P8 (grille) = **embryon du M2 Plan de diffusion** ; P7 (fiche) = **embryon du M6 Catalogue/fiche**.
- **Notification (Offre/Notification)** : parquée. **Grille non-linéaire par plateforme** : conservée comme **extension hors cahier** (voir §9).

## 6. Modules cibles (détail des EXG dans le cahier)

- **M0** Coquille : nav permanente, sélecteur chaîne + vecteur, navigation temporelle, annuler/rétablir, notifications, recherche globale.
- **M1** Espace de travail par chaîne : contexte propre par chaîne (Al Aoula AW, Arryadia AR, Athaqafia AT, Assadissa AS, Tamazight TM) ; catalogue commun, éligibilité par chaîne.
- **M2** Plan de diffusion : grille **proportionnelle au temps**, catalogue glissable, drag-drop, inspecteur (Bloc/Répéter/Vecteur), trous + chevauchements, grille type en fond, anomalies.
- **M3** Grille type : blocs nommés (plage, fréquence, jours, genre attendu) — remplace la pré-grille.
- **M4** Auto-programmation : moteur déterministe (grille type + réservoir + règles), rapport, annulable.
- **M5** Plan média : campagnes de bandes-annonces, habillage, écrans pub ; couverture.
- **M6** Catalogue et fiche titre : **historique complet**, frise des droits, épisodes, métadonnées trilingues, PAD.
- **M7** Conducteur d'antenne : déroulé minuté dérivé du plan + plan média, insertion en place.
- **M8** Centre d'anomalies : écarts recensés en permanence, sélection → bloc concerné.
- **M9** Stock et bilans : volume dispo, fins de droits, répartition par genre.
- **M10** Recherche globale : par raccourci, part de l'épisode, remonte au titre.

## 7. Modèle de données cible (chap. 6)

Entités : **Chaîne, Titre, Épisode, Fenêtre de droits, Bloc de grille type, Transmission, Élément secondaire, Campagne, Diffusion (historique)**. Nomenclatures administrables : genres (FR/AR + couleur), types d'éléments secondaires, tranches d'antenne, vecteurs, types de production.
Chaque phase apporte sa **migration SQL** (fichier `supabase/migration-*.sql`, jamais rejouer `schema.sql`).

## 8. Feuille de route (brique par brique, Essentiel d'abord)

Acquis : **P0–P8** (fondation). **P9–P20 livrés ✅** — cœur linéaire complet (espace par
chaîne, plan de diffusion + inspecteur + anomalies, grille type, auto-programmation, plan
média, catalogue/fiche/droits, conducteur, stock & bilans, recherche globale + admin + undo
ciblé, grille non-linéaire réseaux + VOD).

- **P9 — M1 Espace de travail par chaîne** ✅ LIVRÉ : sélecteur de chaîne dans la coquille (5 chaînes, code, couleur, ligne éditoriale) ; scoping des données par chaîne ; bande de couleur chaîne. *Test : changer de chaîne recharge le contexte, sans perte.*
- **P10 — M2 (1/3) Plan de diffusion : catalogue glissable + drag-drop + aperçu historique** ✅ LIVRÉ. Panneau Catalogue à gauche (recherche, genre, vignette, durée, épisodes) ; **drag-drop d'un titre sur la grille** (heure calculée depuis la position, arrondi 5 min) ; **aperçu historique de diffusion au clic** sur un titre. *Drag autorisé pour tout programme pour l'instant (le garde-fou PAD/droits arrive avec M6).* *Test : glisser un titre → bloc créé au bon horaire ; clic titre → aperçu historique.*
- **P11 — M2 (2/3) Inspecteur de bloc** ✅ LIVRÉ : onglets Bloc (heure début/fin, durée, déprogrammation) / Répéter (jours, incrément épisodes) / Vecteur (TNT/Sat, exception). *Test : éditer/répéter/déprogrammer un bloc.*
- **P12 — M2 (partiel) + M8 Anomalies** ✅ LIVRÉ : **chevauchements** + centre d'anomalies + compteur sur le rail (+ contrôle des droits au geste quand dispo). **Trous d'antenne REPORTÉS après M3** (un trou se définit *dans un bloc de grille type*, EXG-M2-07). *Test : chevauchements détectés et listés dans le centre d'anomalies.*
- **P13 — M3 Grille type** ✅ LIVRÉ : blocs nommés par chaîne (plage, fréquence, jours, genre attendu — **aucun titre**), remplace la « pré-grille ». Affichage en **fond du plan** (bandes colorées, EXG-M3-04) **+ trous d'antenne** (désormais définissables par rapport aux blocs). *Test : définir un bloc, le voir en fond, un vide dans un bloc = trou signalé.*
- **P14 — M6 Catalogue et fiche titre (complet)** ✅ LIVRÉ : historique complet, frise des droits, épisodes, métadonnées FR/AR/EN, statut PAD → **active le garde-fou PAD/droits** du drag (M2). *Test : fiche complète, historique intégral, droits.*
- **P15 — M4 Auto-programmation** ✅ LIVRÉ : moteur déterministe + réservoir + règles + rapport, annulable. *Test : générer une journée, rapport des blocs vides motivés.*
- **P16 — M5 Plan média** ✅ LIVRÉ : campagnes + remplissage inter-programmes + couverture. *Test : campagne → bandes-annonces placées.*
- **P17 — M7 Conducteur d'antenne** ✅ LIVRÉ : déroulé minuté, timecodes cumulés, insertion en place. *Test : conducteur d'un jour, écarts affichés.*
- **P18 — M9 Stock et bilans** ✅ LIVRÉ : indicateurs, répartition par genre, fins de droits. *Test : bilan cohérent, export.*
- **P19 — M0 finitions + M10 recherche globale** ✅ LIVRÉ : annuler/rétablir global, notifications motivées, sélecteur de vecteur, recherche par raccourci. *Test : undo/redo, recherche épisode → titre.*
- **P20 — Extension : Grille non-linéaire (par plateforme)** ✅ LIVRÉ — hors cahier, conservée (voir §9).

### P21 — Finitions UI/UX (légères, faible risque)

7 lots. Un lot = plan → validation → code → test ✅ → commit. Ne touchent PAS le scoping par
chaîne (donc sans conflit avec le changement d'exclusivité P22). Le Lot G (ajouté après coup,
voir plus bas) déroge à l'esprit « finition légère » des lots A-F : c'est une brique
d'architecture transverse (contexte React global), pas une simple retouche d'écran.

- **Lot A — Programme (fiche + liste)** : « Attestation » → « Contrat » partout (label +
  champ + stockage) + bouton « Consulter le contrat » (ouvrir le fichier) ; supprimer le champ
  Thématique ; liste Programmes : afficher la durée moyenne (Σ durées épisodes ÷ nb épisodes) à
  la place de la colonne sous-genre ; fiche : la section Droits suit directement l'upload du
  contrat, supprimer la jauge, afficher clairement début / fin / passages restants (couleur ou
  placement soigné) ; filtre par épisode dans l'onglet Historique.
- **Lot B — Grille linéaire (UX)** : déprogrammer un bloc via un X rouge à droite du bloc (en
  plus de l'inspecteur).
- **Lot C — Plein écran / masquer panneaux** : grille type ET grille linéaire — bouton pour
  masquer la barre latérale (catalogue/palette) et élargir la grille.
- **Lot D — Accueil (dashboard)** : remplacer les barres CSS par de vrais graphes (camembert
  répartition par genre, barres/histogramme), écran plus convivial.
- **Lot E — Logos de chaînes** : afficher le logo de chaque chaîne dans le sélecteur (5 logos
  fournis) + aligner la baseline des deux logos (étoile + lockup).
- **Lot F — Contrats & droits** : densifier l'écran (trop de vide), meilleure mise en page du
  tableau de bord des droits.
- **Lot G — Système de notifications** (ajouté après l'intégration de la roadmap v2, reprend un
  point laissé en suspens au Lot B) : (1) toasts centrés réutilisables (succès/erreur/info) via
  un contexte global `NotificationProvider`/`useNotification()`, remplaçant les 3 bricolages
  `messageSucces` + `setTimeout` existants (FicheProgramme, FenetresDroitsPanel, EpisodesPanel)
  et le cas « aucune modification à enregistrer » (info) ; (2) garde-fou « modifications non
  enregistrées » — snapshot de la valeur initiale au chargement, comparaison à l'état courant,
  confirmation avant d'abandonner une édition (bouton retour/fermer, ou sélection d'un autre
  élément) sur les 6 formulaires à Enregistrer de l'app (FicheProgramme, FenetresDroitsPanel,
  EpisodesPanel, InspecteurBloc, PanneauBlocGrilleType, PanneauPublication) — pas de garde-fou
  sur la navigation Sidebar (hors périmètre, l'enregistrement de grille sera un bouton explicite
  en P23) ni de `beforeunload` navigateur ; (3) remplacement des 7 `window.confirm` (+ 2
  `window.alert`) existants par la modale de confirmation du même système.

> **En attente de clarification** : « Type de bloc == Genre (grille linéaire) : corriger la
> logique » — sens à préciser avec l'utilisateur. Rattachement probable : P21 ou P22.

### P22–P30 — Nouvelles fonctionnalités (lourdes), brique par brique

> **Principe — Exclusivité (P22)** : programme partagé toutes chaînes par défaut, `chaine_id`
> nullable ; exclusif = `chaine_id` renseigné. À traiter avant les autres features car ça touche
> tout le scoping.

- **P22 — Modèle d'exclusivité (FONDATION, en premier)** : un programme est partagé par toutes
  les chaînes par défaut ; seuls les programmes marqués exclusifs sont liés à une chaîne.
  `programme.chaine_id` devient **nullable** : NULL = partagé toutes chaînes, renseigné =
  exclusif à cette chaîne. Catalogue d'une chaîne = programmes partagés (chaine_id NULL) +
  exclusifs de cette chaîne. Adapter : contrainte d'unicité, filtrage catalogue, création (case
  « Exclusif à cette chaîne » qui fixe chaine_id si cochée). ⚠️ Répercussions sur TOUT le
  scoping — audit de tous les usages de chaine_id avant de coder.
- **P23 — Multi-documents : Grille linéaire** : enregistrer des grilles nommées, les rouvrir,
  plusieurs onglets ouverts, copier/coller un ou plusieurs programmes entre grilles.
- **P24 — Multi-documents : Plan média** (même mécanique que P23 : enregistrer / renommer /
  supprimer, onglets, copier/coller BA & spots).
- **P25 — Grille : vues mois & an + zoom** : vues mensuelle/annuelle ; zoom pour programmer à
  la minute, précision via config prédéfinie.
- **P26 — Exports & imports** : export de la grille en Excel/Word/PDF ; import d'un plan média
  Excel (format fourni par l'utilisateur).
- **P26bis — Réorganisation Plan média** : onglets Composition (éditeur manuel, par défaut :
  tableau des éléments placés, bibliothèque de spots, insertion manuelle, export Excel) /
  Génération auto (secondaire : campagnes, règles d'habillage, aperçu propose→confirme —
  moteur déplacé sans changement de logique) ; remplace l'indicateur « couverture plan média »
  du dashboard (M9) par un compteur d'éléments placés dans le plan média live de la chaîne.
- **P27 — Rediffusion avancée + vecteur TNT⇄SAT** : rediffusion — cocher tous les jours d'un
  coup, définir un pas, sauter des jours ; vecteur — une exception TNT vide le créneau SAT et
  prévient clairement l'utilisateur (et inversement).
- **P28 — Grille type : création & saisonnalité** : créer une grille type de zéro puis
  l'enregistrer ; 3 grilles types saisonnières (Ramadan, rentrée, été) qui basculent
  automatiquement selon la période de l'année.
- **P29 — Notifications** ✅ LIVRÉ : centre de notifications persistant (cloche TopBar, lu/non
  lu par chaîne) — alerte au 1er ajout d'un programme (fan-out sur les 5 chaînes si partagé) et
  signale les fenêtres de droits proches de la fermeture (RG-04, réconcilié au changement de
  chaîne, jamais dupliqué). *Test : créer un programme → notification(s) ; fenêtre de droits
  proche → alerte réconciliée une seule fois ; clic → fiche + marqué lu.*
- **P30 — Rollback étendu** ✅ LIVRÉ : plan média avait déjà son rollback complet (P24) ; ajout
  du dernier écran manquant, la grille non-linéaire — deux piles indépendantes
  (Réseaux/VOD, chacune scopée chaîne+écran, pas de multi-document). *Test : Ctrl+Z/Ctrl+Y sur
  chaque onglet, les deux piles restent indépendantes l'une de l'autre.*
- **P31 — Passe de design UI/UX** ✅ LIVRÉ (hors feuille de route initiale, ajoutée en session) :
  polish pur, aucune logique/donnée changée — tokens d'accent orange/succès vert (distincts des
  couleurs genre/chaîne), transitions cohérentes, bouton Export unifié (Excel/Word/PDF) sur tous
  les écrans qui exportent, désencombrement des barres d'outils les plus chargées. *Test :
  aucune régression fonctionnelle, couleurs genre/chaîne inchangées, exports identiques.*
- **P35 — Système de rôles multi-utilisateurs (PoC)** ✅ LIVRÉ (hors feuille de route initiale) :
  simulation du workflow métier pour la démo — sélecteur d'utilisateur au login (8 rôles :
  Super Admin, Admin de chaîne, Programmateur, Acquisitions, Documentaliste, Rédacteur,
  Contrôle PAD, Marketing), navigation filtrée par rôle (point unique `src/lib/roles.js`),
  verrou de chaîne pour l'Admin de chaîne, 3 écrans neufs (Bible + OCR simulé, Synopsis FR/AR
  simulé, Contrôle PAD), demande de validation PAD depuis le panneau Épisodes, notification
  Marketing à la publication non-linéaire. **Pas de vraie sécurité** : aucun mot de passe, les
  RLS restent ouvertes (`anon_all_*`). La vraie authentification Supabase (mot de passe, RLS
  par rôle via `auth.uid()`, ciblage des notifications par utilisateur) est **reportée à la
  production**, hors périmètre du PoC. Migrations : `migration-p35.sql` → `p36` → `p37`.
  *Test : se connecter comme chaque utilisateur de démo, vérifier la Sidebar et les redirections ;
  demande PAD → traitement par le Contrôle PAD → épisode passe PAD ; publication → PUBLIÉ →
  notification dédiée dans la cloche.*
- **P36 — Espaces spécialisés par rôle (Gestion des droits & du stock, Contrôle PAD)** ✅ LIVRÉ
  (hors feuille de route) : application du principe « chaque rôle → écrans et données taillés
  pour sa spécialité ». Nouveau rôle `GESTION_DROITS_STOCK` (Oumnia) avec un **tableau de bord
  dédié** (KPI droits / stock / circuit PAD, réutilise `bilans.js`) et un écran **Suivi PAD**
  (initialiser une demande, relancer le Contrôle PAD, historique des décisions — jamais la mise
  en PAD). L'**entité PAD** (`CONTROLE_PAD`) reçoit les demandes, voit **tout le catalogue**
  d'épisodes (filtre Tous / Non PAD / Demande, statut PAD, lien Bible PDF de revue) et fait la
  mise en PAD. Le **Programmateur** accède désormais à Grille linéaire/type, Auto-programmation,
  Plan média, Programmes, Conducteur et au tableau de bord ; il peut **initier** une demande PAD
  (case « PAD » désactivée pour lui, `peutMettreEnPad`) quand il veut programmer un épisode non
  PAD. **Notifications routées par rôle** (`notification.destinataire_role`) : `DEMANDE_PAD`
  → Contrôle PAD **et** Gestion des droits & du stock ; `RELANCE_PAD` → Contrôle PAD ;
  `DECISION_PAD` → Gestion des droits & du stock ; la cloche filtre sur le rôle (Super Admin
  voit tout). Migration : `migration-p40.sql`.
  *Test : Oumnia (Pilotage droits & stock + Suivi PAD) initialise puis relance une demande →
  Nabil (Contrôle PAD) la voit avec genre/durée/Bible, accepte → l'épisode passe PAD → Oumnia
  reçoit la décision dans sa cloche.*
- **P37 — Programmes exclusifs & demande de programmation inter-chaînes** ✅ LIVRÉ (hors
  feuille de route) : un titre exclusif à une chaîne est désormais **visible** par les autres
  (catalogue de la grille + liste Programmes, badgé « Exclusif — accès requis », non
  déplaçable, dépôt refusé) mais reste **non programmable** sans autorisation. Circuit :
  le **Programmateur** ouvre la fiche (raccourci du catalogue) → « Demander à bénéficier de ce
  programme » → l'**Administrateur de chaîne** demandeur **transmet** ou **rejette en interne**
  → l'**Administrateur de chaîne détenteur** **approuve** (la chaîne est ajoutée à
  `programme.chaines_autorisees`) ou **refuse** ; chaque étape notifie l'acteur suivant.
  Nouvel écran **Demandes de programmation** (Admin de chaîne + Super Admin). La **création /
  suppression** d'un programme est réservée à Acquisitions / Admin de chaîne / Super Admin
  (`peutGererCatalogue`) — un Programmateur n'en crée pas. Comptes de démo admin de chaîne
  seedés (`safae.admin` Al Aoula, `hamid.admin` Arryadia). Migration : `migration-p41.sql`.
  *Test : Younes/Arryadia demande « 45 minutes » (exclusif Al Aoula) → hamid.admin transmet →
  safae.admin approuve → le titre devient déplaçable pour Arryadia.*
- **P38 — Synopsis exporté en PDF (rôle Rédacteur)** ✅ LIVRÉ (hors feuille de route) : sur
  l'écran **Synopsis**, trois boutons **PDF français / PDF arabe / PDF bilingue** produisent
  le document à partir du texte courant (en-tête titre + genre + date, puis sections FR et/ou
  ملخص en RTL). L'arabe est rendu fidèlement via `html2canvas` (mise en page HTML capturée en
  image) — jsPDF en mode texte ne sait pas relier les lettres arabes. **Téléchargement seul**,
  rien n'est stocké. Les mêmes boutons apparaissent dans le panneau Bible de l'onglet
  Métadonnées quand un synopsis est enregistré (consultation par d'autres rôles). Pas de
  migration. **P38b** : export **FR / AR** seul (bilingue retiré) ; l'aperçu FR + AR est
  éditable via un bouton **Modifier / Enregistrer** (plus de zones de saisie permanentes ; la
  génération enregistre directement). *Test : salma.redac génère → aperçu → Modifier → corrige
  → Enregistrer → PDF FR / PDF AR ; l'arabe est lié et aligné à droite.*
- **P39 — Espace de suivi du Rédacteur** ✅ LIVRÉ (hors feuille de route) : deux sections en
  plus de Synopsis, réservées au **Rédacteur** (+ Super Admin). **Bibles & synopsis** : tableau
  de tous les programmes de la chaîne avec l'état bible déposée / OCR analysé / synopsis FR-AR,
  filtres (Tous / Avec bible / Sans bible / À rédiger / Traités), raccourci « Rédiger » qui
  ouvre l'écran Synopsis **présélectionné** sur le programme. **Tableau de bord rédaction** :
  KPI du seul périmètre synopsis (bibles déposées %, à rédiger + liste prioritaire, synopsis
  rédigés %, détail FR seul / AR seul / complets). Calcul pur `suiviRedaction.js`. Pas de
  migration. *Test : salma.redac voit les deux sections ; « Rédiger » depuis le tableau ou la
  liste ouvre le bon programme dans Synopsis.*

## 9. Extension hors cahier — Grille non-linéaire

Le cahier STM Next est centré **linéaire**. La **grille non-linéaire par plateforme** (FB/IG/TikTok/VOD-Forja) voulue lors du 2ᵉ comité directeur est **conservée** comme module d'extension Snomark (P20), un même Titre pouvant être diffusé en linéaire (plan) et en non-linéaire (plateformes).

## 10. Discipline & priorités

Une phase à la fois ; **Essentiel d'abord** dans chaque module ; le cahier fait foi pour le détail des EXG ; règle d'approbation (ambiguïté → stop) ; un commit par phase.
