// Centre d'anomalies (M8, cahier §4.9). Calcul pur recalculé à chaque rendu —
// satisfait EXG-M8-01 (« recalculées à chaque écriture, sans action de
// l'utilisateur ») sans mécanisme dédié : React redérive dès que
// `diffusions`/`blocsGrilleType` changent. Types couverts —
//   - Chevauchement (EXG-M2-06, Bloquant)
//   - Matériel (RG-08, Bloquant) : un épisode déjà programmé dont le support
//     n'est plus prêt à diffuser (episode.pad = false).
//   - Trou d'antenne (EXG-M2-07, Alerte, P13) : intervalle ≥5 min non
//     programmé dans un bloc de grille type actif. Non rattaché à une
//     transmission précise (id: null) — non cliquable dans le panneau.
//   - Grille type (EXG-M3-05, Alerte, P13) : genre du programme ≠ genre
//     attendu du bloc actif à son horaire. Ne se déclenche QUE si le
//     programme a un genre renseigné (les anciens imports sans genre ne sont
//     pas de faux écarts — décision explicite, on ne signale pas un genre
//     inconnu comme un désaccord).
// Droits (aucun modèle de droits en base, différé M6/P14) et Hors grille type
// (EXG-M3-06, Souhaitable, explicitement hors périmètre P13) restent hors
// portée — la forme du résultat (type/niveau/message) permet de les ajouter
// plus tard sans reprise.
import { minutesDepuisDebutAntenne, minutesEnHeure, jourAntenneLundi0 } from './semaine.js'
import { blocsActifsCeJour, calculerTrous, trouverBlocPourMinute } from './grilleType.js'

// RG-10..14 (P11, onglet Vecteur) : une scission crée 2 lignes indépendantes
// (TNT/SATELLITE) qui représentent le MÊME créneau sur 2 voies de diffusion
// parallèles. Leur chevauchement temporel est intentionnel, pas une vraie
// collision d'antenne — seule cette paire précise est exclue de la détection.
function estPaireVecteurExclue(a, b) {
  return (a.vecteur === 'TNT' && b.vecteur === 'SATELLITE') || (a.vecteur === 'SATELLITE' && b.vecteur === 'TNT')
}

function seChevauchent(a, b) {
  const debutA = minutesDepuisDebutAntenne(a.heure_debut)
  const finA = minutesDepuisDebutAntenne(a.heure_fin)
  const debutB = minutesDepuisDebutAntenne(b.heure_debut)
  const finB = minutesDepuisDebutAntenne(b.heure_fin)
  return finA > debutB && finB > debutA
}

// `episodesParId` : Map(episode_id -> {pad, ...}) — voir listerTousLesEpisodes.
// `blocsGrilleType` : blocs de la chaîne active (non filtrés par jour, le
// filtrage par jour se fait ici, par date affichée).
export function calculerAnomalies(diffusions, episodesParId, blocsGrilleType = []) {
  const idsEnChevauchement = new Set()

  const parJour = new Map()
  for (const d of diffusions) {
    if (!parJour.has(d.date)) parJour.set(d.date, [])
    parJour.get(d.date).push(d)
  }
  for (const lignes of parJour.values()) {
    for (let i = 0; i < lignes.length; i++) {
      for (let j = i + 1; j < lignes.length; j++) {
        const a = lignes[i]
        const b = lignes[j]
        if (estPaireVecteurExclue(a, b)) continue
        if (seChevauchent(a, b)) {
          idsEnChevauchement.add(a.id)
          idsEnChevauchement.add(b.id)
        }
      }
    }
  }

  const anomalies = []

  // Trou d'antenne : par jour affiché, sur les seuls blocs actifs ce jour-là.
  for (const [date, lignes] of parJour) {
    const actifs = blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(date))
    for (const trou of calculerTrous(actifs, lignes)) {
      anomalies.push({
        id: null,
        date,
        heure: minutesEnHeure(trou.debut),
        type: 'Trou d’antenne',
        niveau: 'alerte',
        message: `${trou.fin - trou.debut} min sans programme à ${minutesEnHeure(trou.debut)} (bloc « ${trou.bloc.nom} »)`,
      })
    }
  }

  for (const d of diffusions) {
    if (idsEnChevauchement.has(d.id)) {
      anomalies.push({
        id: d.id,
        date: d.date,
        heure: d.heure_debut,
        type: 'Chevauchement',
        niveau: 'bloquant',
        message: `${d.titre_cache} chevauche un autre bloc`,
      })
    }
    const episode = episodesParId.get(d.episode_id)
    if (episode && episode.pad === false) {
      anomalies.push({
        id: d.id,
        date: d.date,
        heure: d.heure_debut,
        type: 'Matériel',
        niveau: 'bloquant',
        message: `${d.titre_cache} — support non prêt à diffuser (PAD)`,
      })
    }

    // Écart de genre (EXG-M3-05) : uniquement si le programme a un genre
    // renseigné — un genre vide (anciens imports) n'est pas un écart.
    if (d.genre) {
      const actifsCeJour = blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(d.date))
      const bloc = trouverBlocPourMinute(actifsCeJour, minutesDepuisDebutAntenne(d.heure_debut))
      if (bloc && bloc.genre_attendu !== d.genre) {
        anomalies.push({
          id: d.id,
          date: d.date,
          heure: d.heure_debut,
          type: 'Grille type',
          niveau: 'alerte',
          message: `${d.titre_cache} dans « ${bloc.nom} » (genre attendu : ${bloc.genre_attendu})`,
        })
      }
    }
  }

  return anomalies.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure))
}

// Pour la pastille du rail (EXG-M0-08 / EXG-M8-02).
export function compterBloquantes(anomalies) {
  return anomalies.filter((a) => a.niveau === 'bloquant').length
}
