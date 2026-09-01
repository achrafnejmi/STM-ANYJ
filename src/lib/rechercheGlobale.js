// Recherche globale (M10, §4.11, P19a). Pur : aucune écriture, aucun accès
// Supabase. Factorise la logique de correspondance déjà écrite (et dupliquée)
// dans ListeProgrammes.jsx/CataloguePanel.jsx (P14b) — ces deux écrans
// gardent leur filtre inline tel quel, seule cette nouvelle brique consomme
// cette fonction (pas de refactor de l'existant, périmètre inchangé).
//
// EXG-M10-02 : titres FR/AR/EN + titres d'épisodes + numéros d'épisodes.
// La recherche par « référence de support » (aussi listée par l'exigence)
// reste sans effet : episode.reference_support n'existe pas dans Snomark
// (même gap déjà signalé en P17), pas une omission de cette fonction.
//
// Renvoie une liste plate de résultats navigables — un programme ET,
// séparément, chacun de ses épisodes qui correspond peuvent tous deux
// apparaître : ce sont deux résultats distincts, pas un doublon.
export function rechercherProgrammes(programmes, episodes, requete) {
  const q = requete.trim().toLowerCase()
  if (!q) return []

  const episodesParProgrammeId = new Map()
  for (const ep of episodes) {
    if (!episodesParProgrammeId.has(ep.programme_id)) episodesParProgrammeId.set(ep.programme_id, [])
    episodesParProgrammeId.get(ep.programme_id).push(ep)
  }

  const resultats = []
  for (const p of programmes) {
    const matchTitre =
      (p.titre ?? '').toLowerCase().includes(q) ||
      (p.titre_ar ?? '').includes(requete.trim()) ||
      (p.titre_en ?? '').toLowerCase().includes(q)
    if (matchTitre) resultats.push({ type: 'PROGRAMME', programme: p })

    for (const ep of episodesParProgrammeId.get(p.id) ?? []) {
      const matchEpisode =
        (ep.titre ?? '').toLowerCase().includes(q) ||
        (ep.titre_ar ?? '').includes(requete.trim()) ||
        (ep.numero != null && String(ep.numero) === requete.trim())
      if (matchEpisode) resultats.push({ type: 'EPISODE', programme: p, episode: ep })
    }
  }
  return resultats
}
