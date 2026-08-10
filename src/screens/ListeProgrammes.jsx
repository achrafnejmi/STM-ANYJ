import { useEffect, useId, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Search, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import { listerProgrammes, listerChaines, listerSousGenres, listerTousLesSegments } from '../lib/db.js'
import ImportSTM from './ImportSTM.jsx'

const TAILLE_PAGE = 30

export default function ListeProgrammes({ onOuvrir, onNouveau }) {
  const [programmes, setProgrammes] = useState([])
  const [segmentsParProgramme, setSegmentsParProgramme] = useState(new Map())
  const [chaines, setChaines] = useState([])
  const [sousGenres, setSousGenres] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtreChaine, setFiltreChaine] = useState('')
  const [filtreSousGenre, setFiltreSousGenre] = useState('')
  const [page, setPage] = useState(0)
  const idFiltreChaine = useId()
  const idFiltreSousGenre = useId()

  useEffect(() => {
    rafraichir()
  }, [])

  async function rafraichir() {
    setChargement(true)
    try {
      const [lignesProgrammes, lignesChaines, lignesSousGenres, lignesSegments] = await Promise.all([
        listerProgrammes(),
        listerChaines(),
        listerSousGenres(),
        listerTousLesSegments(),
      ])
      setProgrammes(lignesProgrammes)
      setChaines(lignesChaines)
      setSousGenres(lignesSousGenres)

      const parProgramme = new Map()
      for (const s of lignesSegments) {
        const entree = parProgramme.get(s.programme_id) ?? { nb: 0, derniereDiffusion: null }
        entree.nb += 1
        if (s.derniere_diffusion && (!entree.derniereDiffusion || s.derniere_diffusion > entree.derniereDiffusion)) {
          entree.derniereDiffusion = s.derniere_diffusion
        }
        parProgramme.set(s.programme_id, entree)
      }
      setSegmentsParProgramme(parProgramme)
      setPage(0)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  const filtres = useMemo(
    () =>
      programmes.filter(
        (p) => (!filtreChaine || p.chaine === filtreChaine) && (!filtreSousGenre || p.sous_genre === filtreSousGenre)
      ),
    [programmes, filtreChaine, filtreSousGenre]
  )

  const nbPages = Math.max(1, Math.ceil(filtres.length / TAILLE_PAGE))
  const pageAffichee = Math.min(page, nbPages - 1)
  const lignesPage = filtres.slice(pageAffichee * TAILLE_PAGE, (pageAffichee + 1) * TAILLE_PAGE)

  function exporterExcel() {
    const lignes = filtres.map((p) => ({
      Titre: p.titre,
      Chaîne: p.chaine,
      Genre: p.genre ?? '',
      'Sous-genre': p.sous_genre ?? '',
      'Nb segments': segmentsParProgramme.get(p.id)?.nb ?? 0,
      'Dernière diffusion': segmentsParProgramme.get(p.id)?.derniereDiffusion ?? '',
    }))
    const feuille = XLSX.utils.json_to_sheet(lignes)
    const classeur = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(classeur, feuille, 'Programmes')
    XLSX.writeFile(classeur, 'programmes.xlsx')
  }

  return (
    <div className="space-y-6">
      <details className="rounded-lg border border-slate-200 bg-white p-6">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Importer une grille (xlsx)</summary>
        <div className="mt-4">
          <ImportSTM onImportTermine={rafraichir} />
        </div>
      </details>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={idFiltreChaine} className="mb-1 block text-sm font-medium text-slate-700">
                Chaîne
              </label>
              <select
                id={idFiltreChaine}
                value={filtreChaine}
                onChange={(e) => {
                  setFiltreChaine(e.target.value)
                  setPage(0)
                }}
                className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Toutes --</option>
                {chaines.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={idFiltreSousGenre} className="mb-1 block text-sm font-medium text-slate-700">
                Sous-Genre
              </label>
              <select
                id={idFiltreSousGenre}
                value={filtreSousGenre}
                onChange={(e) => {
                  setFiltreSousGenre(e.target.value)
                  setPage(0)
                }}
                className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Tous --</option>
                {sousGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
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
                <th className="py-2 pr-4 font-medium">Nb segments</th>
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
                  <td className="py-2 pr-4 text-slate-700">{segmentsParProgramme.get(p.id)?.nb ?? 0}</td>
                  <td className="py-2 pr-4 text-slate-700">{segmentsParProgramme.get(p.id)?.derniereDiffusion || '—'}</td>
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
