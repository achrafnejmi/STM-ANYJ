# CLAUDE.md — Contexte projet pour l'agent

Tu construis **Snomark**, PoC d'une **refonte complète de STM (« STM Next »)** pour la SNRT,
alignée sur un cahier des charges. GUI très soignée, couleurs/logo SNRT.

Le plan phasé est dans **`PLAN.md`**. Suis-le **phase par phase**, **arrête-toi au test ✅**.

## Références (autorité décroissante)
1. `design-reference/Cahier_des_charges_STM_Next.docx` — LE contrat : modules M0–M9 (+M10),
   exigences EXG-Mx-nn (priorité Essentiel/Important/Souhaitable), règles RG, modèle de données.
   En cas de doute, il fait foi. Vise les EXG **Essentiel d'abord**.
2. `design-reference/stm-next-mockup.html` — résultat visuel voulu (cible GUI/UX).
3. `design-reference/stm-existant/` — ancien STM + logos SNRT.

## Principes directeurs (font foi en cas d'ambiguïté)
1. La grille est le produit (tout depuis le Plan de diffusion, sans changement de contexte).
2. Le contrôle intervient au moment du geste (hors droits = non proposé, dépôt refusé, motif énoncé).
3. Le système propose, l'utilisateur décide (moteurs auto : action explicite, rapport, annulable).
4. Une saisie unique, des exceptions déclarées (grille unique TNT/Sat ; répétition).
5. Pilotage par exception (centre d'anomalies).

## Conventions (obligatoires)
- Journée d'antenne **06:00 → 06:00**. Couleur = **genre** uniquement. Signalisation rouge/ambre/vert.
- Horaires en chasse fixe `HH:MM`. Annulation/rétablissement sur toute écriture.
- Interface FR ; métadonnées titres FR/AR/EN (AR en RTL).

## Architecture (réutiliser l'existant, ne rien jeter)
- **Supabase** via `db.js` (seul accès données métier) ; clés en `.env` (jamais en dur).
- Noms de tables physiques conservés → **mapping** : `programme`=Titre, `segment`=Épisode,
  `diffusion_lineaire`=Transmission. Chaque phase = une **migration SQL** (`migration-*.sql`,
  ne jamais rejouer `schema.sql`).
- `storage.js` = session. Offre/Notification **parqués**. Grille non-linéaire = extension (P20).
- Scoping **par chaîne** (M1) : catalogue commun, éligibilité par chaîne active.

## Règles de travail
- **Une phase à la fois** ; ne code jamais N+1 avant le test ✅ de N.
- **Règle d'approbation** : avant de coder, présente le plan + **liste les ambiguïtés** et
  arrête-toi ; ne comble jamais par une hypothèse ; code seulement après « go ».
- À la fin : commande de test, commit `Phase N — <titre>`, stop. Corrections ciblées.
- Code et commentaires en **français**.

## Definition of Done
Voir `PLAN.md`. Objectif : couvrir M0–M9 (+M10) brique par brique, Essentiel d'abord, avec la
qualité GUI/UX du mockup.
