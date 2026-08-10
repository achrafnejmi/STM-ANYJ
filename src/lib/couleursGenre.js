// Couleur des blocs de la grille linéaire par genre de programme — un token
// SNRT par genre parmi les 9 genres officiels (P9, src/lib/genres.js). Le
// genre reste stocké en texte libre en base (anciennes données incluses),
// donc la correspondance reste insensible à la casse et par sous-chaîne :
// "Documentaire nationale" matche "Documentaire". Chaque paire {fond, texte}
// garde un contraste correct (fonds clairs → texte foncé, fonds saturés →
// texte blanc).

const CATEGORIES = [
  { motif: 'information', fond: 'bg-snrt-red', texte: 'text-white' },
  { motif: 'magazine', fond: 'bg-snrt-cyan', texte: 'text-slate-900' },
  { motif: 'serie', fond: 'bg-snrt-blue', texte: 'text-white' },
  { motif: 'film', fond: 'bg-snrt-orange', texte: 'text-white' },
  { motif: 'documentaire', fond: 'bg-snrt-genre-turquoise', texte: 'text-slate-900' },
  { motif: 'sport', fond: 'bg-snrt-green', texte: 'text-white' },
  { motif: 'jeunesse', fond: 'bg-snrt-genre-rose', texte: 'text-slate-900' },
  { motif: 'religieux', fond: 'bg-snrt-indigo', texte: 'text-white' },
  { motif: 'divertissement', fond: 'bg-snrt-purple', texte: 'text-white' },
]

const INCONNU = { fond: 'bg-slate-300', texte: 'text-slate-900' }

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
  return categorie ? { fond: categorie.fond, texte: categorie.texte } : INCONNU
}
