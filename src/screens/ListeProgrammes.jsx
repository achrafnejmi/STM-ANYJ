import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Search, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import { listerProgrammesParChaine, listerTousLesEpisodes, listerDiffusionsLineairesParChaine } from '../lib/db.js'
import { GENRES } from '../lib/genres.js'
import { calculerDerniereParProgramme } from '../lib/historique.js'
import { formaterDateLongue, formaterDureeMinutes } from '../lib/semaine.js'

const TAILLE_PAGE = 30

export default function ListeProgrammes({ chaineActive, onOuvrir, onNouveau }) {
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtreGenre, setFiltreGenre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(0)
  const idFiltreGenre = useId()
  const idRecherche = useId()
  const requeteId = useRef(0)

  useEffect(() => {
    rafraichir()
  }, [chaineActive])

  // La liste principale (listerProgrammesParChaine) est appliquée dès qu'elle résout,
  // indépendamment des requêtes annexes (épisodes, diffusions) — un échec annexe ne
  // doit jamais vider la liste. `requeteId` ignore les réponses d'un appel dépassé
  // par un rafraîchissement plus récent.
  async function rafraichir() {
    const idAppel = ++requeteId.current
    setChargement(true)
    setErreur(null)

    const principale = listerProgrammesParChaine(chaineActive.id)
      .then((lignes) => {
        if (idAppel !== requeteId.current) return
        setProgrammes(lignes)
        setPage(0)
      })
      .catch((err) => {
        if (idAppel !== requeteId.current) return
        setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === requeteId.current) setChargement(false)
      })

    // Annexes : comptage d'épisodes + recherche multilingue (EXG-M6-02) et
    // "Dernière diffusion" dynamique à partir de diffusion_lineaire (P14b —
    // remplace l'ancienne colonne statique episode.derniere_diffusion,
    // jamais recalculée depuis la suppression de l'import xlsx).
    const annexes = Promise.all([listerTousLesEpisodes(), listerDiffusionsLineairesParChaine(chaineActive.id)])
      .then(([lignesEpisodes, lignesDiffusions]) => {
        if (idAppel !== requeteId.current) return
        setEpisodes(lignesEpisodes)
        setDiffusions(lignesDiffusions)
      })
      .catch((err) => {
        console.error('Filtres/agrégats indisponibles, la liste principale reste affichée :', err)
      })

    await Promise.all([principale, annexes])
  }

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

  const derniereDiffusionParProgramme = useMemo(() => calculerDerniereParProgramme(diffusions), [diffusions])

  // Durée moyenne (P21 Lot A) : Σ durées épisodes ÷ nb épisodes, null si aucun épisode.
  const dureeMoyenneParProgramme = useMemo(() => {
    const map = new Map()
    for (const [programmeId, eps] of episodesParProgrammeId) {
      if (eps.length === 0) continue
      const somme = eps.reduce((acc, ep) => acc + (ep.duree ?? 0), 0)
      map.set(programmeId, somme / eps.length)
    }
    return map
  }, [episodesParProgrammeId])

  useEffect(() => {
    setPage(0)
  }, [filtreGenre, recherche])

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const qBrut = recherche.trim()
    return programmes.filter((p) => {
      if (filtreGenre && p.genre !== filtreGenre) return false
      if (!q) return true
      if (p.titre.toLowerCase().includes(q)) return true
      if ((p.titre_ar ?? '').includes(qBrut)) return true
      if ((p.titre_en ?? '').toLowerCase().includes(q)) return true
      const eps = episodesParProgrammeId.get(p.id) ?? []
      return eps.some((ep) => (ep.titre ?? '').toLowerCase().includes(q) || (ep.titre_ar ?? '').includes(qBrut))
    })
  }, [programmes, filtreGenre, recherche, episodesParProgrammeId])

  const nbPages = Math.max(1, Math.ceil(filtres.length / TAILLE_PAGE))
  const pageAffichee = Math.min(page, nbPages - 1)
  const lignesPage = filtres.slice(pageAffichee * TAILLE_PAGE, (pageAffichee + 1) * TAILLE_PAGE)

  function exporterExcel() {
    try {
      const lignes = filtres.map((p) => ({
        Titre: p.titre,
        Chaîne: p.chaine,
        Genre: p.genre ?? '',
        'Durée moyenne': formaterDureeMinutes(dureeMoyenneParProgramme.get(p.id)),
        'Nb épisodes': nbEpisodesParProgramme.get(p.id) ?? 0,
        'Dernière diffusion': derniereDiffusionParProgramme.get(p.id) ?? '',
      }))
      const feuille = XLSX.utils.json_to_sheet(lignes)
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Programmes')
      XLSX.writeFile(classeur, 'programmes.xlsx')
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={idRecherche} className="mb-1 block text-sm font-medium text-slate-700">
                Recherche
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id={idRecherche}
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Titre (FR/AR/EN) ou épisode…"
                  className="w-64 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor={idFiltreGenre} className="mb-1 block text-sm font-medium text-slate-700">
                Genre
              </label>
              <select
                id={idFiltreGenre}
                value={filtreGenre}
                onChange={(e) => setFiltreGenre(e.target.value)}
                className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Tous --</option>
                {GENRES.map((g) => (
                  <option key={g.fr} value={g.fr}>
                    {g.fr}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exporterExcel}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
              title="Exporter en Excel"
            >
              <FileSpreadsheet size={16} />
              Exporter
            </button>
            <button
              type="button"
              onClick={onNouveau}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              <Plus size={16} />
              Nouveau programme
            </button>
          </div>
        </div>

        {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">Chaîne</th>
                <th className="py-2 pr-4 font-medium">Genre</th>
                <th className="py-2 pr-4 font-medium">Durée moyenne</th>
                <th className="py-2 pr-4 font-medium">Nb épisodes</th>
                <th className="py-2 pr-4 font-medium">Dernière diffusion</th>
              </tr>
            </thead>
            <tbody>
              {lignesPage.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onOuvrir(p.id)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-2 pr-4 text-slate-700">{p.titre}</td>
                  <td className="py-2 pr-4 text-slate-700">{p.chaine}</td>
                  <td className="py-2 pr-4 text-slate-700">{p.genre || '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{formaterDureeMinutes(dureeMoyenneParProgramme.get(p.id))}</td>
                  <td className="py-2 pr-4 text-slate-700">{nbEpisodesParProgramme.get(p.id) ?? 0}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {derniereDiffusionParProgramme.get(p.id) ? formaterDateLongue(derniereDiffusionParProgramme.get(p.id)) : '—'}
                  </td>
                </tr>
              ))}
              {!chargement && lignesPage.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-slate-500">
                    Aucun programme.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
          <span>
            Page {pageAffichee + 1} sur {nbPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageAffichee === 0}
            className="rounded-md border border-slate-300 p-1.5 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(nbPages - 1, p + 1))}
            disabled={pageAffichee >= nbPages - 1}
            className="rounded-md border border-slate-300 p-1.5 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
