import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Search, EyeOff, Eye, SquareArrowOutUpRight } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerProgrammesExclusifsAutresChaines,
  listerTousLesEpisodes,
  listerEpisodes,
  listerDiffusionsLineairesParProgramme,
  listerToutesLesFenetresDroits,
} from '../lib/db.js'
import { GENRES } from '../lib/genres.js'
import { CHAINES } from '../lib/chaines.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import { estProgrammable, estEpisodePret } from '../lib/droits.js'
import { calculerParEpisode } from '../lib/historique.js'

function formaterDuree(minutes) {
  if (minutes == null) return '—'
  return `${minutes} min`
}

// RG-07 : contrôle per-épisode, indépendant du toggle "hors droits" (qui
// porte sur le TITRE) — un épisode non prêt n'est jamais déplaçable, même si
// son titre a des droits valides.
function LigneEpisode({ episode, programmeId, dragRef, derniereDiffusion, bloqueExclu = false }) {
  const pret = estEpisodePret(episode)
  const deplacable = pret && !bloqueExclu
  return (
    <div
      draggable={deplacable}
      onDragStart={() => {
        if (!deplacable) return
        dragRef.current = { episodeId: episode.id, programmeId, numero: episode.numero, duree: episode.duree }
      }}
      title={
        bloqueExclu
          ? 'Programme exclusif à une autre chaîne — autorisation de programmation requise'
          : pret
            ? undefined
            : 'Support non prêt à diffuser (PAD) — non déplaçable'
      }
      className={`flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-xs ${
        deplacable ? 'cursor-grab hover:bg-slate-50 active:cursor-grabbing' : 'cursor-not-allowed bg-slate-50 opacity-60'
      }`}
    >
      <span className="font-mono text-slate-500">ÉP.{String(episode.numero ?? '?').padStart(2, '0')}</span>
      <span className="flex-1 truncate text-slate-700">{episode.titre || '—'}</span>
      {!pret && <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700">Non PAD</span>}
      <span className="text-slate-500">{formaterDuree(episode.duree)}</span>
      <span className="text-slate-400">{derniereDiffusion ? formaterDateLongue(derniereDiffusion) : '1ère diffusion'}</span>
    </div>
  )
}

export default function CataloguePanel({ chaineActive, dragRef, onOuvrirHistorique, onOuvrirProgramme }) {
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [masquerHorsDroits, setMasquerHorsDroits] = useState(true)
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
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerProgrammesExclusifsAutresChaines(chaineActive.id),
      listerTousLesEpisodes(),
      listerToutesLesFenetresDroits(),
    ])
      .then(([lignesProgrammes, lignesExclusifsAutres, lignesEpisodes, lignesFenetres]) => {
        // P37 : les exclusifs d'autres chaînes (non autorisés) apparaissent en
        // lecture seule, marqués `bloqueExclu`, non déplaçables.
        setProgrammes([
          ...lignesProgrammes,
          ...lignesExclusifsAutres.map((p) => ({ ...p, bloqueExclu: true })),
        ])
        setFenetresDroits(lignesFenetres)
        setEpisodes(lignesEpisodes)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const nbEpisodesParProgramme = useMemo(() => {
    const compteur = new Map()
    for (const ep of episodes) compteur.set(ep.programme_id, (compteur.get(ep.programme_id) ?? 0) + 1)
    return compteur
  }, [episodes])

  const episodesParProgrammeId = useMemo(() => {
    const map = new Map()
    for (const ep of episodes) {
      if (!map.has(ep.programme_id)) map.set(ep.programme_id, [])
      map.get(ep.programme_id).push(ep)
    }
    return map
  }, [episodes])

  // Recherche multilingue (EXG-M6-02) : titre du programme en FR/AR/EN, ou
  // titre/titre_ar d'un de ses épisodes (déjà chargés en bulk ci-dessus).
  const programmesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const qBrut = recherche.trim()
    const aujourdHui = aujourdHuiISO()
    return programmes
      .filter((p) => {
        if (!q) return true
        if (p.titre.toLowerCase().includes(q)) return true
        if ((p.titre_ar ?? '').includes(qBrut)) return true
        if ((p.titre_en ?? '').toLowerCase().includes(q)) return true
        const eps = episodesParProgrammeId.get(p.id) ?? []
        return eps.some((ep) => (ep.titre ?? '').toLowerCase().includes(q) || (ep.titre_ar ?? '').includes(qBrut))
      })
      .filter((p) => !filtreGenre || p.genre === filtreGenre)
      .filter((p) => p.bloqueExclu || !masquerHorsDroits || estProgrammable(p.id, fenetresDroits, aujourdHui).ok)
  }, [programmes, recherche, filtreGenre, masquerHorsDroits, fenetresDroits, episodesParProgrammeId])

  function basculerDepli(programme) {
    if (programmeOuvert === programme.id) {
      setProgrammeOuvert(null)
      return
    }
    setProgrammeOuvert(programme.id)
    setChargementEpisodes(true)
    Promise.all([listerEpisodes(programme.id), listerDiffusionsLineairesParProgramme(programme.id)])
      .then(([episodesDuTitre, diffusions]) => {
        setEpisodesOuverts(episodesDuTitre)
        setDernieresDiffusions(calculerParEpisode(diffusions))
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
            placeholder="Rechercher (FR/AR/EN)…"
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
        <button
          type="button"
          onClick={() => setMasquerHorsDroits((v) => !v)}
          className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium ${
            masquerHorsDroits ? 'border-snrt-navy bg-snrt-navy/5 text-snrt-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
          title="RG-03 : masque par défaut les titres non programmables (droits fermés/épuisés)"
        >
          {masquerHorsDroits ? <EyeOff size={13} /> : <Eye size={13} />}
          Masquer les titres hors droits
        </button>
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
          const droits = estProgrammable(p.id, fenetresDroits, aujourdHuiISO())
          const bloque = !!p.bloqueExclu
          const nomChaineExclu = bloque ? CHAINES.find((c) => c.id === p.chaine_id)?.nom ?? 'autre chaîne' : null
          return (
            <div key={p.id} className={`border-b border-slate-100 ${bloque ? 'bg-slate-50/70' : ''}`}>
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
                    <span className="flex items-center gap-1.5">
                      <span className="block truncate text-sm font-medium text-slate-800">{p.titre}</span>
                      {bloque ? (
                        <span
                          className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700"
                          title="Exclusif à une autre chaîne — autorisation de programmation requise"
                        >
                          Exclusif · {nomChaineExclu}
                        </span>
                      ) : (
                        !droits.ok && (
                          <span
                            className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700"
                            title={droits.motif}
                          >
                            Hors droits
                          </span>
                        )
                      )}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {p.genre || 'Genre non défini'} · {nbEpisodesParProgramme.get(p.id) ?? 0} épisode(s)
                    </span>
                  </span>
                </button>
                {onOuvrirProgramme && (
                  <button
                    type="button"
                    onClick={() => onOuvrirProgramme(p.id)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-snrt-navy"
                    title="Ouvrir la fiche du programme (demande PAD / demande de programmation)"
                  >
                    <SquareArrowOutUpRight size={14} />
                  </button>
                )}
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
                        derniereDiffusion={dernieresDiffusions.get(ep.id)?.derniere}
                        bloqueExclu={bloque}
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
