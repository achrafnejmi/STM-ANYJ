// Positionnement pixel sur l'axe continu de la journée d'antenne (06:00→06:00,
// EXG-M2-01), partagé entre GrilleLineaire.jsx (P10/P11) et GrilleType.jsx
// (P13) — les deux affichent des blocs sur le même axe temporel et doivent
// rester visuellement cohérents (un bloc de 3h a la même hauteur partout).
import { DEBUT_JOURNEE_ANTENNE, FIN_JOURNEE_ANTENNE, minutesDepuisDebutAntenne } from './semaine.js'

export const PX_PAR_MINUTE = 1 // 1440px pour la journée d'antenne complète
export const HAUTEUR_TOTALE = (FIN_JOURNEE_ANTENNE - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
export const PAS_ARRONDI_MIN = 5

export function genererMarquesHeures() {
  const marques = []
  for (let m = DEBUT_JOURNEE_ANTENNE; m <= FIN_JOURNEE_ANTENNE; m += 60) marques.push(m)
  return marques
}

// Position Y (px, relative au haut de la colonne du jour) → minute de la
// journée d'antenne, arrondie au pas de 5 min (dépôt ou clic sur la grille).
export function positionVersMinute(offsetY) {
  const brut = DEBUT_JOURNEE_ANTENNE + offsetY / PX_PAR_MINUTE
  const arrondi = Math.round(brut / PAS_ARRONDI_MIN) * PAS_ARRONDI_MIN
  return Math.max(DEBUT_JOURNEE_ANTENNE, Math.min(FIN_JOURNEE_ANTENNE - PAS_ARRONDI_MIN, arrondi))
}

// Répartit des items qui se chevauchent (pas de contrainte d'unicité en base,
// chevauchements autorisés — transmissions : détection formelle en P12 ;
// blocs de grille type : EXG-M3-07, autorisé et non signalé pour l'instant)
// en pistes côte à côte plutôt que superposées. Opère en minutes depuis le
// début de la journée d'antenne (pas en rangées) pour l'axe continu.
// `items` : n'importe quel objet `{heure_debut, heure_fin, ...}` — le champ
// original est conservé sous la clé `item` dans le résultat.
export function disposerEnPistes(items) {
  const avecMinutes = items.map((it) => {
    const debut = minutesDepuisDebutAntenne(it.heure_debut)
    let fin = minutesDepuisDebutAntenne(it.heure_fin)
    if (fin <= debut) fin = debut + PAS_ARRONDI_MIN
    return { item: it, debut, fin }
  })
  const triees = [...avecMinutes].sort((a, b) => a.debut - b.debut)
  const finPiste = [] // dernière minute de fin occupée par piste
  const resultat = []
  for (const it of triees) {
    let piste = finPiste.findIndex((fin) => fin <= it.debut)
    if (piste === -1) {
      piste = finPiste.length
      finPiste.push(0)
    }
    finPiste[piste] = it.fin
    resultat.push({ ...it, piste })
  }
  const nbPistes = finPiste.length || 1
  return resultat.map((r) => ({ ...r, nbPistes }))
}
