# CLAUDE.md — Contexte projet pour l'agent

Tu construis un **PoC** : une interface rattachée à STM qui permet à la **Programmation** de notifier le **service marketing (Département Portail / Digital)** de l'arrivée d'une **offre non linéaire** (VOD / replay / contenu exclusif), afin qu'il **planifie ses ressources** pour les posts réseaux sociaux. Chaque notification est **trackée** : `ENVOYEE → VUE → PUBLIEE` (+ `ANNULEE`).

Le plan détaillé et phasé est dans **`PLAN.md`**. Suis-le **phase par phase** et **arrête-toi au test de validation de chaque phase**.

## Règles de travail
- **Une phase à la fois.** Ne code jamais la phase N+1 tant que le test de la phase N n'est pas validé.
- À la fin d'une phase, **indique explicitement comment lancer le test ✅** correspondant, puis attends.
- Corrections **ciblées** : pas de refactor large non demandé.
- Pas de dépendances superflues. Stack imposée : **Vite + React + Tailwind**, `xlsx` (SheetJS), `lucide-react`, `uuid`.

## Contraintes d'architecture
- **Ne pas dupliquer le référentiel STM.** Une offre non linéaire se **rattache** à un `programme_id` existant (importé du xlsx). Option secondaire « hors programme » seulement.
- **Persistance derrière une seule interface** (`src/lib/storage.js`) pour être remplaçable plus tard par une vraie API STM. Le reste du code ne parle jamais au stockage directement.
- **Import xlsx = mock STM** (lecture seule). Ne jamais « écrire » dans STM.
- **Nettoyage obligatoire à l'import** (voir §6 du PLAN) : exclure/mettre de côté les lignes incohérentes (fin < début, « fin d'émission », doublons, champs vides). **Ne jamais notifier une donnée incohérente.**
- **Notification après validation** : pas d'étape d'approbation dans l'app.

## Périmètre (à respecter strictement)
- **Un seul flux** de bout en bout. **FR** uniquement (mais garder la structure prête pour l'AR).
- **Hors périmètre** : cœur de STM, fabrication du contenu digital (post-prod, coulisses), multi-plateformes réelles, bilingue.

## Conventions
- Code et commentaires en **français**.
- Modèle de données : respecter les types définis dans `PLAN.md` §4.
- Commits : un par phase, message `Phase N — <titre>`.
- Nommage clair (`Offre`, `Notification`, `Programme`, `statut`, `date_mise_en_ligne`…).

## Rôles
- `PROGRAMMATION` : importe le référentiel, crée l'offre, notifie, annule.
- `DIGITAL` : reçoit dans l'inbox, passe en VUE, marque PUBLIEE.
- Les deux : accèdent au Dashboard de suivi.

## Definition of Done
Voir `PLAN.md` §9. Le PoC doit démontrer, de bout en bout : import → notifier → vue → publié / annuler → dashboard (avec délai paramétrable et fenêtre « à publier bientôt »).
