// Exclusivité des programmes (P22, étendu P37). `programme.chaine_id` NULL =
// partagé toutes chaînes ; non NULL = exclusif à cette chaîne. `chaines_autorisees`
// (P37) = chaînes tierces autorisées à programmer ce titre exclusif après accord
// de son détenteur (circuit demande_programmation). Calcul pur, aucun accès DB.

export function chaineAutoriseeProgramme(programme, chaineId) {
  return (
    programme.chaine_id == null ||
    programme.chaine_id === chaineId ||
    (programme.chaines_autorisees ?? []).includes(chaineId)
  )
}

export function estExclusifAutreChaine(programme, chaineId) {
  return programme.chaine_id != null && programme.chaine_id !== chaineId
}
