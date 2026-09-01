// Couleur des blocs de la grille linéaire par genre de programme (P9, étendu
// P19a). Le genre reste stocké en texte libre en base (anciennes données
// incluses), donc la correspondance reste insensible à la casse et par
// sous-chaîne : "Documentaire nationale" matche "Documentaire".
//
// P19a rend le mapping genre -> couleur administrable (table `genre`,
// colonne couleur_token) SANS jamais construire de classe Tailwind par
// concaténation : le scanner JIT n'indexe que des chaînes de classe
// complètes présentes telles quelles dans le code source, donc la palette
// de tokens ci-dessous reste fermée et 100% littérale — seule la
// correspondance « quel genre utilise quel token » vient de la base.
const PALETTE = {
  rouge: { fond: 'bg-snrt-red', texte: 'text-white', fondClair: 'bg-snrt-red/10', bordure: 'border-snrt-red' },
  cyan: { fond: 'bg-snrt-cyan', texte: 'text-slate-900', fondClair: 'bg-snrt-cyan/10', bordure: 'border-snrt-cyan' },
  bleu: { fond: 'bg-snrt-blue', texte: 'text-white', fondClair: 'bg-snrt-blue/10', bordure: 'border-snrt-blue' },
  orange: { fond: 'bg-snrt-orange', texte: 'text-white', fondClair: 'bg-snrt-orange/10', bordure: 'border-snrt-orange' },
  turquoise: {
    fond: 'bg-snrt-genre-turquoise',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-turquoise/10',
    bordure: 'border-snrt-genre-turquoise',
  },
  vert: { fond: 'bg-snrt-green', texte: 'text-white', fondClair: 'bg-snrt-green/10', bordure: 'border-snrt-green' },
  rose: {
    fond: 'bg-snrt-genre-rose',
    texte: 'text-slate-900',
    fondClair: 'bg-snrt-genre-rose/10',
    bordure: 'border-snrt-genre-rose',
  },
  indigo: { fond: 'bg-snrt-indigo', texte: 'text-white', fondClair: 'bg-snrt-indigo/10', bordure: 'border-snrt-indigo' },
  violet: { fond: 'bg-snrt-purple', texte: 'text-white', fondClair: 'bg-snrt-purple/10', bordure: 'border-snrt-purple' },
  // Tokens de réserve (P19a) : pour qu'un genre ajouté depuis Administration
  // au-delà des 9 d'origine obtienne une couleur distincte plutôt que de
  // devoir réutiliser celle d'un genre existant.
  ambre: { fond: 'bg-snrt-amber', texte: 'text-slate-900', fondClair: 'bg-snrt-amber/10', bordure: 'border-snrt-amber' },
  teal: { fond: 'bg-teal-600', texte: 'text-white', fondClair: 'bg-teal-600/10', bordure: 'border-teal-600' },
  fuchsia: { fond: 'bg-fuchsia-600', texte: 'text-white', fondClair: 'bg-fuchsia-600/10', bordure: 'border-fuchsia-600' },
}

// Pour le sélecteur de couleur dans Administration (TableauGenres.jsx).
export const TOKENS_PALETTE = Object.keys(PALETTE)

// Classes d'un token de palette donné (aperçu couleur dans le sélecteur de
// TableauGenres.jsx) — contrairement à couleurGenre(), pas de correspondance
// par sous-chaîne : lecture directe de la clé de palette.
export function couleurDuToken(token) {
  return PALETTE[token] ?? INCONNU
}

const INCONNU = { fond: 'bg-slate-300', texte: 'text-slate-900', fondClair: 'bg-slate-300/10', bordure: 'border-slate-300' }

function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

// Correspondance genre (libellé FR normalisé) -> token de PALETTE. Valeurs de
// secours identiques aux 9 catégories codées en dur avant P19a (mêmes
// couleurs, même ordre de priorité en cas de sous-chaînes ambiguës) —
// non-régression garantie même avant que chargerGenres() (genres.js) ait
// résolu. Mutée en place par definirTokensCouleur, jamais réassignée.
const TOKENS_PAR_GENRE = new Map([
  ['information', 'rouge'],
  ['magazine', 'cyan'],
  ['serie', 'bleu'],
  ['film', 'orange'],
  ['documentaire', 'turquoise'],
  ['sport', 'vert'],
  ['jeunesse', 'rose'],
  ['religieux', 'indigo'],
  ['divertissement', 'violet'],
])

// Appelé par genres.js (chargerGenres()) à la lecture de la table `genre` —
// remplace la correspondance par l'état actuel de la base, en conservant la
// même tolérance par sous-chaîne. `genresCharges` : [{ fr, couleurToken }].
export function definirTokensCouleur(genresCharges) {
  TOKENS_PAR_GENRE.clear()
  for (const g of genresCharges) {
    TOKENS_PAR_GENRE.set(normaliser(g.fr), g.couleurToken)
  }
}

export function couleurGenre(genre) {
  if (!genre) return INCONNU
  const normalise = normaliser(genre)
  for (const [motif, token] of TOKENS_PAR_GENRE) {
    if (normalise.includes(motif)) return PALETTE[token] ?? INCONNU
  }
  return INCONNU
}
