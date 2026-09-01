import { useState } from 'react'
import { X, Undo2, ShieldCheck } from 'lucide-react'
import { formaterJourCourt } from '../lib/semaine.js'

const FILTRES = [
  ['tous', 'Tous'],
  ['placees', 'Placées'],
  ['vides', 'Non pourvues'],
]

// Rapport de génération (EXG-M4-03), affiché après l'écriture réelle en
// base. Même gabarit que PanneauAnomalies.jsx (panneau flottant à droite,
// badges de comptage, filtres, liste de cartes) — le pattern « liste typée
// avec niveau + compteur » existe déjà dans ce projet, pas besoin d'en
// inventer un nouveau. Le bouton « Annuler la génération » (EXG-M4-02/RG-16)
// n'est proposé que pour le run qui vient d'être créé dans cette session.
export default function PanneauRapportGeneration({ rapport, onFermer, onAnnulerGeneration, annulation }) {
  const [filtre, setFiltre] = useState('tous')

  const entrees = [
    ...rapport.placements.map((p) => ({
      cle: p.id ?? `${p.date}-${p.heure_debut}-${p.programme_id}`,
      type: 'placees',
      date: p.date,
      heure: p.heure_debut,
      titre: p.titre_cache,
      detail: p.episode_numero != null ? `ÉP.${String(p.episode_numero).padStart(2, '0')}` : null,
    })),
    ...rapport.nonPourvus.map((n, i) => ({
      cle: `vide-${i}`,
      type: 'vides',
      date: n.date,
      heure: n.heure,
      titre: n.bloc,
      detail: n.motif,
    })),
  ]
  const visibles = entrees.filter((e) => filtre === 'tous' || e.type === filtre)

  return (
    <div className="animer-entree-panneau fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Rapport de génération</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="mb-3 flex gap-2 text-xs">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{rapport.placements.length} placées</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{rapport.nonPourvus.length} non pourvues</span>
      </div>

      <button
        type="button"
        onClick={onAnnulerGeneration}
        disabled={annulation || rapport.placements.length === 0}
        className="mb-3 flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        title="Retire en une seule opération toutes les transmissions créées par cette génération"
      >
        <Undo2 size={14} />
        {annulation ? 'Annulation…' : 'Annuler la génération'}
      </button>

      <div className="mb-3 flex flex-wrap gap-1">
        {FILTRES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltre(id)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              filtre === id ? 'bg-snrt-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2">
        {visibles.map((e) => {
          const place = e.type === 'placees'
          return (
            <div
              key={e.cle}
              className={`w-full rounded-md border p-2 text-left text-xs ${
                place ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-slate-500">
                  {formaterJourCourt(e.date)} · {e.heure}
                </span>
                <span className={`rounded px-1.5 py-0.5 font-medium ${place ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {place ? 'Placée' : 'Vide'}
                </span>
              </div>
              <div className="text-slate-700">{e.titre}</div>
              {e.detail && <div className="mt-0.5 text-slate-500">{e.detail}</div>}
            </div>
          )
        })}
        {visibles.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ShieldCheck size={24} className="text-snrt-success" />
            <p className="text-sm font-semibold text-slate-700">Rien à afficher pour ce filtre</p>
          </div>
        )}
      </div>
    </div>
  )
}
