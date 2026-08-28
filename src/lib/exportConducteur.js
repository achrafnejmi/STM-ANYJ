// Export du conducteur (M7, P17) — « transmission à l'antenne » (EXG-M7-06) :
// aucune régie réelle n'existe dans ce PoC, l'export Excel EST la
// concrétisation de « transmissible ». Pur : aucune dépendance xlsx ici (le
// XLSX.writeFile reste dans Conducteur.jsx, même découpage que
// exportPlanMedia.js).
import { secondesEnHeureHMS } from './planMedia.js'
import { formaterJourDateLongue } from './semaine.js'

export const ENTETE_CONDUCTEUR = ['Timecode', 'Type', 'Titre / Libellé', 'Détails', 'Durée', 'Écart', 'Origine']

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}

export function formaterDureeHMS(secondes) {
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  const s = secondes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formaterEcart(secondes) {
  if (secondes === 0) return ''
  const signe = secondes > 0 ? '+' : '-'
  return `${signe}${formaterDureeHMS(Math.abs(secondes))}`
}

function detailsLigne(ligne) {
  if (ligne.categorie !== 'PROGRAMME') return ''
  const episode = ligne.episodeNumero != null ? `ÉP.${String(ligne.episodeNumero).padStart(2, '0')}` : ''
  return [episode, ligne.genre].filter(Boolean).join(' — ')
}

export function construireLignesExportConducteur(lignes) {
  return lignes.map((ligne) => [
    secondesEnHeureHMS(ligne.timecode),
    ligne.categorie === 'PROGRAMME' ? 'Programme' : (LIBELLES_TYPE[ligne.type] ?? ligne.type),
    ligne.categorie === 'PROGRAMME' ? ligne.titre ?? '' : ligne.libelle ?? '',
    detailsLigne(ligne),
    formaterDureeHMS(ligne.dureeSecondes),
    formaterEcart(ligne.ecart),
    ligne.origine === 'AUTOMATIQUE' ? 'Auto' : 'Manuel',
  ])
}

// `extension` (P31 — passe design, ajoute Word/PDF) : 'xlsx' par défaut,
// comportement inchangé pour l'appel existant.
export function construireNomFichierConducteur(date, extension = 'xlsx') {
  return `Conducteur — ${formaterJourDateLongue(date)}.${extension}`
}
