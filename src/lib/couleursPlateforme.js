// Couleur de marque par plateforme réseaux sociaux (Grille non-linéaire, P20).
// Correspondance EXACTE (pas substring) : `plateforme`
// est une valeur fermée (CHECK constraint), jamais du texte libre comme
// `genre`. Classes Tailwind LITTÉRALES (contrainte JIT, voir couleursGenre.js)
// associées aux tokens définis dans index.css (@theme). FORJA n'a pas
// d'entrée ici : son logo réel (public/brand/forja-logo.svg) s'affiche sans
// fond coloré, jamais via ce badge.
const COULEURS = {
  FACEBOOK: { fond: 'bg-plateforme-facebook', texte: 'text-white' },
  INSTAGRAM: { fond: 'bg-plateforme-instagram', texte: 'text-white' },
  TIKTOK: { fond: 'bg-plateforme-tiktok', texte: 'text-white' },
  SNAPCHAT: { fond: 'bg-plateforme-snapchat', texte: 'text-slate-900' },
  YOUTUBE: { fond: 'bg-plateforme-youtube', texte: 'text-white' },
}

const INCONNU = { fond: 'bg-slate-300', texte: 'text-slate-900' }

export function couleurPlateforme(code) {
  return COULEURS[code] ?? INCONNU
}
