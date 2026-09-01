import { useState } from 'react'
import { X } from 'lucide-react'
import { formaterDateLongue } from '../lib/semaine.js'

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}

// Aperçu avant écriture — rien n'est encore en base à ce stade (planMedia.js
// n'a produit qu'une proposition). Consigne explicite de cette phase : jamais
// d'écriture directe, même principe que M4 (aperçu → confirme → annulable).
export default function PanneauApercuPlanMedia({ proposition, nbAutomatiquesRemplaces, onConfirmer, onAnnuler, enregistrement }) {
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
        <h2 className="text-base font-semibold text-slate-900">Aperçu du plan média</h2>
        <button type="button" onClick={onAnnuler} className="text-slate-400 hover:text-slate-600" title="Annuler l'aperçu, ne rien écrire">
          <X size={18} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
        <span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-700">{propositions.length} élément(s) proposé(s)</span>
        {nbAutomatiquesRemplaces > 0 && (
          <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-700">
            {nbAutomatiquesRemplaces} élément(s) automatique(s) précédent(s) seront remplacés
          </span>
        )}
      </div>

      {propositions.length > 0 && (
        <div className="mb-4 max-h-80 overflow-y-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pl-3 pr-2"></th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Heure</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Libellé</th>
              </tr>
            </thead>
            <tbody>
              {propositions.map((p, i) => (
                <tr key={`${p.date}-${p.heure_debut}-${i}`} className={`border-b border-slate-100 ${exclues.has(i) ? 'opacity-40' : ''}`}>
                  <td className="py-1.5 pl-3 pr-2">
                    <input type="checkbox" checked={!exclues.has(i)} onChange={() => basculer(i)} />
                  </td>
                  <td className="py-1.5 pr-4 text-slate-700">{formaterDateLongue(p.date)}</td>
                  <td className="py-1.5 pr-4 text-slate-700">{p.heure_debut}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{LIBELLES_TYPE[p.type] ?? p.type}</td>
                  <td className="py-1.5 pr-4 text-slate-700">{p.libelle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rapport.causesNonCouvertes.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Campagnes non couvertes</h3>
          <div className="space-y-1">
            {rapport.causesNonCouvertes.map((c) => (
              <div key={c.campagne_id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <span className="font-medium">{c.titre}</span> — {c.placees}/{c.objectif} — {c.motif}
              </div>
            ))}
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
