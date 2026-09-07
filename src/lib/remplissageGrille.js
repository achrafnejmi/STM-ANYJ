// État de remplissage d'une journée d'antenne (P41a — grid check). Pur : aucun
// accès Supabase, aucune écriture. Sert d'indicateur permanent sur la grille
// linéaire (pastille par jour) + toast récapitulatif à l'enregistrement.
//
// Le calcul reste sur l'axe interne 06:00 → 06:00 (comme tout l'affichage) :
// `dureeTransmissionMinutes` est déjà wraparound-safe (une fin après minuit
// reste positive). P41a ne touche pas la journée d'antenne — c'est P41b, et
// uniquement à l'export.
import { dureeTransmissionMinutes } from './semaine.js'

// Journée d'antenne pleine = 24 h. Seuil « presque plein » = 23 h (arbitrage
// P41a). Égalité stricte à la minute pour distinguer COMPLET de DEBORDE.
export const FULL_JOUR_MINUTES = 24 * 60 // 1440
export const SEUIL_PRESQUE_MINUTES = 23 * 60 // 1380

// `diffusionsDuJour` : lignes diffusion_lineaire d'UNE journée d'antenne (déjà
// filtrées : grille active + vecteur + date), telles que regroupées par
// `diffusionsParJour` dans GrilleLineaire.jsx.
export function etatRemplissageJour(diffusionsDuJour) {
  if (!diffusionsDuJour || diffusionsDuJour.length === 0) {
    return { minutes: 0, etat: 'VIDE', ecartMinutes: -FULL_JOUR_MINUTES }
  }
  const minutes = diffusionsDuJour.reduce((acc, d) => acc + dureeTransmissionMinutes(d), 0)
  const ecartMinutes = minutes - FULL_JOUR_MINUTES
  let etat
  if (minutes < SEUIL_PRESQUE_MINUTES) etat = 'INCOMPLET'
  else if (minutes < FULL_JOUR_MINUTES) etat = 'PRESQUE'
  else if (minutes === FULL_JOUR_MINUTES) etat = 'COMPLET'
  else etat = 'DEBORDE'
  return { minutes, etat, ecartMinutes }
}

// Agrège les états d'un ensemble de journées (période affichée) pour le toast
// et un éventuel badge de synthèse.
export function resumeRemplissage(etatsJours) {
  const resume = { nbVides: 0, nbIncomplets: 0, nbPresque: 0, nbComplets: 0, nbDebordent: 0 }
  for (const { etat } of etatsJours) {
    if (etat === 'VIDE') resume.nbVides += 1
    else if (etat === 'INCOMPLET') resume.nbIncomplets += 1
    else if (etat === 'PRESQUE') resume.nbPresque += 1
    else if (etat === 'COMPLET') resume.nbComplets += 1
    else if (etat === 'DEBORDE') resume.nbDebordent += 1
  }
  return resume
}
