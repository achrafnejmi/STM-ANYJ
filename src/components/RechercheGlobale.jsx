// Recherche globale (M10, §4.11, P19a) : overlay déclenché au clavier
// (Ctrl+K) depuis n'importe quel écran, ou par l'icône de la barre
// supérieure (TopBar.jsx). Charge ses données à l'ouverture seulement (pas
// en permanence en arrière-plan).
import { useEffect, useMemo, useState } from 'react'
import { Search, X, CheckCircle2 } from 'lucide-react'
import { listerProgrammesParChaine, listerTousLesEpisodes } from '../lib/db.js'
import { rechercherProgrammes } from '../lib/rechercheGlobale.js'

const LIMITE_RESULTATS = 20

export default function RechercheGlobale({ chaineActive, ouverte, onFermer, onOuvrirProgramme }) {
  const [requete, setRequete] = useState('')
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [chargement, setChargement] = useState(false)
  const [indexActif, setIndexActif] = useState(0)

  useEffect(() => {
    if (!ouverte) return
    setRequete('')
    setIndexActif(0)
    setChargement(true)
    Promise.all([listerProgrammesParChaine(chaineActive.id), listerTousLesEpisodes()])
      .then(([lignesProgrammes, lignesEpisodes]) => {
        setProgrammes(lignesProgrammes)
        setEpisodes(lignesEpisodes)
      })
      .finally(() => setChargement(false))
  }, [ouverte, chaineActive])

  const resultats = useMemo(
    () => rechercherProgrammes(programmes, episodes, requete).slice(0, LIMITE_RESULTATS),
    [programmes, episodes, requete]
  )

  function choisir(resultat) {
    onOuvrirProgramme(resultat.programme.id)
    onFermer()
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      onFermer()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexActif((i) => Math.min(i + 1, resultats.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexActif((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && resultats[indexActif]) choisir(resultats[indexActif])
  }

  if (!ouverte) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={onFermer}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={requete}
            onChange={(e) => {
              setRequete(e.target.value)
              setIndexActif(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un titre, un épisode, un numéro…"
            className="flex-1 text-sm outline-none"
          />
          <button type="button" onClick={onFermer} className="shrink-0 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {chargement && <p className="p-3 text-sm text-slate-500">Chargement…</p>}
          {!chargement && requete.trim() && resultats.length === 0 && (
            <p className="p-3 text-sm text-slate-500">Aucun résultat.</p>
          )}
          {!chargement && !requete.trim() && (
            <p className="p-3 text-sm text-slate-400">Tapez pour rechercher un titre ou un épisode.</p>
          )}
          {resultats.map((r, i) => (
            <button
              key={`${r.type}-${r.type === 'EPISODE' ? r.episode.id : r.programme.id}`}
              type="button"
              onClick={() => choisir(r)}
              onMouseEnter={() => setIndexActif(i)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                i === indexActif ? 'bg-snrt-navy/10' : 'hover:bg-slate-50'
              }`}
            >
              {r.type === 'PROGRAMME' ? (
                <span className="flex-1 truncate text-slate-800">{r.programme.titre}</span>
              ) : (
                <span className="flex flex-1 items-center gap-1.5 truncate">
                  <span className="font-mono text-xs text-slate-500">ÉP.{String(r.episode.numero ?? '?').padStart(2, '0')}</span>
                  <span className="truncate text-slate-800">{r.episode.titre || 'Sans titre'}</span>
                  <span className="shrink-0 text-xs text-slate-500">— {r.programme.titre}</span>
                  {r.episode.pad && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
