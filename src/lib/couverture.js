// Couverture des campagnes (M5, P16). Calcul pur, recalculé à chaque rendu —
// même famille que droits.js, pas planMedia.js (celui-ci ne tourne qu'à la
// demande, « Générer » ; la couverture, elle, s'affiche en continu dans le
// tableau des campagnes, § 4.6.2 : « programme promu... avec son taux de
// couverture »).
import { trancheDe } from './tranches.js'
import { minutesDepuisDebutAntenne } from './semaine.js'

// Portée du calcul : la période PROPRE à chaque campagne (date_debut/date_fin),
// jamais la fenêtre de navigation de l'écran — l'objectif du cahier est
// explicitement « sur la période [de la campagne] ».
// Renvoie Map<campagne_id, { placees, objectif, parTranche: Map<code, nb> }>.
export function calculerCouverture(campagnes, elementsSecondaires) {
  const bandesAnnonces = elementsSecondaires.filter((e) => e.type === 'BANDE_ANNONCE' && e.campagne_id)

  const couverture = new Map()
  for (const c of campagnes) {
    const parTranche = new Map()
    let placees = 0
    for (const e of bandesAnnonces) {
      if (e.campagne_id !== c.id) continue
      if (e.date < c.date_debut || e.date > c.date_fin) continue
      placees += 1
      const tranche = trancheDe(minutesDepuisDebutAntenne(e.heure_debut))
      if (tranche) parTranche.set(tranche.code, (parTranche.get(tranche.code) ?? 0) + 1)
    }
    couverture.set(c.id, { placees, objectif: c.objectif, parTranche })
  }
  return couverture
}
