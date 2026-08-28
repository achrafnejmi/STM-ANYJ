// Export Plan média au format du fichier réel (P16b) — remplace PM_5AOUT.
// Pur : aucune dépendance à xlsx/SheetJS ici (celle-ci reste dans
// PlanMedia.jsx, même découpage que l'export existant de
// ListeProgrammes.jsx). Format colonnes confirmé par le parseur legacy mort
// de src/lib/stm-import.js (parsePlanMedia) : feuille "PM", ligne de titre
// au-dessus de l'en-tête JOUR/H.FIN/CONTEXTE/CONTENU/DUREE, H.FIN et DUREE
// stockés comme des fractions de journée Excel (même convention reprise ici).
import { formaterDateJJMMAAAA, formaterJourDateLongue, formaterDateLonguePadded } from './semaine.js'

export const TITRE_FEUILLE_PLAN_MEDIA = 'Plan Média Autopromotion'
export const ENTETE_PLAN_MEDIA = ['JOUR', 'H.FIN', 'CONTEXTE', 'CONTENU', 'DUREE']

export function fractionJourneeDepuisHMS(hms) {
  const [h, m, s] = hms.split(':').map(Number)
  return (h * 3600 + m * 60 + (s || 0)) / 86400
}

export function fractionJourneeDepuisSecondes(secondes) {
  return secondes / 86400
}

// CONTENU d'une bande-annonce : "BA " + titre du programme promu (auto ET
// manuelle — les deux passent par une campagne). Tout autre type : le
// libellé stocké tel quel.
function libelleContenu(element, campagnesParId, programmesParId) {
  if (element.type === 'BANDE_ANNONCE' && element.campagne_id) {
    const campagne = campagnesParId.get(element.campagne_id)
    const titre = campagne ? programmesParId.get(campagne.programme_id)?.titre : null
    if (titre) return `BA ${titre}`
  }
  return element.libelle ?? ''
}

// Renvoie { lignes, cellulesHeure } :
// - lignes : tableau de lignes [JOUR, H.FIN, CONTEXTE, CONTENU, DUREE], H.FIN
//   et CONTEXTE vides ('') sauf sur la 1ère ligne de chaque coupure, H.FIN et
//   DUREE déjà convertis en fraction de journée (nombre) quand renseignés.
// - cellulesHeure : positions [index dans `lignes`, colonne] des cellules
//   H.FIN/DUREE à formater en heure côté appelant (mise en forme XLSX =
//   détail d'affichage, pas de cette fonction pure).
// Portée : uniquement les dates de `dates` (la période affichée à l'écran),
// toute origine confondue. Une coupure sans aucun élément n'apparaît pas.
export function construireLignesPlanMedia(dates, diffusions, elementsSecondaires, programmesParId, campagnesParId) {
  const datesRetenues = new Set(dates)
  const diffusionsParId = new Map(diffusions.map((d) => [d.id, d]))

  const parCoupure = new Map()
  for (const e of elementsSecondaires) {
    if (!datesRetenues.has(e.date)) continue
    if (!parCoupure.has(e.apres_transmission_id)) parCoupure.set(e.apres_transmission_id, [])
    parCoupure.get(e.apres_transmission_id).push(e)
  }

  const coupures = []
  for (const [transmissionId, elements] of parCoupure) {
    // Repère = la transmission elle-même (heure_fin), jamais le 1er élément
    // survivant : robuste même si des éléments ont été supprimés
    // individuellement depuis (EXG-M5-06).
    const transmission = diffusionsParId.get(transmissionId)
    if (!transmission) continue
    elements.sort((a, b) => (a.heure_debut < b.heure_debut ? -1 : a.heure_debut > b.heure_debut ? 1 : 0))
    coupures.push({ transmission, elements })
  }
  coupures.sort((a, b) => {
    if (a.transmission.date !== b.transmission.date) return a.transmission.date < b.transmission.date ? -1 : 1
    return a.transmission.heure_fin < b.transmission.heure_fin ? -1 : a.transmission.heure_fin > b.transmission.heure_fin ? 1 : 0
  })

  const lignes = []
  const cellulesHeure = []
  for (const { transmission, elements } of coupures) {
    const contexte = programmesParId.get(transmission.programme_id)?.titre ?? ''
    elements.forEach((e, i) => {
      const indexLigne = lignes.length
      if (i === 0) cellulesHeure.push([indexLigne, 1]) // H.FIN
      cellulesHeure.push([indexLigne, 4]) // DUREE
      lignes.push([
        formaterDateJJMMAAAA(transmission.date),
        i === 0 ? fractionJourneeDepuisHMS(transmission.heure_fin) : '',
        i === 0 ? contexte : '',
        libelleContenu(e, campagnesParId, programmesParId),
        fractionJourneeDepuisSecondes(e.duree_secondes),
      ])
    })
  }
  return { lignes, cellulesHeure }
}

function formaterFractionJournee(fraction) {
  if (fraction === '' || fraction == null) return ''
  const secondesTotales = Math.round(fraction * 86400)
  const h = Math.floor(secondesTotales / 3600)
  const m = Math.floor((secondesTotales % 3600) / 60)
  const s = secondesTotales % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Version texte (Word/PDF, P31 — passe design, ajoute les formats manquants
// au même contenu déjà exporté en Excel) : mêmes lignes que
// construireLignesPlanMedia (même regroupement/tri/libellés, aucune logique
// dupliquée), juste H.FIN/DUREE reformatés en "HH:MM:SS" au lieu de
// fractions de journée Excel (mise en forme numérique propre à la feuille
// XLSX, sans objet dans un document texte).
export function construireLignesTextePlanMedia(dates, diffusions, elementsSecondaires, programmesParId, campagnesParId) {
  const { lignes } = construireLignesPlanMedia(dates, diffusions, elementsSecondaires, programmesParId, campagnesParId)
  return lignes.map(([jour, hFin, contexte, contenu, duree]) => [
    jour,
    formaterFractionJournee(hFin),
    contexte,
    contenu,
    formaterFractionJournee(duree),
  ])
}

// Nom de fichier dynamique selon la vue affichée (pas un nom fixe type
// "PM_5AOUT" — ça n'était qu'un exemple du fichier réel à remplacer).
// `extension` (P31 — passe design, ajoute Word/PDF) : 'xlsx' par défaut,
// comportement inchangé pour l'appel existant.
export function construireNomFichierPlanMedia(vue, dates, extension = 'xlsx') {
  if (vue === 'JOUR') return `Plan média — ${formaterJourDateLongue(dates[0])}.${extension}`
  const debut = dates[0]
  const fin = dates[dates.length - 1]
  return `Plan média — semaine du ${formaterDateLonguePadded(debut)} au ${formaterDateLonguePadded(fin)}.${extension}`
}
