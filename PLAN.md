# PLAN — PoC « Notification des offres non linéaires : STM → Digital »

> Plan de construction phasé, prêt à piloter avec **Claude Code**.
> Règle d'or : **une phase = un lot de tâches + un test de validation**. On ne passe à la phase suivante que si le test passe.

---

## 1. Contexte & objectif

Une interface rattachée à STM permettant à la **Programmation (DMP)** de notifier le **service marketing (Département Portail / Digital)** qu'une **offre non linéaire** (VOD / replay / contenu exclusif) arrive, **après validation** du programme, afin que le Digital **planifie ses ressources** pour les posts réseaux sociaux. Le cycle de chaque notification est **tracké** : `envoyée → vue → publiée` (+ `annulée`).

**Ce n'est PAS** : une refonte de STM, une duplication du référentiel, ni la fabrication du contenu digital.

## 2. Décisions figées (validées)

- **Non-linéaire** = offre de contenu digital rattachée à un programme, avec une **date de mise en ligne** (pas d'heure d'antenne).
- **Rattachement** = à un **programme STM existant via son `programme_id`** (pas de création de zéro). Option secondaire « hors programme » pour une campagne social pure.
- **Accès données STM** = **import de fichiers xlsx** (mock STM) — les grilles réelles fournies.
- **Notification** = déclenchée **après validation**, pas d'étape d'approbation dans l'outil.
- **Canal** = **inbox intégrée** (vue marketing dans l'app).
- **Rôles** = **login simple** à 2 rôles : `PROGRAMMATION`, `DIGITAL`.
- **Champs** = FR pour l'instant (structure prête pour l'AR). Voir §4.
- **Délai d'avance** = **paramétrable** par offre.
- **Annulation** = gérée, se répercute dans l'inbox.
- **Langue UI** = FR.

## 3. Stack & livrable

- **App web autonome** : Vite + React + Tailwind. Aucun serveur à héberger.
- **Persistance** : couche `storage` abstraite (clé-valeur) → survit aux rechargements. Isolée derrière une interface pour être remplaçable par une vraie API STM en phase 2.
- **Import xlsx** : SheetJS (`xlsx`).
- **Icônes** : `lucide-react`.
- **Déployable** : `npm run build` → dossier statique déployable sur n'importe quel hébergeur (Netlify, Vercel, GitHub Pages, S3…).

## 4. Modèle de données

```ts
// Programme importé depuis STM (lecture seule, via import xlsx)
type Programme = {
  programme_id: string;      // clé de rattachement
  titre: string;             // FR
  genre: string;             // FR
  chaine: string;            // ex. "Al Aoula", "Tamazight"
  date?: string;             // ISO, si issu de la grille
  heure_debut?: string;
  heure_fin?: string;
  _anomalie?: string | null; // rempli par le nettoyage (voir §6)
};

// Offre non linéaire (la couche digitale ajoutée)
type Offre = {
  id: string;                    // uuid
  programme_id: string | null;   // null si "hors programme"
  titre: string;                 // repris de STM ou saisi
  genre: string;
  chaine: string;
  description: string;
  type_offre: "VOD" | "REPLAY" | "CONTENU_EXCLUSIF";
  supports: string[];            // ["Facebook","Instagram","YouTube","Site"...]
  date_mise_en_ligne: string;    // ISO datetime
  fenetre_debut?: string;
  fenetre_fin?: string;
  visuel?: { kind: "url" | "upload"; value: string }; // value = URL ou base64
  lien?: string;                 // deep-link VOD / page
  delai_avance: { valeur: number; unite: "HEURES" | "JOURS" }; // paramétrable
  cree_par: string;              // user PROGRAMMATION
  cree_le: string;               // ISO
};

// Notification (le hand-off tracké)
type Notification = {
  id: string;                 // uuid
  offre_id: string;
  statut: "ENVOYEE" | "VUE" | "PUBLIEE" | "ANNULEE";
  envoyee_le: string;
  vue_le?: string;
  publiee_le?: string;
  annulee_le?: string;
  historique: { statut: string; le: string; par: string }[];
};
```

