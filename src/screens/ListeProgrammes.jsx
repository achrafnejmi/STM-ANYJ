import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Search, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import { listerProgrammesParChaine, listerTousLesEpisodes } from '../lib/db.js'
import { GENRES } from '../lib/genres.js'

const TAILLE_PAGE = 30

export default function ListeProgrammes({ chaineActive, onOuvrir, onNouveau }) {
  const [programmes, setProgrammes] = useState([])
  const [episodesParProgramme, setEpisodesParProgramme] = useState(new Map())
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtreGenre, setFiltreGenre] = useState('')
  const [page, setPage] = useState(0)
  const idFiltreGenre = useId()
  const requeteId = useRef(0)

  useEffect(() => {
    rafraichir()
  }, [chaineActive])

  // La liste principale (listerProgrammes) est appliquée dès qu'elle résout,
  // indépendamment de la requête annexe (épisodes) — un échec annexe ne doit
  // jamais vider la liste. `requeteId` ignore les réponses d'un appel dépassé
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

    // DETTE CONNUE (P10) : "Dernière diffusion" ici vient de episode.derniere_diffusion,
    // une colonne statique jamais recalculée par le code applicatif (seul l'import
    // xlsx, supprimé, l'écrivait). C'est donc une valeur figée, potentiellement
    // périmée — contrairement au calcul dynamique introduit en P10 pour le
    // catalogue de la grille (basé sur diffusion_lineaire réellement créées).
    // Les deux sources ne sont volontairement pas unifiées dans cette phase
    // (hors périmètre) — à reprendre en P14 (Catalogue/fiche titre) ou P21.
    const annexes = listerTousLesEpisodes()
      .then((lignesEpisodes) => {
        if (idAppel !== requeteId.current) return

        const parProgramme = new Map()
        for (const ep of lignesEpisodes) {
          const entree = parProgramme.get(ep.programme_id) ?? { nb: 0, derniereDiffusion: null }
          entree.nb += 1
          if (ep.derniere_diffusion && (!entree.derniereDiffusion || ep.derniere_diffusion > entree.derniereDiffusion)) {
            entree.derniereDiffusion = ep.derniere_diffusion
          }
          parProgramme.set(ep.programme_id, entree)
        }
        setEpisodesParProgramme(parProgramme)
      })
      .catch((err) => {
        console.error('Filtres/agrégats indisponibles, la liste principale reste affichée :', err)
      })

    await Promise.all([principale, annexes])
  }

  const filtres = useMemo(
    () => programmes.filter((p) => !filtreGenre || p.genre === filtreGenre),
    [programmes, filtreGenre]
  )

  const nbPages = Math.max(1, Math.ceil(filtres.length / TAILLE_PAGE))
  const pageAffichee = Math.min(page, nbPages - 1)
  const lignesPage = filtres.slice(pageAffichee * TAILLE_PAGE, (pageAffichee + 1) * TAILLE_PAGE)

  function exporterExcel() {
    try {
      const lignes = filtres.map((p) => ({
        Titre: p.titre,
        Chaîne: p.chaine,
        Genre: p.genre ?? '',
        'Sous-genre': p.sous_genre ?? '',
        'Nb épisodes': episodesParProgramme.get(p.id)?.nb ?? 0,
        'Dernière diffusion': episodesParProgramme.get(p.id)?.derniereDiffusion ?? '',
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
              <label htmlFor={idFiltreGenre} className="mb-1 block text-sm font-medium text-slate-700">
                Genre
              </label>
              <select
                id={idFiltreGenre}
                value={filtreGenre}
                onChange={(e) => {
                  setFiltreGenre(e.target.value)
                  setPage(0)
                }}
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
            <button
              type="button"
              onClick={() => setPage(0)}
              className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              <Search size={16} />
              Rechercher
            </button>
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
                <th className="py-2 pr-4 font-medium">Sous-genre</th>
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
                  <td className="py-2 pr-4 text-slate-700">{p.sous_genre || '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{episodesParProgramme.get(p.id)?.nb ?? 0}</td>
                  <td className="py-2 pr-4 text-slate-700">{episodesParProgramme.get(p.id)?.derniereDiffusion || '—'}</td>
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
