// Comptage des diffusions payantes pour la finance (P37b). Fonction PURE,
// aucun accès Supabase. L'app NE calcule AUCUN montant / % / règle : elle
// fournit uniquement le nombre de diffusions réelles et le nombre de
// diffusions payantes (au-delà des `seuil_gratuit` premières, qui ne sont pas
// payées). La finance applique ses barèmes de son côté.
//
// Le rapprochement pige ↔ programme se fait par le nom (rapprochementPige.js),
// il est APPROXIMATIF : `calculerDroitProgramme` prend en compte les
// `exclusions` (faux positifs décochés par le Chargé d'acquisitions) et un
// éventuel override manuel du total (`nb_reelles_manuel`, pour un faux négatif).

export const SEUIL_GRATUIT_DEFAUT = 3

export function calculerDroitProgramme({ rapprochees, droit }) {
  const seuil = droit?.seuil_gratuit ?? SEUIL_GRATUIT_DEFAUT
  const exclusions = new Set(droit?.exclusions ?? [])
  const comptees = rapprochees.filter((d) => !exclusions.has(d.id))
  const manuel = droit?.nb_reelles_manuel != null
  const nbReelles = manuel ? droit.nb_reelles_manuel : comptees.length
  const nbPayantes = Math.max(0, nbReelles - seuil)
  return {
    nbRapprochees: rapprochees.length,
    nbExclues: rapprochees.length - comptees.length,
    nbReelles,
    nbPayantes,
    seuil,
    manuel,
  }
}

// Annote chaque diffusion comptée de son rang chronologique (1-based) et de son
// caractère payant (rang > seuil) — pour griser les premières dans le panneau
// de vérification et marquer la colonne « Comptée » de l'export.
export function annoterRangs(rapprochees, droit) {
  const seuil = droit?.seuil_gratuit ?? SEUIL_GRATUIT_DEFAUT
  const exclusions = new Set(droit?.exclusions ?? [])
  let rang = 0
  return rapprochees.map((d) => {
    const exclue = exclusions.has(d.id)
    if (!exclue) rang += 1
    return { ...d, exclue, rang: exclue ? null : rang, payante: !exclue && rang > seuil }
  })
}
