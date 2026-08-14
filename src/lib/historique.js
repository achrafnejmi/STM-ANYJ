// Historique de diffusion (M6, P14b). Calcul pur, recalculé à chaque rendu —
// même famille que droits.js/anomalies.js.
//
// Cadrage confirmé : Snomark n'a aucun constat d'antenne réel. "Historique" =
// consolidation des diffusion_lineaire dont date < aujourd'hui (aucune donnée
// d'audience n'est fabriquée — pas de source de mesure dans ce PoC).
import { aujourdHuiISO } from './semaine.js'

// Map<episode_id, { nb, derniere }> — généralise le calcul déjà présent dans
// CataloguePanel.jsx (qui ne gardait que la dernière date, pas le nombre).
export function calculerParEpisode(diffusions) {
  const aujourdHui = aujourdHuiISO()
  const parEpisode = new Map()
  for (const d of diffusions) {
    if (d.date >= aujourdHui || d.episode_id == null) continue
    const entree = parEpisode.get(d.episode_id) ?? { nb: 0, derniere: null }
    entree.nb += 1
    if (!entree.derniere || d.date > entree.derniere) entree.derniere = d.date
    parEpisode.set(d.episode_id, entree)
  }
  return parEpisode
}

// Map<programme_id, dateISO> — pour la colonne "Dernière diffusion" de
// ListeProgrammes.jsx (remplace la lecture de l'ancienne colonne statique
// episode.derniere_diffusion, jamais recalculée).
export function calculerDerniereParProgramme(diffusions) {
  const aujourdHui = aujourdHuiISO()
  const derniere = new Map()
  for (const d of diffusions) {
    if (d.date >= aujourdHui) continue
    const actuelle = derniere.get(d.programme_id)
    if (!actuelle || d.date > actuelle) derniere.set(d.programme_id, d.date)
  }
  return derniere
}

// Diffusion / Rediffusion (règle proposée en P14b, confirmée — aucune RG
// explicite dans le cahier) : au niveau de l'épisode, la 1re occurrence
// chronologique est "Diffusion", toute occurrence ultérieure du même épisode
// est "Rediffusion". Retourne un nouveau tableau (même ordre que l'entrée),
// chaque ligne enrichie d'un champ `.nature`.
export function annoterNature(diffusionsDuTitre) {
  const tri = [...diffusionsDuTitre].sort((a, b) =>
    (a.date + a.heure_debut).localeCompare(b.date + b.heure_debut)
  )
  const vus = new Set()
  const natureParId = new Map()
  for (const d of tri) {
    natureParId.set(d.id, vus.has(d.episode_id) ? 'Rediffusion' : 'Diffusion')
    vus.add(d.episode_id)
  }
  return diffusionsDuTitre.map((d) => ({ ...d, nature: natureParId.get(d.id) }))
}
