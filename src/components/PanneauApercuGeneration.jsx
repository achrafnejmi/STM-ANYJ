import { useState } from 'react'
import { CircleAlert, X } from 'lucide-react'
import { formaterDateLongue } from '../lib/semaine.js'

// Aperçu de la génération (avant écriture) : rien n'est encore en base à ce
// stade — autoprog.js n'a produit qu'une proposition. EXG-M4-06 : la
// sélection des blocs à pourvoir est libre, y compris ici, après coup (une
// case à cocher par ligne). EXG-M4-03 : chaque bloc non pourvu apparaît avec
// son motif exact. Le principe « le système propose, l'utilisateur décide »
// se joue entièrement dans ce panneau — aucune écriture avant « Confirmer ».
export default function PanneauApercuGeneration({ proposition, ecraser, nbAutomatiquesRemplacees, onConfirmer, onAnnuler, enregistrement }) {
  const { propositions, rapport } = proposition
  const [exclues, setExclues] = useState(() => new Set())

  function basculer(index) {
    setExclues((prev) => {
      const copie = new Set(prev)
      if (copie.has(index)) copie.delete(index)
      else copie.add(index)
      return copie
    })
  }

  const retenues = propositions.filter((_, i) => !exclues.has(i))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Aperçu de la génération</h2>
        <button type="button" onClick={onAnnuler} className="text-slate-400 hover:text-slate-600" title="Annuler l'aperçu, ne rien écrire">
          <X size={18} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
        <span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-700">{propositions.length} proposée(s)</span>
        <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-600">{rapport.nonPourvus.length} bloc(s) non pourvu(s)</span>
        {ecraser && nbAutomatiquesRemplacees > 0 && (
          <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-700">
            {nbAutomatiquesRemplacees} diffusion(s) automatique(s) précédente(s) seront remplacées
          </span>
        )}
      </div>

      {rapport.echeancesProches.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <CircleAlert size={13} />
            Droits proches de l'échéance (EXG-M4-08)
          </div>
          {rapport.echeancesProches.map((e) => e.titre).join(', ')}
        </div>
      )}

      {propositions.length > 0 && (
        <div className="mb-4 max-h-80 overflow-y-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pl-3 pr-2"></th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Heure</th>
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">Épisode</th>
                <th className="py-2 pr-4 font-medium">Genre</th>
              </tr>
            </thead>
            <tbody>
              {propositions.map((p, i) => (
                <tr key={`${p.date}-${p.heure_debut}-${p.programme_id}`} className={`border-b border-slate-100 ${exclues.has(i) ? 'opacity-40' : ''}`}>
                  <td className="py-1.5 pl-3 pr-2">
                    <input type="checkbox" checke d={!exclues.has(i)} onChange={() => basculer(i)} />
                  </td>
                  <td className="py-1.5 pr-4 text-slate-700">{formaterDateLongue(p.date)}</td>
                  <td className="py-1.5 pr-4 text-slate-700">{p.heure_debut}</td>
                  <td className="py-1.5 pr-4 text-slate-700">{p.titre_cache}</td>
                  <td className="py-1.5 pr-4 text-slate-500">
                    {p.episode_numero != null ? `ÉP.${String(p.episode_numero).padStart(2, '0')}` : '—'}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-500">{p.genre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rapport.nonPourvus.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Blocs non pourvus</h3>
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pl-3 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Heure</th>
                  <th className="py-2 pr-4 font-medium">Bloc</th>
                  <th className="py-2 pr-4 font-medium">Genre attendu</th>
                  <th className="py-2 pr-4 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody>
                {rapport.nonPourvus.map((n, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pl-3 pr-4 text-slate-700">{formaterDateLongue(n.date)}</td>
                    <td className="py-1.5 pr-4 text-slate-700">{n.heure}</td>
                    <td className="py-1.5 pr-4 text-slate-700">{n.bloc}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{n.genreAttendu || '—'}</td>
                    <td className="py-1.5 pr-4 text-red-600">{n.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onConfirmer(retenues)}
          disabled={enregistrement || retenues.length === 0}
          className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Écriture…' : `Confirmer (${retenues.length})`}
        </button>
        <button type="button" onClick={onAnnuler} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Annuler l'aperçu
        </button>
      </div>
    </div>
  )
}
