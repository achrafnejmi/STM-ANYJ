// Export du conducteur de publicité (P39a) — reproduit le document réel de la
// régie pub (réf. design-reference/20260904_AL AOULA_20260903ai.pdf, « Édité
// par BOA »). Pur : la mise en page jsPDF reste dans ConducteurPub.jsx (même
// découpage que exportConducteur.js).
import { JOURS_LONGS, MOIS_LONGS } from './semaine.js'
import { formaterDureeHMS } from './exportConducteur.js'

export const ENTETE_CONDUCTEUR_PUB = ['Écran', 'Heure prév.', 'Contexte', 'Nb de spots', 'Durée tranche']

// mm:ss suivi du guillemet, comme dans la référence (« 00:47" »).
function mmss(sec) {
  if (sec == null) return ''
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}"`
}

// « Vendredi 4 Septembre 2026 » — mots capitalisés, jour non zéro-préfixé (réf.).
export function libelleDateConducteurPub(dateISO) {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(JOURS_LONGS[d.getUTCDay()])} ${d.getUTCDate()} ${cap(MOIS_LONGS[d.getUTCMonth()])} ${d.getUTCFullYear()}`
}

export function construireDonneesConducteurPub({ chaineNom, dateISO, ecrans }) {
  const lignes = [...ecrans]
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((e) => ({
      nom: e.nom ?? '',
      heure: e.heure_previsionnelle ? e.heure_previsionnelle.slice(0, 8) : '',
      contexte: e.contexte ?? '',
      nbSpots: e.nb_spots ?? 0,
      dureeTranche: mmss(e.duree_tranche_secondes),
    }))
  const totalNbSpots = ecrans.reduce((acc, e) => acc + (e.nb_spots ?? 0), 0)
  const totalDureeSec = ecrans.reduce((acc, e) => acc + (e.duree_tranche_secondes ?? 0), 0)
  return {
    emetteur: chaineNom,
    dateLabel: libelleDateConducteurPub(dateISO),
    lignes,
    totalNbSpots,
    totalDureeLabel: `${formaterDureeHMS(totalDureeSec)}"`,
  }
}

// « 20260904_AL AOULA.pdf » (date de diffusion + émetteur), comme la référence.
export function nomFichierConducteurPub(chaineNom, dateISO) {
  return `${dateISO.replace(/-/g, '')}_${chaineNom.toUpperCase()}.pdf`
}
