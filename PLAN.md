# PLAN — Snomark : STM nouvelle génération (linéaire + non-linéaire)

> Plan phasé, piloté avec Claude Code.
> Règle d'or : **une phase = tâches + test ✅** ; on ne code la phase N+1 qu'après validation de N.
> Avant de coder une phase : présenter le plan + **lister les ambiguïtés** et s'arrêter (règle d'approbation).

---

## 1. Produit

**Snomark = un STM « nouvelle génération » (PoC).** Il reproduit le cœur de l'actuel STM (d'après les captures de la présentation SNRT) et ajoute la gestion **non-linéaire par plateforme**. Backend **Supabase**. GUI **soigné, aux couleurs SNRT**, logo étoile conservé.

**Principe métier central :** un seul **« Programme TV »** peut être diffusé **en linéaire** (créneau dans la grille hebdomadaire) **et/ou en non-linéaire** (contenus par plateforme : post Facebook, reel Instagram, vidéo TikTok, VOD/Forja). C'est **le même programme, deux modes de diffusion**, chacun dans sa grille.

**Les deux grilles sont des calendriers hebdomadaires.** La grille non-linéaire est datée par **date de publication** et organisée par **plateforme**.

**Notification = mise de côté** (à traiter après correction des problèmes de STM). Le modèle Offre/Notification est **conservé mais parqué**.

## 2. Ce qui est réutilisé (NE PAS perdre)

- **Scaffold** Vite + React + Tailwind (P0).
- **Import + nettoyage xlsx** (`stm-import.js`, P1) → sert désormais à **peupler la grille linéaire** dans Supabase.
- **Couche d'accès isolée** (`storage.js`, P2) → conservée pour la **session/login** ; l'accès aux **données métier** passe désormais par une nouvelle couche **Supabase** (`src/lib/db.js`).
- **`model.js`** : typedef `Programme` réutilisé et étendu. Offre/Notification + helpers de clé = **parqués** (non supprimés).
- **Login** (P3) → remplacé par un login simple par nom (sans rôle), rendu plus soigné (P6). Notion de rôle abandonnée pour ce PoC.

## 3. Stack

- **Front** : Vite + React + Tailwind ; icônes `lucide-react`.
- **Données : Supabase** (Postgres + `@supabase/supabase-js`). Clés via **variables d'environnement** (`.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — **jamais en dur**, `.env` dans `.gitignore`.
- **Import xlsx** : SheetJS (conservé).
- **Déploiement** : build statique + Supabase en ligne.

## 4. Modèle de données (Supabase)

**Cœur (P5) :**

- `programme` : id (uuid), titre, titre_ar, genre, sous_genre, thematique, description, date_production, code, nombre_segments, auteur, exclusivite (bool), chaine, cree_par, cree_le.
- `segment` : id, programme_id (fk), numero, titre, duree, date_production, code, description, pad (bool), derniere_diffusion, nombre_diffusions.
- `diffusion_lineaire` (créneau grille linéaire) : id, programme_id (fk), chaine, date, heure_debut, heure_fin, genre, titre_cache.
- `diffusion_non_lineaire` (contenu plateforme) : id, programme_id (fk), plateforme (`FACEBOOK|INSTAGRAM|TIKTOK|VOD|FORJA`), type_contenu (`POST|REEL|VIDEO|VOD`), date_publication, heure_publication, titre, description, lien, visuel, statut, cree_par, cree_le.

**Extension :**

- `pre_grille` (P10) : id, chaine, jour/case_horaire, heure_debut, heure_fin, genre (sans titre).
- `contrat` (P12) : id, programme_id, numero, type, contractant, represente_par, approuve_par, date_livraison, lieu_livraison, delai_execution, fichier.
- `conducteur` (P11) : **vue générée** d'une journée de `diffusion_lineaire` (pas forcément une table).

## 5. Écrans (calqués sur STM, en plus soigné)

- **Coquille** : sidebar sombre (Accueil, Programmes, Pré-Grille, Grille, Grille non-linéaire, Conducteur, Contrats, Administration) + top bar avec **logo SNRT** et utilisateur ; **login soigné**.
- **Programmes** : fiche programme (formulaire) + liste des segments (onglets Infos / Supports / Événements).
- **Grille linéaire** : calendrier hebdomadaire, blocs **colorés par genre**, navigation Semaine/Jour.
- **Grille non-linéaire** : calendrier hebdomadaire par **date de publication**, blocs par **plateforme** (couleur + filtre FB/IG/TikTok/VOD/Forja).
- **Pré-grille / Conducteur / Contrats** (extension).

