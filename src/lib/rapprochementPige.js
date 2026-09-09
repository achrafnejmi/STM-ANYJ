// Rapprochement pige ↔ catalogue (P36b). Il n'y a AUCUNE FK entre
// diffusion_reelle et programme (décision P36a : import autonome). Le
// rapprochement est donc best-effort, par le nom :
//   normalisation (majuscules, sans accents, sans « (…) », ponctuation → espace,
//   espaces compressés) puis égalité OU inclusion bidirectionnelle (≥ 4
//   caractères de part et d'autre).
// Même esprit que trouverCampagneParTitre dans importPlanMedia.js. Des faux
// positifs / faux négatifs sont assumés.

export function normaliserTitre(valeur) {
  return (valeur ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^0-9a-z ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

// Mot le plus long du titre (≥ 3 lettres) — sert de pré-filtre serveur `ilike`
// dans listerDiffusionsReellesParMotCle. Repli : le titre normalisé entier.
export function motCleTitre(titre) {
  const mots = normaliserTitre(titre).split(' ').filter((m) => m.length >= 3)
  if (mots.length === 0) return normaliserTitre(titre)
  return mots.sort((a, b) => b.length - a.length)[0]
}

// Vrai si le nom de pige correspond à l'un des titres fournis (FR / AR / EN…).
export function pigeCorrespondAuTitre(nomPige, titres) {
  const a = normaliserTitre(nomPige)
  if (!a) return false
  return titres.some((t) => {
    const b = normaliserTitre(t)
    if (!b) return false
    if (a === b) return true
    return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))
  })
}

// Nature d'une diffusion réelle déduite du libellé complémentaire (best-effort,
// P36b) : « ... (REDIFFUSION) » → Rediffusion, sinon Diffusion.
export function natureDepuisLibelle(libelle) {
  return /rediff/i.test(libelle ?? '') ? 'Rediffusion' : 'Diffusion'
}
