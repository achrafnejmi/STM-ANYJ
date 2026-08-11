import { useEffect, useState } from 'react'
import { listerDiffusionsLineairesParProgramme } from '../lib/db.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import Modal from './Modal.jsx'

// Approximation (P10) : liste diffusion_lineaire passées, pas un constat
// d'antenne réel (aucune table "Diffusion constatée" n'existe encore).
export default function PopoverHistorique({ programme, onFermer }) {
  const [diffusions, setDiffusions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    listerDiffusionsLineairesParProgramme(programme.id)
      .then((lignes) => {
        const aujourdHui = aujourdHuiISO()
        setDiffusions(lignes.filter((d) => d.date < aujourdHui))
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [programme.id])

  return (
    <Modal titre={`Diffusions planifiées (passées) — ${programme.titre}`} onFermer={onFermer}>
      {chargement && <p className="text-sm text-slate-500">Chargement…</p>}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!chargement && !erreur && diffusions.length === 0 && (
        <p className="text-sm text-slate-500">Aucune diffusion passée enregistrée pour ce titre.</p>
      )}
      {diffusions.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Heure</th>
                <th className="py-2 pr-4 font-medium">Épisode</th>
              </tr>
            </thead>
            <tbody>
              {diffusions.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-700">{formaterDateLongue(d.date)}</td>
                  <td className="py-2 pr-4 text-slate-700">{d.heure_debut}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {d.episode_numero != null ? `ÉP.${String(d.episode_numero).padStart(2, '0')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
