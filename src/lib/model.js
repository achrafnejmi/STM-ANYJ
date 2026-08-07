// Types partagés et helpers de création (§4 PLAN.md). Fonctions pures :
// aucun accès à storage.js ici — l'appelant persiste via storage.set(cleOffre(id), offre).

import { v4 as uuidv4 } from 'uuid'

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

/**
 * @typedef {Object} Offre
 * @property {string} id - uuid
 * @property {string} programme_id - toujours rattaché à un programme de la grille (obligatoire)
 * @property {string} titre
 * @property {string} genre
 * @property {string} chaine
 * @property {string} description
 * @property {"VOD"|"REPLAY"|"CONTENU_EXCLUSIF"} type_offre
 * @property {string[]} supports
 * @property {string} date_mise_en_ligne - ISO datetime
 * @property {string} [fenetre_debut]
 * @property {string} [fenetre_fin]
 * @property {{kind: "url"|"upload", value: string}} [visuel]
 * @property {string} [lien]
 * @property {{valeur: number, unite: "MOIS"|"JOURS"}} delai_avance - minimum 2 mois, alerte si non respecté (Phase 4/8)
 * @property {string} cree_par
 * @property {string} cree_le - ISO
 */

/**
 * @typedef {Object} Notification
 * @property {string} id - uuid
 * @property {string} offre_id
 * @property {"ENVOYEE"|"VUE"|"PUBLIEE"|"ANNULEE"} statut
 * @property {string} envoyee_le - ISO
 * @property {string} [vue_le]
 * @property {string} [publiee_le]
 * @property {string} [annulee_le]
 * @property {{statut: string, le: string, par: string}[]} historique
 */

// Schéma de clés de stockage.
export const PREFIXE_OFFRE = 'offre:'
export const PREFIXE_NOTIFICATION = 'notification:'
export const cleOffre = (id) => `${PREFIXE_OFFRE}${id}`
export const cleNotification = (id) => `${PREFIXE_NOTIFICATION}${id}`

/** @returns {Offre} */
export function creerOffre({
  programme_id,
  titre,
  genre = '',
  chaine,
  description = '',
  type_offre,
  supports = [],
  date_mise_en_ligne,
  fenetre_debut,
  fenetre_fin,
  visuel,
  lien,
  delai_avance,
  cree_par,
}) {
  if (!programme_id) {
    throw new Error('programme_id est obligatoire : toute offre est rattachée à un programme de la grille.')
  }
  if (!delai_avance || !['MOIS', 'JOURS'].includes(delai_avance.unite)) {
    throw new Error('delai_avance.unite doit être "MOIS" ou "JOURS".')
  }

  return {
    id: uuidv4(),
    programme_id,
    titre,
    genre,
    chaine,
    description,
    type_offre,
    supports,
    date_mise_en_ligne,
    fenetre_debut,
    fenetre_fin,
    visuel,
    lien,
    delai_avance,
    cree_par,
    cree_le: new Date().toISOString(),
  }
}

/** @returns {Notification} */
export function creerNotification({ offre_id, par }) {
  if (!offre_id) {
    throw new Error('offre_id est obligatoire : une notification référence toujours une offre.')
  }

  const maintenant = new Date().toISOString()
  return {
    id: uuidv4(),
    offre_id,
    statut: 'ENVOYEE',
    envoyee_le: maintenant,
    historique: [{ statut: 'ENVOYEE', le: maintenant, par }],
  }
}
