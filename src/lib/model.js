// Types partagés (§4 PLAN.md). Offre/Notification : ajoutés en Phase 2.

/**
 * @typedef {Object} Programme
 * @property {string} programme_id - clé de rattachement, synthétisée à l'import (slug(titre)+date+heure_debut)
 * @property {string} titre
 * @property {string} genre - vide à l'import (pas de source fiable dans la grille), complété manuellement plus tard
 * @property {string} chaine - saisie par l'utilisateur à l'import (absente du fichier grille)
 * @property {string} [date] - ISO (YYYY-MM-DD)
 * @property {string} [heure_debut] - "HH:MM"
 * @property {string} [heure_fin] - "HH:MM"
 * @property {string|null} [_anomalie] - raison d'exclusion, rempli par le nettoyage à l'import (§6 PLAN.md)
 */

export {};
