// Couleur des blocs de la grille linéaire par genre de programme — un token
// SNRT par genre parmi les 9 genres officiels (P9, src/lib/genres.js). Le
// genre reste stocké en texte libre en base (anciennes données incluses),
// donc la correspondance reste insensible à la casse et par sous-chaîne :
// "Documentaire nationale" matche "Documentaire". Chaque paire {fond, texte}
// garde un contraste correct (fonds clairs → texte foncé, fonds saturés →
// texte blanc). `fondClair`/`bordure` (P13) sont des classes Tailwind
// LITTÉRALES dédiées aux bandes de grille type — construire ces variantes par
// concaténation (`${fond}/10`, `fond.replace('bg-','border-')`) ne fonctionne
// pas : le scanner JIT de Tailwind n'indexe que des chaînes de classe
// complètes présentes telles quelles dans le code source.

const CATEGORIES = [
  { motif: 'information', fond: 'bg-snrt-red', texte: 'text-white', fondClair: 'bg-snrt-red/10', bordure: 'border-snrt-red' },
  { motif: 'magazine', fond: 'bg-snrt-cyan', texte: 'text-slate-900', fondClair: 'bg-snrt-cyan/10', bordure: 'border-snrt-cyan' },
  { motif: 'serie', fond: 'bg-snrt-blue', texte: 'text-white', fondClair: 'bg-snrt-blue/10', bordure: 'border-snrt-blue' },
  { motif: 'film', fond: 'bg-snrt-orange', texte: 'text-white', fondClair: 'bg-snrt-orange/10', bordure: 'border-snrt-orange' },
  {
    motif: 'documentaire',
    fond: 'bg-snrt-genre-turquoise',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-turquoise/10',
    bordure: 'border-snrt-genre-turquoise',
  },
  { motif: 'sport', fond: 'bg-snrt-green', texte: 'text-white', fondClair: 'bg-snrt-green/10', bordure: 'border-snrt-green' },
  {
    motif: 'jeunesse',
    fond: 'bg-snrt-genre-rose',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-rose/10',
    bordure: 'border-snrt-genre-rose',
  },
  { motif: 'religieux', fond: 'bg-snrt-indigo', texte: 'text-white', fondClair: 'bg-snrt-indigo/10', bordure: 'border-snrt-indigo' },
  {
    motif: 'divertissement',
    fond: 'bg-snrt-purple',
    texte: 'text-white',
    fondClair: 'bg-snrt-purple/10',
    bordure: 'border-snrt-purple',
  },
]

const INCONNU = { fond: 'bg-slate-300', texte: 'text-slate-900', fondClair: 'bg-slate-300/10', bordure: 'border-slate-300' }

function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function couleurGenre(genre) {
  if (!genre) return INCONNU
  const normalise = normaliser(genre)
  const categorie = CATEGORIES.find((c) => normalise.includes(c.motif))
  return categorie ?? INCONNU
}
