import { useId } from 'react'
import { Play } from 'lucide-react'
import { TRANCHES } from '../lib/tranches.js'

// Règles d'habillage (§4.6.2, colonne droite) : rappel de la période, 3
// cases générales (correspondant aux 3 étapes de consommation du budget,
// §4.6.5 — voir plan Phase 16, Ambiguïté 3 : le cahier ne les nomme pas et le
// mockup de référence propose une 3e case qui contredirait RG-M5-01, non
// reprise ici), durée d'un écran publicitaire (seule durée réellement
// paramétrable, EXG-M5-07), tranches commercialisées, bouton de lancement.
export default function PanneauReglesHabillage({
  periodeLabel,
  opts,
  onChangerOpts,
  onGenerer,
  chargement,
  regle,
  spots = [],
  onChangerRegle,
}) {
  const idDuree = useId()

  function basculerTrancheCommercialisee(code) {
    const actuelles = opts.tranchesCommercialisees
    onChangerOpts({
      ...opts,
      tranchesCommercialisees: actuelles.includes(code) ? actuelles.filter((t) => t !== code) : [...actuelles, code],
    })
  }

  function basculerSpotRegle(id) {
    const actuels = regle?.spot_ids ?? []
    onChangerRegle({ spot_ids: actuels.includes(id) ? actuels.filter((s) => s !== id) : [...actuels, id] })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-base font-semibold text-slate-900">Règles d'habillage</h2>
      <p className="mb-4 text-sm text-slate-500">{periodeLabel}</p>

      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={opts.habillageActif}
            onChange={(e) => onChangerOpts({ ...opts, habillageActif: e.target.checked })}
          />
          Habillage actif
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={opts.ecranPubActif}
            onChange={(e) => onChangerOpts({ ...opts, ecranPubActif: e.target.checked })}
          />
          Écran publicitaire actif
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={opts.bandesAnnoncesActives}
            onChange={(e) => onChangerOpts({ ...opts, bandesAnnoncesActives: e.target.checked })}
          />
          Bandes-annonces actives
        </label>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label htmlFor={idDuree} className="mb-1 block text-sm font-medium text-slate-700">
          Durée d'un écran publicitaire (secondes)
        </label>
        <input
          id={idDuree}
          type="number"
          min="1"
          value={opts.dureeEcranSecondes}
          onChange={(e) => onChangerOpts({ ...opts, dureeEcranSecondes: Number(e.target.value) })}
          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <span className="mb-2 block text-sm font-medium text-slate-700">Tranches commercialisées</span>
        <div className="flex flex-wrap gap-1.5">
          {TRANCHES.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => basculerTrancheCommercialisee(t.code)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                opts.tranchesCommercialisees.includes(t.code)
                  ? 'bg-snrt-navy text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {regle && onChangerRegle && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={regle.active}
              onChange={(e) => onChangerRegle({ active: e.target.checked })}
            />
            Règle par durée de programme — activer pour la génération auto
          </label>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span>Programme de</span>
              <input
                type="number"
                min="0"
                value={regle.duree_min_minutes}
                onChange={(e) => onChangerRegle({ duree_min_minutes: Number(e.target.value) })}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <span>à</span>
              <input
                type="number"
                min="0"
                value={regle.duree_max_minutes}
                onChange={(e) => onChangerRegle({ duree_max_minutes: Number(e.target.value) })}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <span>min</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Nombre d'annonces à ajouter</span>
              <input
                type="number"
                min="0"
                value={regle.nombre_annonces}
                onChange={(e) => onChangerRegle({ nombre_annonces: Number(e.target.value) })}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-500">Items à piocher</span>
              <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
                {spots.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-400">Bibliothèque de spots vide.</p>
                ) : (
                  spots.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-xs last:border-0">
                      <input
                        type="checkbox"
                        checked={(regle.spot_ids ?? []).includes(s.id)}
                        onChange={() => basculerSpotRegle(s.id)}
                      />
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
            <p className="text-xs text-slate-400">
              Cette règle est aussi applicable manuellement depuis l'onglet Composition (bouton « Appliquer la règle »).
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onGenerer}
        disabled={chargement}
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
      >
        <Play size={16} />
        Générer
      </button>
    </div>
  )
}
