// Disponibilité d'un spot de bibliothèque (P38a) — garde-fou dur à l'insertion
// d'un BA/spot dans le Plan média. Pur ; même forme de retour que
// droits.js:estProgrammable → { ok, motif }.
//
// Comparaisons de dates sur chaînes ISO "YYYY-MM-DD" (même précédent que
// estProgrammable). Fenêtre permissive : une borne nulle = pas de contrainte
// de ce côté.

export function spotDisponible(spot, dateISO) {
  if (!spot) return { ok: false, motif: 'Spot introuvable.' }
  if (!spot.pad) return { ok: false, motif: 'Spot non prêt à diffuser (PAD).' }
  if (spot.validite_debut && dateISO < spot.validite_debut) {
    return { ok: false, motif: `Spot valide à partir du ${spot.validite_debut}.` }
  }
  if (spot.validite_fin && dateISO > spot.validite_fin) {
    return { ok: false, motif: `Spot expiré depuis le ${spot.validite_fin}.` }
  }
  return { ok: true, motif: null }
}

// Bande-annonce issue d'une campagne : la « validité » vient des dates de la
// campagne (campagne.date_debut / date_fin, NOT NULL). PAD non applicable ici.
export function campagneActiveA(campagne, dateISO) {
  if (!campagne) return { ok: false, motif: 'Campagne introuvable.' }
  if (dateISO < campagne.date_debut || dateISO > campagne.date_fin) {
    return { ok: false, motif: `Campagne hors période (${campagne.date_debut} → ${campagne.date_fin}).` }
  }
  return { ok: true, motif: null }
}
