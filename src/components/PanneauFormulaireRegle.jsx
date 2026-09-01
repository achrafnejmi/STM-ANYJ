import { useId, useState } from 'react'
import Modal from './Modal.jsx'
import { GENRES } from '../lib/genres.js'

// Création/édition d'une règle de la bibliothèque (P32/P33, onglet
// Génération auto uniquement — les règles n'existent pas côté Composition
// manuelle). `regleInitiale` : null = création, objet = édition.
export default function PanneauFormulaireRegle({ regleInitiale, spots = [], onEnregistrer, onSupprimer, onFermer }) {
  const [nom, setNom] = useState(regleInitiale?.nom ?? '')
  const [active, setActive] = useState(regleInitiale?.active ?? true)
  const [dureeMin, setDureeMin] = useState(regleInitiale?.duree_min_minutes ?? 0)
  const [dureeMax, setDureeMax] = useState(regleInitiale?.duree_max_minutes ?? 30)
  const [genres, setGenres] = useState(() => new Set(regleInitiale?.genres ?? []))
  const [annoncesInter, setAnnoncesInter] = useState(regleInitiale?.nombre_annonces ?? 1)
  const [annoncesIntra, setAnnoncesIntra] = useState(regleInitiale?.annonces_intra ?? 0)
  const [spotIds, setSpotIds] = useState(() => new Set(regleInitiale?.spot_ids ?? []))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()

  function basculer(setSet, valeur) {
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(valeur)) next.delete(valeur)
      else next.add(valeur)
      return next
    })
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (!nom.trim()) {
      setErreur('Le nom de la règle est obligatoire.')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    try {
      await onEnregistrer({
        nom: nom.trim(),
        active,
        duree_min_minutes: Number(dureeMin),
        duree_max_minutes: Number(dureeMax),
        genres: [...genres],
        nombre_annonces: Number(annoncesInter),
        annonces_intra: Number(annoncesIntra),
        spot_ids: [...spotIds],
      })
    } catch (err) {
      setErreur(err.message)
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre={regleInitiale ? 'Modifier la règle' : 'Nouvelle règle'} onFermer={onFermer}>
      <form onSubmit={enregistrer} className="space-y-4 text-sm">
        <div>
          <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
            Nom de la règle *
          </label>
          <input
            id={idNom}
            type="text"
            required
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Programmes courts 0–30 min"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active pour la génération auto
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span>Programme de</span>
          <input
            type="number"
            min="0"
            value={dureeMin}
            onChange={(e) => setDureeMin(e.target.value)}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <span>à</span>
          <input
            type="number"
            min="0"
            value={dureeMax}
            onChange={(e) => setDureeMax(e.target.value)}
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <span>min</span>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">Genres ciblés (aucun coché → tous genres)</span>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((g) => (
              <button
                key={g.fr}
                type="button"
                onClick={() => basculer(setGenres, g.fr)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  genres.has(g.fr) ? 'bg-snrt-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g.fr}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-44">Annonces entre les programmes</span>
            <input
              type="number"
              min="0"
              value={annoncesInter}
              onChange={(e) => setAnnoncesInter(e.target.value)}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">dans la coupure qui suit</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-44">Annonces dans le programme</span>
            <input
              type="number"
              min="0"
              value={annoncesIntra}
              onChange={(e) => setAnnoncesIntra(e.target.value)}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">réparties sur sa durée</span>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">Items à piocher</span>
          <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
            {spots.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">Bibliothèque de spots vide.</p>
            ) : (
              spots.map((s) => (
                <label key={s.id} className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-xs last:border-0">
                  <input type="checkbox" checked={spotIds.has(s.id)} onChange={() => basculer(setSpotIds, s.id)} />
                  <span className="flex-1 truncate text-slate-700">{s.libelle}</span>
                  <span className="text-slate-400">
                    {s.type} · {s.duree_secondes}s
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Aucune cochée → tirage dans toute la bibliothèque.</p>
        </div>

        {erreur && <p className="text-xs text-red-600">{erreur}</p>}

        <div className="flex items-center justify-between gap-2 pt-2">
          {onSupprimer ? (
            <button
              type="button"
              onClick={onSupprimer}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onFermer} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={enregistrement}
              className="rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
