import { useEffect, useState } from 'react'
import { listerDiffusionsLineairesParProgramme, listerEpisodes } from '../lib/db.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import { calculerParEpisode, annoterNature } from '../lib/historique.js'

function libelleVecteur(vecteur) {
  if (vecteur === 'SATELLITE') return 'Satellite'
  if (vecteur === 'TNT') return 'TNT'
  return 'Unifié'
}

// Historique de diffusion d'un titre (EXG-M6-01, M6-04, onglet Historique de
// la fiche, P14b). Snomark n'a aucun constat d'antenne réel : "historique" =
// consolidation des diffusion_lineaire passées (voir historique.js). Aucune
// pagination (EXG-M6-01 « sans limitation de nombre ») — conteneur scrollable
// uniquement, même pattern que PopoverHistorique.jsx/GrilleLineaire.jsx.
export default function HistoriqueTitrePanel({ programmeId }) {
  const [diffusions, setDiffusions] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    Promise.all([listerDiffusionsLineairesParProgramme(programmeId), listerEpisodes(programmeId)])
      .then(([lignesDiffusions, lignesEpisodes]) => {
        setDiffusions(lignesDiffusions)
        setEpisodes(lignesEpisodes)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [programmeId])

  const aujourdHui = aujourdHuiISO()
  // Déjà triées date/heure décroissantes par listerDiffusionsLineairesParProgramme ;
  // annoterNature conserve cet ordre (le tri chronologique croissant n'a lieu
  // qu'en interne, pour déterminer la 1re occurrence de chaque épisode).
  const passees = diffusions.filter((d) => d.date < aujourdHui)
  const annotees = annoterNature(passees)
  const historiqueParEpisode = calculerParEpisode(diffusions)
  const episodesParId = new Map(episodes.map((e) => [e.id, e]))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Historique</h2>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Diffusions programmées (passées)</h3>
        {chargement && <p className="text-sm text-slate-500">Chargement…</p>}
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {!chargement && !erreur && annotees.length === 0 && (
          <p className="text-sm text-slate-500">Aucune diffusion passée enregistrée pour ce titre.</p>
        )}
        {annotees.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pl-3 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Heure</th>
                  <th className="py-2 pr-4 font-medium">Épisode</th>
                  <th className="py-2 pr-4 font-medium">Chaîne</th>
                  <th className="py-2 pr-4 font-medium">Vecteur</th>
                  <th className="py-2 pr-4 font-medium">Nature</th>
                </tr>
              </thead>
              <tbody>
                {annotees.map((d) => {
                  const episode = episodesParId.get(d.episode_id)
                  const etiquetteEpisode = d.episode_numero != null ? `ÉP.${String(d.episode_numero).padStart(2, '0')}` : '—'
                  return (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="py-2 pl-3 pr-4 text-slate-700">{formaterDateLongue(d.date)}</td>
                      <td className="py-2 pr-4 text-slate-700">{d.heure_debut}</td>
                      <td className="py-2 pr-4 text-slate-700">
                        {etiquetteEpisode}
                        {episode?.titre ? ` — ${episode.titre}` : ''}
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{d.chaine}</td>
                      <td className="py-2 pr-4 text-slate-700">{libelleVecteur(d.vecteur)}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            d.nature === 'Rediffusion' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {d.nature}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Par épisode</h3>
        {!chargement && episodes.length === 0 && <p className="text-sm text-slate-500">Aucun épisode pour ce titre.</p>}
        {episodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">N°</th>
                  <th className="py-2 pr-4 font-medium">Titre</th>
                  <th className="py-2 pr-4 font-medium">Nb diffusions</th>
                  <th className="py-2 pr-4 font-medium">Dernière diffusion</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((ep) => (
                  <tr key={ep.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-700">{ep.numero ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-700">{ep.titre || '—'}</td>
                    <td className="py-2 pr-4 text-slate-700">{historiqueParEpisode.get(ep.id)?.nb ?? 0}</td>
                    <td className="py-2 pr-4 text-slate-700">
                      {historiqueParEpisode.get(ep.id)?.derniere ? formaterDateLongue(historiqueParEpisode.get(ep.id).derniere) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
