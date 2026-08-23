// Multi-documents : grilles nommées (P23). Logique composée au-dessus de
// db.js (même esprit que deprogrammation.js), pas un accès direct à Supabase.
import { listerDiffusionsLineairesParGrille, creerGrille, creerDiffusionsLineaires } from './db.js'
import { get, set } from './storage.js'

function cleGrillesOuvertes(chaineCode) {
  return `session:grilles-ouvertes:${chaineCode}`
}

export function lireGrillesOuvertes(chaineCode) {
  return get(cleGrillesOuvertes(chaineCode)) ?? []
}

export function definirGrillesOuvertes(chaineCode, idsListe) {
  set(cleGrillesOuvertes(chaineCode), idsListe)
}

// Nouvelle grille + copie des diffusions de la source (programme/épisode/
// horaires), grille_id remplacé, id retiré. Ne copie PAS les
// element_secondaire attachés (ils restent chaînés aux diffusions
// d'origine) — le Plan média a son propre mécanisme multi-documents en P24.
export async function dupliquerGrille(grille, nouveauNom, creePar) {
  const cible = await creerGrille({ chaine_id: grille.chaine_id, nom: nouveauNom, cree_par: creePar })
  const source = await listerDiffusionsLineairesParGrille(grille.id)
  if (source.length > 0) {
    const lignes = source.map(({ id: _id, ...champs }) => ({ ...champs, grille_id: cible.id }))
    await creerDiffusionsLineaires(lignes)
  }
  return cible
}
