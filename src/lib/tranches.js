// Tranches d'antenne (M5, §4.6.3). Liste fermée en dur, même précédent que
// genres.js — pas de nomenclature administrable en base tant qu'Administration
// reste un placeholder (P16). Bornes exprimées en minutes depuis le début de
// la journée d'antenne (06:00 = 360), même unité que minutesDepuisDebutAntenne.
export const TRANCHES = [
  { code: 'MATIN', label: 'Matin', debut: 360, fin: 720 }, // 06:00–12:00
  { code: 'JOURNEE', label: 'Journée', debut: 720, fin: 1080 }, // 12:00–18:00
  { code: 'ACCESS', label: 'Access', debut: 1080, fin: 1245 }, // 18:00–20:45
  { code: 'PRIME', label: 'Prime', debut: 1245, fin: 1440 }, // 20:45–00:00
  { code: 'NUIT', label: 'Nuit', debut: 1440, fin: 1800 }, // 00:00–06:00
]

// Tranche couvrant une minute d'antenne donnée (0–1439 ou 1440–1799 pour la
// nuit qui déborde sur le lendemain civil). Une minute hors de [360, 1800[ ne
// devrait jamais se présenter (axe jour d'antenne déjà borné ailleurs).
export function trancheDe(minuteAntenne) {
  return TRANCHES.find((t) => minuteAntenne >= t.debut && minuteAntenne < t.fin) ?? null
}
