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

Acquis : **P0–P8**. Nouvelles briques :

- **P9 — M1 Espace de travail par chaîne** : sélecteur de chaîne dans la coquille (5 chaînes, code, couleur, ligne éditoriale) ; scoping des données par chaîne ; bande de couleur chaîne. *Test : changer de chaîne recharge le contexte, sans perte.*
- **P10 — M2 (1/3) Plan de diffusion : catalogue glissable + drag-drop + aperçu historique** ⭐ (demande en cours). Panneau Catalogue à gauche (recherche, genre, vignette, durée, épisodes) ; **drag-drop d'un titre sur la grille** (heure calculée depuis la position, arrondi 5 min) ; **aperçu historique de diffusion au clic** sur un titre. *Drag autorisé pour tout programme pour l'instant (le garde-fou PAD/droits arrive avec M6).* *Test : glisser un titre → bloc créé au bon horaire ; clic titre → aperçu historique.*
- **P11 — M2 (2/3) Inspecteur de bloc** : onglets Bloc (heure début/fin, durée, déprogrammation) / Répéter (jours, incrément épisodes) / Vecteur (TNT/Sat, exception). *Test : éditer/répéter/déprogrammer un bloc.*
- **P12 — M2 (3/3) + M8 Anomalies** : trous d'antenne, chevauchements, contrôle des droits au geste (quand dispo), centre d'anomalies + compteur sur le rail. *Test : chevauchement/trou détectés et listés.*
- **P13 — M3 Grille type** : blocs nommés par chaîne, affichage en fond du plan. *Test : définir un bloc, le voir en fond.*
- **P14 — M6 Catalogue et fiche titre (complet)** : historique complet, frise des droits, épisodes, métadonnées FR/AR/EN, statut PAD → **active le garde-fou PAD/droits** du drag (M2). *Test : fiche complète, historique intégral, droits.*
- **P15 — M4 Auto-programmation** : moteur déterministe + réservoir + règles + rapport, annulable. *Test : générer une journée, rapport des blocs vides motivés.*
- **P16 — M5 Plan média** : campagnes + remplissage inter-programmes + couverture. *Test : campagne → bandes-annonces placées.*
- **P17 — M7 Conducteur d'antenne** : déroulé minuté, timecodes cumulés, insertion en place. *Test : conducteur d'un jour, écarts affichés.*
- **P18 — M9 Stock et bilans** : indicateurs, répartition par genre, fins de droits. *Test : bilan cohérent, export.*
- **P19 — M0 finitions + M10 recherche globale** : annuler/rétablir global, notifications motivées, sélecteur de vecteur, recherche par raccourci. *Test : undo/redo, recherche épisode → titre.*
- **P20 — Extension : Grille non-linéaire (par plateforme)** — hors cahier, conservée (voir §9).
- **P21 — Finition UI/UX + exports (PDF/Excel/Word) + déploiement.**

## 9. Extension hors cahier — Grille non-linéaire

Le cahier STM Next est centré **linéaire**. La **grille non-linéaire par plateforme** (FB/IG/TikTok/VOD-Forja) voulue lors du 2ᵉ comité directeur est **conservée** comme module d'extension Snomark (P20), un même Titre pouvant être diffusé en linéaire (plan) et en non-linéaire (plateformes).

## 10. Discipline & priorités

Une phase à la fois ; **Essentiel d'abord** dans chaque module ; le cahier fait foi pour le détail des EXG ; règle d'approbation (ambiguïté → stop) ; un commit par phase.
