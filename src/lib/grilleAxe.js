// Positionnement pixel sur l'axe continu de la journée d'antenne (06:00→06:00,
// EXG-M2-01), partagé entre GrilleLineaire.jsx (P10/P11) et GrilleType.jsx
// (P13) — les deux affichent des blocs sur le même axe temporel et doivent
// rester visuellement cohérents (un bloc de 3h a la même hauteur partout).
import { DEBUT_JOURNEE_ANTENNE, FIN_JOURNEE_ANTENNE, minutesDepuisDebutAntenne } from './semaine.js'

export const PX_PAR_MINUTE = 1 // 1440px pour la journée d'antenne complète
export const HAUTEUR_TOTALE = (FIN_JOURNEE_ANTENNE - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
export const PAS_ARRONDI_MIN = 5

// Paliers de zoom (P25, GrilleLineaire.jsx uniquement — GrilleType.jsx garde
// les constantes ci-dessus, inchangées). « Config prédéfinie » au sens de la
// roadmap : une liste fermée et nommée, pas un curseur continu ni une table
// administrable. STANDARD reprend exactement PX_PAR_MINUTE/PAS_ARRONDI_MIN
// ci-dessus — c'est le palier par défaut, donc le comportement d'avant P25
// reste identique tant que l'utilisateur ne change pas de palier. Pas de
// palier à la seconde (EXG-M2-01/02 : la grille programme à la minute ; la
// précision seconde reste l'apanage du plan média/conducteur, mécanisme
// séparé — heureHMSEnSecondes, planMedia.js).
export const PRESETS_ZOOM = [
  { code: 'ENSEMBLE', label: "Vue d'ensemble", pxParMinute: 0.4, pasArrondiMin: 30 },
  { code: 'STANDARD', label: 'Standard', pxParMinute: PX_PAR_MINUTE, pasArrondiMin: PAS_ARRONDI_MIN },
  { code: 'PRECIS', label: 'Précis', pxParMinute: 2, pasArrondiMin: 1 },
]
export const INDEX_ZOOM_DEFAUT = 1 // STANDARD

export function genererMarquesHeures() {
  const marques = []
  for (let m = DEBUT_JOURNEE_ANTENNE; m <= FIN_JOURNEE_ANTENNE; m += 60) marques.push(m)
  return marques
}

// Hauteur totale de l'axe pour un palier de zoom donné — GrilleLineaire.jsx
// l'utilise avec son palier courant ; GrilleType.jsx garde HAUTEUR_TOTALE
// (constante, inchangée).
export function calculerHauteurTotale(preset) {
  return (FIN_JOURNEE_ANTENNE - DEBUT_JOURNEE_ANTENNE) * preset.pxParMinute
}

// Position Y (px, relative au haut de la colonne du jour) → minute de la
// journée d'antenne, arrondie au pas du palier de zoom (dépôt ou clic sur la
// grille). `preset` optionnel : GrilleType.jsx continue d'appeler cette
// fonction à 1 argument (comportement inchangé, palier STANDARD implicite).
export function positionVersMinute(offsetY, preset = PRESETS_ZOOM[INDEX_ZOOM_DEFAUT]) {
  const brut = DEBUT_JOURNEE_ANTENNE + offsetY / preset.pxParMinute
  const arrondi = Math.round(brut / preset.pasArrondiMin) * preset.pasArrondiMin
  return Math.max(DEBUT_JOURNEE_ANTENNE, Math.min(FIN_JOURNEE_ANTENNE - preset.pasArrondiMin, arrondi))
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
