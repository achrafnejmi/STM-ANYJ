// Helpers purs pour la grille type (M3, P13) — partagés par l'écran CRUD
// (GrilleType.jsx), les bandes de fond du plan (GrilleLineaire.jsx) et le
// calcul des trous d'antenne (anomalies.js).
import { minutesDepuisDebutAntenne, jourAntenneLundi0 } from './semaine.js'

// `jourLundi0` : 0=lundi..6=dimanche (même convention que joursSelonJoursSemaine, P11).
export function blocsActifsCeJour(blocs, jourLundi0) {
  return blocs.filter((b) => b.jours.includes(jourLundi0))
}

// Trou d'antenne (EXG-M2-07) : tout intervalle ≥5 min non couvert PAR UNE
// TRANSMISSION à l'intérieur d'un bloc de grille type actif. Calculé par
// soustraction d'intervalles (fusion des plages occupées qui intersectent le
// bloc, puis émission de chaque sous-intervalle non couvert) plutôt que par la
// simple heuristique « écart entre deux transmissions adjacentes » du mockup —
// celle-ci rate le trou entre le début du bloc et la 1ère transmission, celui
// entre la dernière transmission et la fin du bloc, et un bloc entièrement
// vide (aucune transmission dedans, donc aucune paire à comparer).
// `blocsActifs`/`diffusionsJour` : déjà filtrés sur le jour concerné par l'appelant.
export function calculerTrous(blocsActifs, diffusionsJour) {
  const trous = []
  for (const bloc of blocsActifs) {
    const debutBloc = minutesDepuisDebutAntenne(bloc.heure_debut)
    const finBloc = minutesDepuisDebutAntenne(bloc.heure_fin)

    const occupes = diffusionsJour
      .map((d) => [minutesDepuisDebutAntenne(d.heure_debut), minutesDepuisDebutAntenne(d.heure_fin)])
      .filter(([s, e]) => e > debutBloc && s < finBloc)
      .map(([s, e]) => [Math.max(s, debutBloc), Math.min(e, finBloc)])
      .sort((a, b) => a[0] - b[0])

    let curseur = debutBloc
    for (const [s, e] of occupes) {
      if (s - curseur >= 5) trous.push({ bloc, debut: curseur, fin: s })
      curseur = Math.max(curseur, e)
    }
    if (finBloc - curseur >= 5) trous.push({ bloc, debut: curseur, fin: finBloc })
  }
  return trous
}

// Bloc actif à une minute d'antenne donnée (pour l'écart de genre, EXG-M3-05).
export function trouverBlocPourMinute(blocsActifs, minuteAntenne) {
  return (
    blocsActifs.find((b) => {
      const debut = minutesDepuisDebutAntenne(b.heure_debut)
      const fin = minutesDepuisDebutAntenne(b.heure_fin)
      return minuteAntenne >= debut && minuteAntenne < fin
    }) ?? null
  )
}

// --- Écart de genre au moment du geste (P43 partie A) -----------------------

// Bloc de grille type actif pour un dépôt (date ISO + heure d'horloge "HH:MM").
export function blocGrilleTypePour(blocsGrilleType, dateISO, heureHHMM) {
  const actifs = blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(dateISO))
  return trouverBlocPourMinute(actifs, minutesDepuisDebutAntenne(heureHHMM))
}

// Le bloc en écart, ou null : genre absent, aucun bloc actif à cet instant, ou
// genre conforme. Même comparaison stricte que l'anomalie « Grille type »
// (anomalies.js) : égalité de chaîne exacte sur le libellé FR du genre.
export function blocEnEcartDeGenre(genre, blocsGrilleType, dateISO, heureHHMM) {
  if (!genre) return null
  const bloc = blocGrilleTypePour(blocsGrilleType, dateISO, heureHHMM)
  return bloc && bloc.genre_attendu !== genre ? bloc : null
}

export function messageEcartGenre(titre, genre, bloc) {
  return `« ${titre} » est un ${genre} ; le bloc « ${bloc.nom} » de la grille type attend un ${bloc.genre_attendu}. Programmer quand même ?`
}