## 5. Écrans

1. **Login** — choix du rôle (PROGRAMMATION / DIGITAL) + identifiant simple.
2. **Émetteur (PROGRAMMATION)** — import xlsx STM · recherche/sélection programme · formulaire couche digitale · aperçu du payload · bouton **« Notifier le Digital »** · liste de ses notifications avec **Annuler**.
3. **Inbox (DIGITAL)** — liste des notifications reçues · ouverture d'un détail (passe en **VUE**) · bouton **« Marquer publié »** · notifications **annulées** clairement signalées.
4. **Dashboard (les deux rôles)** — tableau de toutes les notifications · compteurs par statut · filtres (statut, type, chaîne, date) · surbrillance **« à publier bientôt »** (dans la fenêtre `delai_avance`).

## 6. Règles de nettoyage du mock STM (à appliquer à l'import)

Marquer `_anomalie` et **exclure de la sélection** (mais lister à part) les lignes où :
- `heure_fin < heure_debut` (fin avant début) ;
- le titre est un marqueur de **fin d'émission** (ex. `TIGIRA N USSIFD`, « fin d'émission ») ;
- **doublon** de titre unitaire consécutif sur la même case ;
- champs clés vides (`titre` ou `date`/`heure` absents).

But : **ne jamais notifier une donnée incohérente** au marketing.

---

## 7. Phases (chacune : tâches → test de validation)

### Phase 0 — Scaffold
**Tâches**
- Initialiser Vite + React, Tailwind, deps (`xlsx`, `lucide-react`, `uuid`).
- Arborescence : `src/lib` (storage, stm-import, model), `src/screens`, `src/components`, `src/App.jsx`.
- Shell + navigation vide selon rôle (placeholder).

**Test** ✅ `npm run dev` démarre, le shell s'affiche sans erreur console.

### Phase 1 — Mock STM (import xlsx + nettoyage)
**Tâches**
- `src/lib/stm-import.js` : parser `grille_*.xlsx` et `PM_*.xlsx` → `Programme[]` normalisé (gérer les dates série Excel, les heures en texte `"12.00"`).
- Appliquer les règles §6 → `_anomalie`.
- Écran d'import : uploader un xlsx, prévisualiser programmes **valides** vs **anomalies**.

**Test** ✅ Importer les 2 fichiers fournis → liste de programmes propres + section « anomalies » listant au moins la ligne `fin < début` et une ligne « fin d'émission ».

### Phase 2 — Modèle + persistance
**Tâches**
- `src/lib/storage.js` : `get/set/list/remove` (clé-valeur), une seule interface (implémentation locale, remplaçable plus tard par API).
- Types/helpers du §4 ; création d'`Offre` et `Notification`.

**Test** ✅ Créer une offre + une notification, recharger la page → elles persistent (round-trip OK).

### Phase 3 — Login simple (2 rôles)
**Tâches**
- Écran login (rôle + identifiant), stockage de la session.
- Garde de navigation : PROGRAMMATION ↔ Émetteur ; DIGITAL ↔ Inbox ; Dashboard partagé.

**Test** ✅ Se connecter en PROGRAMMATION → voit Émetteur ; en DIGITAL → voit Inbox ; pas de fuite d'écran entre rôles.

### Phase 4 — Écran Émetteur (créer + notifier)
**Tâches**
- Recherche/sélection d'un programme importé (par `programme_id` ou titre) **ou** bascule « hors programme ».
- Formulaire couche digitale (tous les champs `Offre`), **upload image (base64) OU URL**.
- Validation des champs requis + **aperçu du payload**.
- « Notifier le Digital » → crée `Offre` + `Notification{statut:ENVOYEE}`.

**Test** ✅ Créer une notification de bout en bout → elle apparaît dans le storage et dans « mes notifications » avec statut ENVOYEE.

### Phase 5 — Inbox Marketing (Digital)
**Tâches**
- Liste des notifications reçues (hors ANNULEE en tête, ANNULEE signalées).
- Ouverture détail → passe **ENVOYEE → VUE** (horodaté).
- Bouton **« Marquer publié »** → **VUE → PUBLIEE**.

