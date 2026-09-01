import { Undo2 } from 'lucide-react'
import { TRANCHES } from '../lib/tranches.js'

// Rapport de couverture (§4.6.2, EXG-M5-04/05) : une barre de progression
// par campagne (placées/objectif), répartition par tranche, cause exacte
// quand l'objectif n'est pas atteint. Bouton « Annuler la génération »
// (EXG-M5-02/RG-16) : ne retire que les éléments du run qui vient d'être
// écrit dans cette session.
export default function PanneauCouvertureCampagnes({ campagnes, programmesParId, couverture, causesNonCouvertes, onAnnulerGeneration, annulation }) {
  const motifParCampagne = new Map(causesNonCouvertes.map((c) => [c.campagne_id, c.motif]))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Rapport de couverture</h2>
        <button
          type="button"
          onClick={onAnnulerGeneration}
          disabled={annulation}
          className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          title="Retire en une seule opération tous les éléments créés par cette génération"
        >
          <Undo2 size={14} />
          {annulation ? 'Annulation…' : 'Annuler la génération'}
        </button>
      </div>

      <div className="space-y-4">
        {campagnes.map((c) => {
          const cov = couverture.get(c.id) ?? { placees: 0, objectif: c.objectif, parTranche: new Map() }
          const pct = cov.objectif > 0 ? Math.min(100, Math.round((cov.placees / cov.objectif) * 100)) : 0
          const titre = programmesParId.get(c.programme_id)?.titre ?? '—'
          const motif = motifParCampagne.get(c.id)
          return (
            <div key={c.id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{titre}</span>
                <span className="text-slate-500">
                  {cov.placees}/{cov.objectif}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-snrt-navy'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {TRANCHES.map((t) => (
                  <span key={t.code}>
                    {t.label} : {cov.parTranche.get(t.code) ?? 0}
                  </span>
                ))}
              </div>
              {motif && <p className="mt-2 text-xs text-amber-700">{motif}</p>}
            </div>
          )
        })}
        {campagnes.length === 0 && <p className="text-sm text-slate-500">Aucune campagne sur cette chaîne.</p>}
      </div>
    </div>
  )
}
