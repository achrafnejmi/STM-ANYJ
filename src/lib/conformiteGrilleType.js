// Respect de la grille type (P43 partie B) — analyse pure, recalculée à chaque
// affichage du tableau de bord d'audit. Même recette que l'anomalie « Grille
// type » d'anomalies.js : pour chaque diffusion ayant un genre, on cherche le
// bloc de grille type LIVE actif à son heure de début, et on compare
// genre_attendu au genre gelé sur la ligne.
import { blocsActifsCeJour, trouverBlocPourMinute } from './grilleType.js'
import { jourAntenneLundi0, minutesDepuisDebutAntenne } from './semaine.js'

// `diffusions` : lignes diffusion_lineaire de la grille LIVE de la chaîne.
// `blocsGrilleType` : blocs de la grille type LIVE de la chaîne.
// `programmesParId` : Map<id, programme> — sert uniquement de repli pour le
// libellé du titre (le genre évalué reste `d.genre`, gelé au dépôt).
export function analyserConformiteGrilleType({ diffusions, blocsGrilleType, programmesParId }) {
  const lignesEcartGenre = []
  const lignesHorsBloc = []
  let nbConformes = 0
  let nbSansGenre = 0

  for (const d of diffusions) {
    const titre = d.titre_cache ?? programmesParId?.get(d.programme_id)?.titre ?? '—'
    if (!d.genre) {
      nbSansGenre += 1
      continue
    }
    const actifs = blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(d.date))
    const bloc = trouverBlocPourMinute(actifs, minutesDepuisDebutAntenne(d.heure_debut))
    if (!bloc) {
      lignesHorsBloc.push({ id: d.id, programmeId: d.programme_id, date: d.date, heure: d.heure_debut, titre, genre: d.genre })
      continue
    }
    if (bloc.genre_attendu === d.genre) {
      nbConformes += 1
      continue
    }
    lignesEcartGenre.push({
      id: d.id,
      programmeId: d.programme_id,
      date: d.date,
      heure: d.heure_debut,
      titre,
      genre: d.genre,
      genreAttendu: bloc.genre_attendu,
      blocNom: bloc.nom,
      blocId: bloc.id,
      overrideAssume: d.ecart_grille_type_accepte === true,
    })
  }

  const parDateHeure = (a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure)
  lignesEcartGenre.sort(parDateHeure)
  lignesHorsBloc.sort(parDateHeure)

  const nbEcartsGenre = lignesEcartGenre.length
  const nbHorsBloc = lignesHorsBloc.length
  const nbEvaluees = nbConformes + nbEcartsGenre // dans un bloc, avec un genre
  const tauxConformite = nbEvaluees > 0 ? Math.round((nbConformes / nbEvaluees) * 100) : 0
  const nbOverridesAssumes = lignesEcartGenre.filter((l) => l.overrideAssume).length

  return {
    nbTotal: diffusions.length,
    nbEvaluees,
    nbConformes,
    nbEcartsGenre,
    nbHorsBloc,
    nbSansGenre,
    nbOverridesAssumes,
    tauxConformite,
    lignesEcartGenre,
    lignesHorsBloc,
  }
}
