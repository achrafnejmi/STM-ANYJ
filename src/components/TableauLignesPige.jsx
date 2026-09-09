import { CornerDownRight, TriangleAlert } from 'lucide-react'
import { secondesEnHms, TYPES_ELEMENT, LIBELLES_TYPE_ELEMENT } from '../lib/importPige.js'

// Table de détail d'une pige (P36c). Les `lignes` sont au format colonnes DB
// (diffusion_reelle) — que ce soit un brouillon en mémoire ou un import
// enregistré. Lecture seule par défaut ; si `onMajLigne(ordre, champs)` est
// fourni, Type et Programme deviennent éditables (vue brouillon avant
// enregistrement). `ligneFlashId` surligne brièvement une ligne (deep-link
// depuis la fiche programme).
export default function TableauLignesPige({ lignes, ligneFlashId = null, onMajLigne = null }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-1.5 pl-3 pr-2">#</th>
            <th className="py-1.5 pr-2">Heure</th>
            <th className="py-1.5 pr-2">Durée</th>
            <th className="py-1.5 pr-2">Programme</th>
            <th className="py-1.5 pr-2">Type</th>
            <th className="py-1.5 pr-2">Genre</th>
            <th className="py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const cle = l.id ?? l.ordre
            return (
              <tr
                key={cle}
                id={`pige-ligne-${cle}`}
                className={`border-b border-slate-100 transition-colors duration-700 ${
                  cle === ligneFlashId ? 'bg-snrt-navy/10' : l.chevauchement ? 'bg-amber-50' : ''
                }`}
              >
                <td className="py-1 pl-3 pr-2 text-slate-400">{l.ordre}</td>
                <td className="whitespace-nowrap py-1 pr-2 text-slate-600">
                  {(l.heure_debut ?? '').slice(0, 8)} – {(l.heure_fin ?? '').slice(0, 8)}
                </td>
                <td className="whitespace-nowrap py-1 pr-2 text-slate-600">{secondesEnHms(l.duree_secondes)}</td>
                <td className="py-1 pr-2 text-slate-700">
                  <span className="flex items-center gap-1">
                    {l.est_sous_ligne && <CornerDownRight size={12} className="shrink-0 text-slate-400" />}
                    {onMajLigne ? (
                      <input
                        type="text"
                        value={l.programme}
                        onChange={(e) => onMajLigne(l.ordre, { programme: e.target.value })}
                        className="w-56 rounded border border-slate-300 px-1 py-0.5 text-xs"
                      />
                    ) : (
                      l.programme
                    )}
                  </span>
                </td>
                <td className="py-1 pr-2 text-slate-600">
                  {onMajLigne ? (
                    <select
                      value={l.type_element}
                      onChange={(e) => onMajLigne(l.ordre, { type_element: e.target.value })}
                      className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    >
                      {TYPES_ELEMENT.map((t) => (
                        <option key={t} value={t}>{LIBELLES_TYPE_ELEMENT[t]}</option>
                      ))}
                    </select>
                  ) : (
                    LIBELLES_TYPE_ELEMENT[l.type_element] ?? l.type_element
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">
                  {[l.code_genre, l.genre_niv1, l.genre_niv2].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="py-1 pr-2">
                  {l.chevauchement && (
                    <span title="Chevauchement avec la ligne précédente — importé tel quel.">
                      <TriangleAlert size={13} className="text-amber-600" />
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
