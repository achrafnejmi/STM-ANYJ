// Déroulé minuté de la journée d'antenne (M7, P17). Pur — aucune écriture,
// aucun accès Supabase, même famille que droits.js/planMedia.js. Fusionne
// diffusion_lineaire (Transmission) et element_secondaire (BA/spots/
// habillage/pub) en une seule chronologie, avec timecode cumulé (EXG-M7-02)
// et écart par rapport à l'horaire annoncé (EXG-M7-03).
import { heureHMSEnSecondes } from './planMedia.js'

// Seuils EXG-M7-03 littéraux : affiché dès 1 minute, signalé (style distinct)
// au-delà de 5 minutes.
export const SEUIL_ECART_AFFICHE_SECONDES = 60
export const SEUIL_ECART_SIGNALE_SECONDES = 300

// Fusion = simple tri, pas un regroupement par coupure (contrairement à
// l'export Plan média, P16b) : un element_secondaire est par construction
// toujours positionné dans l'intervalle qui suit sa transmission d'ancrage
// (estPlacementValide, P16b) — trier la fusion des deux tableaux par
// heure_debut (en secondes, jamais une comparaison de chaînes) suffit à
// obtenir l'ordre d'antenne correct.
export function construireDerouleJour(diffusionsDuJour, elementsSecondairesDuJour) {
  const lignesProgrammes = diffusionsDuJour.map((d) => ({
    cle: `d-${d.id}`,
    categorie: 'PROGRAMME',
    heureDebut: d.heure_debut,
    dureeSecondes: heureHMSEnSecondes(d.heure_fin) - heureHMSEnSecondes(d.heure_debut),
    titre: d.titre_cache,
    episodeNumero: d.episode_numero,
    genre: d.genre,
    vecteur: d.vecteur,
    origine: d.origine,
    apresTransmissionId: d.id,
    diffusionId: d.id,
  }))

  const lignesElements = elementsSecondairesDuJour.map((e) => ({
    cle: `e-${e.id}`,
    categorie: 'ELEMENT_SECONDAIRE',
    heureDebut: e.heure_debut,
    dureeSecondes: e.duree_secondes,
    libelle: e.libelle,
    type: e.type,
    origine: e.origine,
    apresTransmissionId: e.apres_transmission_id,
    elementId: e.id,
  }))

  const lignes = [...lignesProgrammes, ...lignesElements].sort((a, b) => {
    const diff = heureHMSEnSecondes(a.heureDebut) - heureHMSEnSecondes(b.heureDebut)
    if (diff !== 0) return diff
    // Départage déterministe en cas d'égalité exacte (rare) : un programme
    // avant un élément secondaire, puis par clé.
    if (a.categorie !== b.categorie) return a.categorie === 'PROGRAMME' ? -1 : 1
    return a.cle.localeCompare(b.cle)
  })

  // Timecode cumulé (EXG-M7-02) : la 1ère ligne du jour sert d'ancre (son
  // timecode = son propre horaire annoncé, écart nul par construction) ;
  // chaque ligne suivante hérite du timecode précédent + la durée précédente
  // — un cumul de DURÉES, pas une recopie des horaires annoncés.
  let timecodeCourant = null
  for (const ligne of lignes) {
    const debutSecondes = heureHMSEnSecondes(ligne.heureDebut)
    if (timecodeCourant == null) timecodeCourant = debutSecondes
    ligne.timecode = timecodeCourant
    ligne.ecart = timecodeCourant - debutSecondes
    timecodeCourant += ligne.dureeSecondes
  }

  return lignes
}

// Panneau de synthèse (§4.8.2) : date fournie par l'appelant (pas recalculée
// ici, cette fonction ne connaît que les lignes).
export function calculerSynthese(lignes) {
  const elementsSecondaires = lignes.filter((l) => l.categorie === 'ELEMENT_SECONDAIRE')
  return {
    nbLignes: lignes.length,
    nbProgrammes: lignes.length - elementsSecondaires.length,
    nbElementsAuto: elementsSecondaires.filter((l) => l.origine === 'AUTOMATIQUE').length,
    nbElementsManuels: elementsSecondaires.filter((l) => l.origine === 'MANUELLE').length,
    volumeTotalSecondes: lignes.reduce((somme, l) => somme + l.dureeSecondes, 0),
    ecartMaximalSecondes: lignes.reduce((max, l) => Math.max(max, Math.abs(l.ecart)), 0),
  }
}
