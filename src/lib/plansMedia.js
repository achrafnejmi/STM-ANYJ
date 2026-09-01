// Multi-documents : plans média nommés (P24). Logique composée au-dessus de
// db.js (même esprit que grilles.js, P23), pas un accès direct à Supabase.
import { listerElementsSecondairesParPlanMedia, creerPlanMedia, creerElementsSecondaires } from './db.js'
import { get, set } from './storage.js'

function cleDocumentsOuverts(chaineCode) {
  return `session:plans-media-ouverts:${chaineCode}`
}

export function lireDocumentsOuverts(chaineCode) {
  return get(cleDocumentsOuverts(chaineCode)) ?? []
}

export function definirDocumentsOuverts(chaineCode, idsListe) {
  set(cleDocumentsOuverts(chaineCode), idsListe)
}

// Nouveau plan média + copie des éléments de la source. Contrairement à
// dupliquerGrille (P23), apres_transmission_id N'EST PAS recalculé : tous les
// plans média d'une chaîne travaillent sur la même trame de diffusions live
// (Plan média ne lit que la grille live, règle posée en P23) — dupliquer un
// document, c'est juste avoir un second jeu de placements indépendant sur
// cette même trame.
export async function dupliquerPlanMedia(planMedia, nouveauNom, creePar) {
  const cible = await creerPlanMedia({ chaine_id: planMedia.chaine_id, nom: nouveauNom, cree_par: creePar })
  const source = await listerElementsSecondairesParPlanMedia(planMedia.id)
  if (source.length > 0) {
    const lignes = source.map(({ id: _id, ...champs }) => ({ ...champs, plan_media_id: cible.id }))
    await creerElementsSecondaires(lignes)
  }
  return cible
}
