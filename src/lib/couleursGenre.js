// Couleur des blocs de la grille linéaire par genre de programme (mapping
// validé, palette SNRT existante — index.css). Genre = texte libre (P7),
// donc correspondance insensible à la casse et par sous-chaîne : "Documentaire
// nationale" matche "Documentaire". Chaque paire {fond, texte} garde un
// contraste correct (fonds clairs → texte foncé, fonds saturés → texte blanc).

const CATEGORIES = [
  { motif: 'documentaire', fond: 'bg-snrt-genre-turquoise', texte: 'text-slate-900' },
  { motif: 'emission', fond: 'bg-snrt-genre-rose', texte: 'text-slate-900' },
  { motif: 'divertissement', fond: 'bg-snrt-orange', texte: 'text-white' },
  { motif: 'fiction', fond: 'bg-snrt-blue', texte: 'text-white' },
  { motif: 'serie', fond: 'bg-snrt-blue', texte: 'text-white' },
  { motif: 'sport', fond: 'bg-snrt-green', texte: 'text-white' },
  { motif: 'info', fond: 'bg-snrt-red', texte: 'text-white' },
  { motif: 'actualite', fond: 'bg-snrt-red', texte: 'text-white' },
  { motif: 'magazine', fond: 'bg-snrt-cyan', texte: 'text-white' },
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