## 6. Feuille de route

**Acquis :** P0 scaffold · P1 import+nettoyage · P2 storage+model · P3 login · P4 (écran émetteur — partie **import réutilisée** ; formulaire offre/notify **parqué**).

### P5 — Fondation Supabase
- Client `@supabase/supabase-js` (clés via `.env`).
- Schéma SQL des tables **cœur** (§4) + script de migration.
- Couche `src/lib/db.js` : accès CRUD par entité (programme, segment, diffusion_lineaire, diffusion_non_lineaire).
- **Rebrancher l'import** (`stm-import.js`) : les programmes valides + créneaux → insérés dans `programme` + `diffusion_lineaire`.
- **Test ✅** : importer la grille → les lignes apparaissent dans Supabase et sont relues par `db.js`.

### P6 — Coquille GUI SNRT (shell + nav + login)
- Layout : sidebar sombre + top bar logo SNRT + utilisateur ; thème couleurs SNRT.
- Login soigné par nom (sans rôle — abandonné pour ce PoC, branding), session via `storage.js`.
- **Test ✅** : nav complète rendue, branding SNRT, login → accès à la coquille, reload garde la session.

### P7 — Programmes (fiche + segments)
- CRUD `programme` (formulaire fiche) + `segment` (onglets), sur Supabase.
- **Test ✅** : créer/éditer/lister un programme + ses segments (persistés en base).

### P8 — Grille linéaire (calendrier hebdo)
- Vue calendrier semaine ; blocs = `diffusion_lineaire`, **couleur par genre** ; peuplée par l'import.
- Ajout/édition d'un créneau rattaché à un `programme`.
- **Test ✅** : après import, la grille affiche les programmes aux bons créneaux ; ajouter un créneau l'affiche.

### P9 — Grille non-linéaire (par plateforme)
- Vue calendrier semaine par **date de publication** ; blocs = `diffusion_non_lineaire`, **couleur/filtre par plateforme**.
- Ajouter un contenu (FB post / IG reel / TikTok video / VOD-Forja) **rattaché à un programme existant**.
- **Test ✅** : ajouter un post FB + un reel IG pour un programme à une date → apparaissent sur le calendrier non-linéaire ; le **même programme** peut figurer aussi dans la grille linéaire.

### P10 — Pré-grille (extension)
- Genres par case horaire, sans titres.
- **Test ✅** : saisir une pré-grille, la visualiser.

### P11 — Conducteur (extension)
- Vue tableau d'une journée générée depuis `diffusion_lineaire` (Table/Calendar).
- **Test ✅** : sélectionner une date → conducteur listé.

### P12 — Contrats (extension)
- Rattacher un contrat à un programme/segment (modal type STM).
- **Test ✅** : créer un contrat, le voir rattaché.

### P13 — Finition UI/UX + déploiement
- Polissage, responsive, thème SNRT complet, états vides, build + déploiement.
- **Test ✅** : parcours cœur démontrable de bout en bout (import → programmes → grille linéaire → grille non-linéaire).

### Parqué — Notification
- À reprendre après correction des problèmes STM. Modèle Offre/Notification conservé.

## 7. Definition of Done (PoC)

- [ ] Supabase branché (clés en `.env`), tables cœur créées.
- [ ] Import xlsx → peuple `programme` + `diffusion_lineaire`.
- [ ] Programmes : CRUD fiche + segments.
- [ ] Grille linéaire (calendrier, couleurs par genre).
- [ ] Grille non-linéaire (calendrier par date de publication, par plateforme).
- [ ] Un même Programme TV présent dans les deux grilles.
- [ ] GUI soigné, couleurs + logo SNRT, login simple.
- [ ] (Extension) pré-grille, conducteur, contrats.

## 8. Priorité

**Cœur d'abord (P5–P9)** = la valeur démo. **Extension ensuite (P10–P12)**. **Finition (P13)**. Notification parquée.
