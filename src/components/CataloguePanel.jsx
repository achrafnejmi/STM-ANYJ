import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { listerProgrammesParChaine, listerTousLesEpisodes, listerEpisodes, listerDiffusionsLineairesParProgramme } from '../lib/db.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'

function formaterDuree(minutes) {
  if (minutes == null) return '—'
  return `${minutes} min`
}

// Épisode(s) d'un programme, chacun draggable (payload dans dragRef, pas de
// dataTransfer — source et cible sont dans le même document).
function LigneEpisode({ episode, programmeId, dragRef, derniereDiffusion }) {
  return (
    <div
      draggable
      onDragStart={() => {
        dragRef.current = { episodeId: episode.id, programmeId, numero: episode.numero, duree: episode.duree }
      }}
      className="flex cursor-grab items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-xs hover:bg-slate-50 active:cursor-grabbing"
    >
      <span className="font-mono text-slate-500">ÉP.{String(episode.numero ?? '?').padStart(2, '0')}</span>
      <span className="flex-1 truncate text-slate-700">{episode.titre || '—'}</span>
      <span className="text-slate-500">{formaterDuree(episode.duree)}</span>
      <span className="text-slate-400">{derniereDiffusion ? formaterDateLongue(derniereDiffusion) : '1ère diffusion'}</span>
    </div>
  )
}

export default function CataloguePanel({ chaineActive, dragRef, onOuvrirHistorique }) {
  const [programmes, setProgrammes] = useState([])
  const [nbEpisodesParProgramme, setNbEpisodesParProgramme] = useState(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [filtreGenre, setFiltreGenre] = useState('')
  const [programmeOuvert, setProgrammeOuvert] = useState(null)
  const [episodesOuverts, setEpisodesOuverts] = useState([])
  const [dernieresDiffusions, setDernieresDiffusions] = useState(new Map())
  const [chargementEpisodes, setChargementEpisodes] = useState(false)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setProgrammeOuvert(null)
    Promise.all([listerProgrammesParChaine(chaineActive.id), listerTousLesEpisodes()])
      .then(([lignesProgrammes, lignesEpisodes]) => {
        setProgrammes(lignesProgrammes)
        const compteur = new Map()
        for (const ep of lignesEpisodes) {
          compteur.set(ep.programme_id, (compteur.get(ep.programme_id) ?? 0) + 1)
        }
        setNbEpisodesParProgramme(compteur)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const programmesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return programmes
      .filter((p) => !q || p.titre.toLowerCase().includes(q) || (p.titre_ar ?? '').includes(recherche.trim()))
      .filter((p) => !filtreGenre || p.genre === filtreGenre)
  }, [programmes, recherche, filtreGenre])

  function basculerDepli(programme) {
    if (programmeOuvert === programme.id) {
      setProgrammeOuvert(null)
      return
    }
    setProgrammeOuvert(programme.id)
    setChargementEpisodes(true)
    Promise.all([listerEpisodes(programme.id), listerDiffusionsLineairesParProgramme(programme.id)])
      .then(([episodes, diffusions]) => {
        const aujourdHui = aujourdHuiISO()
        const derniere = new Map()
        for (const d of diffusions) {
          if (d.date >= aujourdHui || d.episode_id == null) continue
          if (!derniere.has(d.episode_id) || d.date > derniere.get(d.episode_id)) {
            derniere.set(d.episode_id, d.date)
          }
        }
        setEpisodesOuverts(episodes)
        setDernieresDiffusions(derniere)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargementEpisodes(false))
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (FR/AR)…"
            className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-sm"
          />
        </div>
        <select
          value={filtreGenre}
          onChange={(e) => setFiltreGenre(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">-- Tous les genres --</option>
          {GENRES.map((g) => (
            <option key={g.fr} value={g.fr}>
              {g.fr}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chargement && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
        {erreur && <p className="p-3 text-sm text-red-600">{erreur}</p>}
        {!chargement && programmesFiltres.length === 0 && (
          <p className="p-3 text-sm text-slate-500">Aucun programme.</p>
        )}
        {programmesFiltres.map((p) => {
          const { fond, texte } = couleurGenre(p.genre)
          const ouvert = programmeOuvert === p.id
          return (
            <div key={p.id} className="border-b border-slate-100">
              <div className="flex items-center gap-1.5 p-2">
                <button
                  type="button"
                  onClick={() => basculerDepli(p)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                  title={ouvert ? 'Replier les épisodes' : 'Déplier les épisodes'}
                >
                  <ChevronRight size={16} className={`transition-transform ${ouvert ? 'rotate-90' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onOuvrirHistorique(p)}
                  className="flex flex-1 items-center gap-2 text-left"
                  title="Voir les diffusions passées"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold ${fond} ${texte}`}
                  >
                    {p.titre?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{p.titre}</span>
                    <span className="block text-xs text-slate-500">
                      {p.genre || 'Genre non défini'} · {nbEpisodesParProgramme.get(p.id) ?? 0} épisode(s)
                    </span>
                  </span>
                </button>
              </div>
              {ouvert && (
                <div className="pb-1">
                  {chargementEpisodes ? (
                    <p className="px-3 py-1.5 text-xs text-slate-500">Chargement des épisodes…</p>
                  ) : episodesOuverts.length === 0 ? (
                    <p className="px-3 py-1.5 text-xs text-slate-500">Aucun épisode pour ce titre.</p>
                  ) : (
                    episodesOuverts.map((ep) => (
                      <LigneEpisode
                        key={ep.id}
                        episode={ep}
                        programmeId={p.id}
                        dragRef={dragRef}
                        derniereDiffusion={dernieresDiffusions.get(ep.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
