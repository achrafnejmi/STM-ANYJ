// Couleur des blocs de grille type par TYPE (pas par genre — voir
// couleursGenre.js pour les blocs de transmission du plan de diffusion).
// Correspondance EXACTE (pas de tolérance substring comme couleurGenre) :
// `type_bloc` est une liste fermée écrite uniquement par la palette
// (PaletteTypes.jsx), jamais du texte libre historique.

const COULEURS = {
  Matinale: { fond: 'bg-snrt-amber', texte: 'text-slate-900', fondClair: 'bg-snrt-amber/10', bordure: 'border-snrt-amber' },
  Jeunesse: {
    fond: 'bg-snrt-genre-rose',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-rose/10',
    bordure: 'border-snrt-genre-rose',
  },
  'Mi-journée': {
    fond: 'bg-snrt-genre-turquoise',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-turquoise/10',
    bordure: 'border-snrt-genre-turquoise',
  },
  'Info midi': { fond: 'bg-snrt-blue', texte: 'text-white', fondClair: 'bg-snrt-blue/10', bordure: 'border-snrt-blue' },
  'Après-midi': { fond: 'bg-snrt-orange', texte: 'text-white', fondClair: 'bg-snrt-orange/10', bordure: 'border-snrt-orange' },
  Religieux: { fond: 'bg-snrt-indigo', texte: 'text-white', fondClair: 'bg-snrt-indigo/10', bordure: 'border-snrt-indigo' },
  Access: { fond: 'bg-snrt-cyan', texte: 'text-slate-900', fondClair: 'bg-snrt-cyan/10', bordure: 'border-snrt-cyan' },
  Prime: { fond: 'bg-snrt-red', texte: 'text-white', fondClair: 'bg-snrt-red/10', bordure: 'border-snrt-red' },
  'Deuxième partie': {
    fond: 'bg-snrt-purple',
    texte: 'text-white',
    fondClair: 'bg-snrt-purple/10',
    bordure: 'border-snrt-purple',
  },
}

const INCONNU = { fond: 'bg-slate-300', texte: 'text-slate-900', fondClair: 'bg-slate-300/10', bordure: 'border-slate-300' }

export function couleurType(typeBloc) {
  if (!typeBloc) return INCONNU
  return COULEURS[typeBloc] ?? INCONNU
}
