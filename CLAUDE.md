# CLAUDE.md — Contexte projet pour l'agent

Tu construis **Snomark**, un **PoC de STM « nouvelle génération »** pour la SNRT : reproduire le cœur de l'actuel STM (voir captures de la présentation) et ajouter la gestion **non-linéaire par plateforme**, sur **Supabase**, avec un **GUI soigné aux couleurs SNRT** (logo étoile conservé).

Le plan phasé est dans **`PLAN.md`**. Suis-le **phase par phase** et **arrête-toi au test ✅** de chaque phase.

## Principe métier central
- Un seul **« Programme TV »** peut être diffusé **en linéaire** (créneau dans la grille hebdo) **ET/OU en non-linéaire** (contenus par plateforme : post Facebook, reel Instagram, vidéo TikTok, VOD/Forja). Même programme, deux modes.
- **Deux grilles = deux calendriers hebdomadaires.** La non-linéaire est datée par **date de publication** et organisée par **plateforme**.
- **Notification = PARQUÉE** (après correction des problèmes STM). Ne pas la construire maintenant. Le modèle Offre/Notification reste dans le code, inutilisé.

## Règles de travail
- **Une phase à la fois.** Ne code jamais la phase N+1 tant que le test de la phase N n'est pas validé.
- **Règle d'approbation.** Avant de coder une phase : présente son plan (tâches + fichiers + test) et **liste toute ambiguïté**. S'il existe un point non tranché, **arrête-toi et demande** — ne comble jamais par une hypothèse. N'écris du code qu'après un « go » explicite. S'il n'y a aucune ambiguïté, dis-le.
- À la fin d'une phase : indique la commande de test, committe `Phase N — <titre>`, et arrête-toi.
- Corrections ciblées, pas de refactor large non demandé.

## Contraintes d'architecture
- **Données = Supabase** (`@supabase/supabase-js`). Clés via **`.env`** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — **jamais en dur**, `.env` dans `.gitignore`. L'utilisateur a déjà un projet Supabase (URL + clé).
- **Couche d'accès aux données métier = `src/lib/db.js`** (CRUD par entité). Les écrans ne parlent jamais à Supabase en direct — tout passe par `db.js`.
- **`storage.js` conservé** pour la **session/login** uniquement (localStorage + fallback mémoire). Aucun `localStorage` direct hors `storage.js`.
- **Réutiliser l'existant** : `stm-import.js` (import+nettoyage xlsx) alimente désormais Supabase ; `model.js` (typedef `Programme`) étendu. Ne pas réécrire ce qui marche.
- **Ne pas dupliquer les référentiels** : un contenu non-linéaire est **toujours rattaché** à un `programme` existant.

## GUI / UX
- **Soigné et professionnel**, calqué sur l'actuel STM mais plus moderne : **sidebar sombre** (Accueil, Programmes, Pré-Grille, Grille, Grille non-linéaire, Conducteur, Contrats, Administration), top bar avec **logo SNRT** + utilisateur.
- **Couleurs SNRT** ; blocs de grille **colorés** (par genre en linéaire, par plateforme en non-linéaire).
- **Login simple** mais plus abouti que le sélecteur de rôle actuel.
- FR pour l'instant (structure prête pour l'AR).

## Conventions
- Code et commentaires en **français**.
- Un commit par phase : `Phase N — <titre>`.
- Nommage clair (`Programme`, `Segment`, `diffusion_lineaire`, `diffusion_non_lineaire`, `plateforme`…).

## Definition of Done
Voir `PLAN.md` §7. Cœur d'abord (P5–P9), extension ensuite (P10–P12), finition (P13). Notification parquée.
