// Multi-documents : grilles type nommées + gabarits saisonniers (P28). Même
// esprit que grilles.js (P23)/plansMedia.js (P24) — logique composée
// au-dessus de db.js, pas un accès direct à Supabase.
import { listerBlocsGrilleTypeParGrilleType, creerGrilleType, creerBlocsGrilleType } from './db.js'
import { get, set } from './storage.js'

function cleGrillesTypeOuvertes(chaineCode) {
  return `session:grilles-type-ouvertes:${chaineCode}`
}

export function lireGrillesTypeOuvertes(chaineCode) {
  return get(cleGrillesTypeOuvertes(chaineCode)) ?? []
}

export function definirGrillesTypeOuvertes(chaineCode, idsListe) {
  set(cleGrillesTypeOuvertes(chaineCode), idsListe)
}

// Nouvelle grille type + copie des blocs de la source, grille_type_id
// remplacé, id retiré.
export async function dupliquerGrilleType(grilleType, nouveauNom, creePar) {
  const cible = await creerGrilleType({ chaine_id: grilleType.chaine_id, nom: nouveauNom, cree_par: creePar })
  const source = await listerBlocsGrilleTypeParGrilleType(grilleType.id)
  if (source.length > 0) {
    const lignes = source.map(({ id: _id, ...champs }) => ({ ...champs, grille_type_id: cible.id }))
    await creerBlocsGrilleType(lignes)
  }
  return cible
}