**Test** ✅ En DIGITAL : ouvrir une notif (statut passe VUE), la marquer publiée (statut PUBLIEE), l'historique enregistre les deux transitions.

### Phase 6 — Annulation (émetteur)
**Tâches**
- Bouton **Annuler** côté Émetteur → **statut ANNULEE** (horodaté), quel que soit l'état précédent (sauf déjà PUBLIEE : au choix, bloquer ou marquer « annulée après publication »).
- Répercussion immédiate dans l'Inbox.

**Test** ✅ Annuler une notification ENVOYEE → elle apparaît ANNULEE dans l'Inbox du Digital.

### Phase 7 — Dashboard tracking
**Tâches**
- Tableau global : offre, chaîne, type, date mise en ligne, statut.
- Compteurs par statut (ENVOYEE / VUE / PUBLIEE / ANNULEE).
- Filtres : statut, type, chaîne, plage de dates.

**Test** ✅ Les compteurs correspondent aux données ; filtrer par statut « VUE » n'affiche que les VUE.

### Phase 8 — Délai paramétrable + fenêtre « à publier bientôt »
**Tâches**
- Prise en compte de `delai_avance` par offre.
- Dashboard : surbrillance des offres dont `date_mise_en_ligne` tombe **dans** la fenêtre (`maintenant …  date_mise_en_ligne - delai_avance` dépassé).
- Tri par urgence.

**Test** ✅ Une offre avec mise en ligne proche (dans la fenêtre du délai) est mise en évidence « à publier bientôt » ; une offre lointaine ne l'est pas.

### Phase 9 — Finition + déploiement
**Tâches**
- Libellés FR complets, états vides, responsive, messages d'erreur.
- `npm run build` ; instructions de déploiement statique.
- README court (comment lancer / importer / démo).

**Test** ✅ Le build de prod tourne ; le parcours complet (import → notifier → vue → publié / annuler → dashboard) est démontrable de bout en bout.

---

## 8. Piloter avec Claude Code

1. Mettre `PLAN.md` + `CLAUDE.md` à la racine du repo.
2. Lancer `claude` dans le dossier.
3. Prompt de départ :
   > « Lis `CLAUDE.md` et `PLAN.md`. Implémente **uniquement la Phase 0**, puis arrête-toi et indique comment lancer le test de validation de la phase. »
4. Après chaque phase : vérifier le **Test ✅**, committer (`git commit -m "Phase N — <titre>"`), puis :
   > « Test de la Phase N validé. Passe à la **Phase N+1**, même règle : t'arrêter au test. »
5. En cas de bug : donner le message d'erreur, demander un correctif **ciblé** (pas de refactor large).

**Discipline** : une phase à la fois, un commit par phase, on ne code pas la phase suivante tant que le test n'est pas vert.

## 9. Definition of Done (PoC)

- [ ] Import des 2 xlsx réels avec nettoyage des anomalies.
- [ ] Création d'une offre non linéaire rattachée à un `programme_id`.
- [ ] Notification envoyée, **vue**, **publiée**, et **annulable** (répercutée).
- [ ] Dashboard avec compteurs, filtres et fenêtre « à publier bientôt » (délai paramétrable).
- [ ] 2 rôles avec login simple, UI FR.
- [ ] Build statique déployable / partageable.

## 10. Jeu de test

- `grille_du_20_au_26_juillet_2026.xlsx` → programmes chaîne Tamazight (contient des anomalies utiles à démontrer).
- `PM_MERCREDI_05_AOUT_2026.xlsx` → plan média chaîne Al Aoula.

## 11. Après le PoC (hors périmètre, pour mémoire)

- Remplacer la persistance locale + import xlsx par l'**API / BD STM** réelle (quand l'accès sera tranché).
- Bilingue **AR/FR** (les champs sont déjà prévus).
- Branchement à la **plateforme réelle** du marketing (au lieu de l'inbox interne).
- Idempotence + gestion fine des **mises à jour de grille** (RG8).
