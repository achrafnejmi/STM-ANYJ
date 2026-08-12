// Centre d'anomalies (M8, cahier §4.9). Calcul pur recalculé à chaque rendu —
// satisfait EXG-M8-01 (« recalculées à chaque écriture, sans action de
// l'utilisateur ») sans mécanisme dédié : React redérive dès que `diffusions`
// change. Portée P12 : seuls les types dont les données existent déjà en
// base sont couverts —
//   - Chevauchement (EXG-M2-06, Bloquant)
//   - Matériel (RG-08, Bloquant) : un épisode déjà programmé dont le support
//     n'est plus prêt à diffuser (episode.pad = false).
// Droits (aucun modèle de droits en base, différé M6/P14) et Trou d'antenne /
// Grille type (nécessitent la grille type, différés M3/P13) restent hors
// périmètre — la forme du résultat (type/niveau/message) permet de les
// ajouter plus tard sans reprise.
import { minutesDepuisDebutAntenne } from './semaine.js'

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
export function calculerAnomalies(diffusions, episodesParId) {
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
  }

  return anomalies.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure))
}

// Pour la pastille du rail (EXG-M0-08 / EXG-M8-02).
export function compterBloquantes(anomalies) {
  return anomalies.filter((a) => a.niveau === 'bloquant').length
}
