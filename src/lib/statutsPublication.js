// Statuts d'une publication (Grille non-linéaire, hors cahier, P20) — partagés
// par les 2 onglets (publication_reseau/publication_vod, même CHECK
// constraint en base) : panneau d'édition, badge des cartes, export.
export const STATUTS_PUBLICATION = [
  { code: 'BROUILLON', libelle: 'Brouillon', fond: 'bg-slate-200', texte: 'text-slate-700' },
  { code: 'PROGRAMME', libelle: 'Programmé', fond: 'bg-amber-100', texte: 'text-amber-700' },
  { code: 'PUBLIE', libelle: 'Publié', fond: 'bg-emerald-100', texte: 'text-emerald-700' },
  { code: 'ANNULE', libelle: 'Annulé', fond: 'bg-red-100', texte: 'text-red-700' },
]

export function statutPublication(code) {
  return STATUTS_PUBLICATION.find((s) => s.code === code) ?? STATUTS_PUBLICATION[0]
}
