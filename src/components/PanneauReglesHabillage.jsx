import { useId } from 'react'
import { Play, Pencil, Plus } from 'lucide-react'
import { TRANCHES } from '../lib/tranches.js'

// Règles d'habillage (§4.6.2, colonne droite) : rappel de la période, 3
// cases générales (correspondant aux 3 étapes de consommation du budget,
// §4.6.5 — voir plan Phase 16, Ambiguïté 3 : le cahier ne les nomme pas et le
// mockup de référence propose une 3e case qui contredirait RG-M5-01, non
// reprise ici), durée d'un écran publicitaire (seule durée réellement
// paramétrable, EXG-M5-07), tranches commercialisées, bibliothèque de règles
// (P32/P33 — hors cahier, cantonnée à cet onglet, aucune existence côté
// Composition manuelle), bouton de lancement.
export default function PanneauReglesHabillage({
  periodeLabel,
  opts,
  onChangerOpts,
  onGenerer,
  chargement,
  regles = [],
  onNouvelleRegle,
  onEditerRegle,
  onBasculerActiveRegle,
}) {
  const idDuree = useId()

  function basculerTrancheCommercialisee(code) {
    const actuelles = opts.tranchesCommercialisees
    onChangerOpts({
      ...opts,
      tranchesCommercialisees: actuelles.includes(code) ? actuelles.filter((t) => t !== code) : [...actuelles, code],
    })
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

      {onNouvelleRegle && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Bibliothèque de règles</span>
            <button type="button" onClick={onNouvelleRegle} className="flex items-center gap-1 text-xs font-medium text-snrt-navy hover:underline">
              <Plus size={13} />
              Nouvelle règle
            </button>
          </div>
          {regles.length === 0 ? (
            <p className="text-xs text-slate-400">
              Aucune règle. Une règle ajoute automatiquement N annonces (spots/BA/écrans pub) dans les coupures dont le
              programme précédent a une durée donnée.
            </p>
          ) : (
            <div className="space-y-2">
              {regles.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => onBasculerActiveRegle(r.id, e.target.checked)}
                    title={r.active ? 'Active pour la génération auto' : 'Inactive'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-700">{r.nom}</div>
                    <div className="text-slate-400">
                      {r.duree_min_minutes}–{r.duree_max_minutes} min · {r.nombre_annonces} annonce{r.nombre_annonces > 1 ? 's' : ''} ·{' '}
                      {r.genres?.length ? r.genres.join(', ') : 'tous genres'}
                    </div>
                  </div>
                  <button type="button" onClick={() => onEditerRegle(r)} className="text-slate-400 hover:text-snrt-navy">
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
