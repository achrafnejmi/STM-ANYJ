// Tranches d'antenne (M5, §4.6.3) — administrables depuis P19a (table
// `tranche_antenne`, migration-p19a.sql). Bornes exprimées en minutes depuis
// le début de la journée d'antenne (06:00 = 360), même unité que
// minutesDepuisDebutAntenne. `code` reste la clé stable référencée ailleurs
// (campagne.tranches_ciblees, P16) — un renommage de libellé ne casse rien
// d'existant, seuls un changement de code ou une suppression orphaneraient
// des données déjà saisies (voir garde-fou compterCampagnesParTranche, db.js).
//
// Même mécanisme de cache mutable que genres.js : `TRANCHES` reste le MÊME
// tableau tout au long de la vie de l'app, muté en place par
// chargerTranches() — planMedia.js, couverture.js et les écrans qui les
// utilisent continuent d'importer TRANCHES/trancheDe exactement comme avant
// P19a, aucun changement de signature.
import { listerTranchesAntenne as listerTranchesAntenneDb } from './db.js'

// Valeurs de secours si la table est vide ou injoignable — mêmes 5 tranches
// qu'avant la migration.
const TRANCHES_SECOURS = [
  { code: 'MATIN', label: 'Matin', debut: 360, fin: 720 }, // 06:00–12:00
  { code: 'JOURNEE', label: 'Journée', debut: 720, fin: 1080 }, // 12:00–18:00
  { code: 'ACCESS', label: 'Access', debut: 1080, fin: 1245 }, // 18:00–20:45
  { code: 'PRIME', label: 'Prime', debut: 1245, fin: 1440 }, // 20:45–00:00
  { code: 'NUIT', label: 'Nuit', debut: 1440, fin: 1800 }, // 00:00–06:00
]

export const TRANCHES = [...TRANCHES_SECOURS]

// Appelé une fois au démarrage (App.jsx) puis après toute modification depuis
// Administration.
export async function chargerTranches() {
  try {
    const lignes = await listerTranchesAntenneDb()
    if (lignes.length === 0) return
    TRANCHES.length = 0
    TRANCHES.push(
      ...lignes.map((t) => ({ code: t.code, label: t.libelle_fr, debut: t.debut_minutes, fin: t.fin_minutes }))
    )
  } catch (erreur) {
    console.error('Chargement des tranches d’antenne impossible, valeurs de secours conservées.', erreur)
  }
}

// Tranche couvrant une minute d'antenne donnée (0–1439 ou 1440–1799 pour la
// nuit qui déborde sur le lendemain civil). Une minute hors de [360, 1800[ ne
// devrait jamais se présenter (axe jour d'antenne déjà borné ailleurs).
export function trancheDe(minuteAntenne) {
  return TRANCHES.find((t) => minuteAntenne >= t.debut && minuteAntenne < t.fin) ?? null
}
