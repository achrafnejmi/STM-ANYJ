import { useEffect, useMemo, useState } from 'react'
import {
  listerDiffusionsLineairesParProgramme,
  listerEpisodes,
  listerPublicationsReseauParProgramme,
  listerPublicationsVodParProgramme,
} from '../lib/db.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import { calculerParEpisode, annoterNature } from '../lib/historique.js'

function libelleVecteur(vecteur) {
  if (vecteur === 'SATELLITE') return 'Satellite'
  if (vecteur === 'TNT') return 'TNT'
  return 'Unifié'
}

const LIBELLE_PLATEFORME = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  YOUTUBE: 'YouTube',
  FORJA: 'Forja',
}
const LIBELLE_FORMAT = { POST: 'Post', REEL: 'Reel', STORY: 'Story', VIDEO: 'Vidéo' }
const LIBELLE_STATUT = { BROUILLON: 'Brouillon', PROGRAMME: 'Programmé', PUBLIE: 'Publié', ANNULE: 'Annulé' }

// Historique de diffusion d'un titre (EXG-M6-01, M6-04, onglet Historique de
// la fiche, P14b puis P31). Snomark n'a aucun constat d'antenne réel :
// "historique" = consolidation des diffusion_lineaire passées (voir
// historique.js) et, depuis P31, des publications non-linéaires passées
// (posts réseaux sociaux + mises en ligne VOD). Deux sous-vues : Linéaire
// (défaut, existant) et Non-linéaire. Aucune pagination (EXG-M6-01 « sans
// limitation de nombre ») — conteneur scrollable uniquement.
export default function HistoriqueTitrePanel({ programmeId, canalInitial = 'LINEAIRE', sansCadre = false }) {
  const [ongletCanal, setOngletCanal] = useState(canalInitial) // LINEAIRE | NON_LINEAIRE
  const [diffusions, setDiffusions] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [publicationsReseau, setPublicationsReseau] = useState([])
  const [publicationsVod, setPublicationsVod] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtreEpisode, setFiltreEpisode] = useState('')
  const [filtreChaine, setFiltreChaine] = useState('')
  const [filtrePlateforme, setFiltrePlateforme] = useState('')

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setFiltreEpisode('')
    setFiltreChaine('')
    setFiltrePlateforme('')
    Promise.all([
      listerDiffusionsLineairesParProgramme(programmeId),
      listerEpisodes(programmeId),
      listerPublicationsReseauParProgramme(programmeId),
      listerPublicationsVodParProgramme(programmeId),
    ])
      .then(([lignesDiffusions, lignesEpisodes, lignesReseau, lignesVod]) => {
        setDiffusions(lignesDiffusions)
        setEpisodes(lignesEpisodes)
        setPublicationsReseau(lignesReseau)
        setPublicationsVod(lignesVod)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [programmeId])

  const aujourdHui = aujourdHuiISO()

  // --- linéaire ---
  // Déjà triées date/heure décroissantes par listerDiffusionsLineairesParProgramme ;
  // annoterNature conserve cet ordre (le tri chronologique croissant n'a lieu
  // qu'en interne, pour déterminer la 1re occurrence de chaque épisode).
  const passees = diffusions.filter((d) => d.date < aujourdHui)
  const annotees = annoterNature(passees)
  const chainesPassees = [...new Set(passees.map((d) => d.chaine).filter(Boolean))].sort()
  const anoteesFiltrees = annotees.filter(
    (d) => (!filtreEpisode || d.episode_id === filtreEpisode) && (!filtreChaine || d.chaine === filtreChaine)
  )
  const historiqueParEpisode = calculerParEpisode(diffusions)
  const episodesParId = new Map(episodes.map((e) => [e.id, e]))

  // --- non-linéaire : posts réseaux sociaux + mises en ligne VOD, fusionnés ---
  // P43 : rattachement épisode (`episode_id`) — pris en compte dans l'affichage
  // et le filtre Épisode partagé avec la sous-vue Linéaire.
  const publicationsPassees = useMemo(() => {
    const labelEp = new Map(episodes.map((e) => [e.id, e.numero != null ? `ÉP.${String(e.numero).padStart(2, '0')}` : '—']))
    const commun = (p, type, canal) => ({
      id: p.id,
      date: p.date_publication,
      heure: p.heure_publication,
      type,
      canal,
      plateformeCode: p.plateforme,
      titre: p.titre,
      statut: p.statut,
      episode_id: p.episode_id ?? null,
      episodeLabel: p.episode_id ? (labelEp.get(p.episode_id) ?? 'ÉP.') : 'Programme entier',
    })
    const reseau = publicationsReseau
      .filter((p) => p.date_publication < aujourdHui)
      .map((p) => commun(p, 'Réseau social', `${LIBELLE_PLATEFORME[p.plateforme] ?? p.plateforme} · ${LIBELLE_FORMAT[p.format] ?? p.format}`))
    const vod = publicationsVod
      .filter((p) => p.date_publication < aujourdHui)
      .map((p) => commun(p, 'VOD', LIBELLE_PLATEFORME[p.plateforme] ?? p.plateforme))
    return [...reseau, ...vod]
      .filter(
        (p) =>
          (!filtreEpisode || p.episode_id === filtreEpisode) &&
          (!filtrePlateforme || p.plateformeCode === filtrePlateforme)
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return (b.heure ?? '') < (a.heure ?? '') ? -1 : 1
      })
  }, [publicationsReseau, publicationsVod, episodes, filtreEpisode, filtrePlateforme, aujourdHui])

  const plateformesPassees = useMemo(
    () => [
      ...new Set(
        [...publicationsReseau, ...publicationsVod]
          .filter((p) => p.date_publication < aujourdHui)
          .map((p) => p.plateforme)
      ),
    ],
    [publicationsReseau, publicationsVod, aujourdHui]
  )

  return (
    <div className={sansCadre ? '' : 'rounded-lg border border-slate-200 bg-white p-6'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        {!sansCadre && <h2 className="text-base font-semibold text-slate-900">Historique</h2>}
        <div className={`flex rounded-md border border-slate-300 text-sm ${sansCadre ? 'ml-auto' : ''}`}>
          <button
            type="button"
            onClick={() => setOngletCanal('LINEAIRE')}
            className={`px-3 py-1.5 ${ongletCanal === 'LINEAIRE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Linéaire
          </button>
          <button
            type="button"
            onClick={() => setOngletCanal('NON_LINEAIRE')}
            className={`px-3 py-1.5 ${ongletCanal === 'NON_LINEAIRE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Non-linéaire
          </button>
        </div>
      </div>

      {chargement && <p className="text-sm text-slate-500">Chargement…</p>}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {!chargement && !erreur && ongletCanal === 'LINEAIRE' && (
        <>
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Diffusions programmées (passées)</h3>
              <div className="flex flex-wrap gap-2">
                {chainesPassees.length > 1 && (
                  <select
                    value={filtreChaine}
                    onChange={(e) => setFiltreChaine(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="">Toutes les chaînes</option>
                    {chainesPassees.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                {episodes.length > 0 && (
                  <select
                    value={filtreEpisode}
                    onChange={(e) => setFiltreEpisode(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="">Tous les épisodes</option>
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.numero != null ? `ÉP.${String(ep.numero).padStart(2, '0')}` : '—'}
                        {ep.titre ? ` — ${ep.titre}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {anoteesFiltrees.length === 0 && (
              <p className="text-sm text-slate-500">
                {filtreEpisode
                  ? 'Aucune diffusion passée pour cet épisode.'
                  : 'Aucune diffusion passée enregistrée pour ce titre.'}
              </p>
            )}
            {anoteesFiltrees.length > 0 && (
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
                    {anoteesFiltrees.map((d) => {
                      const episode = episodesParId.get(d.episode_id)
                      const etiquetteEpisode =
                        d.episode_numero != null ? `ÉP.${String(d.episode_numero).padStart(2, '0')}` : '—'
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
            {episodes.length === 0 && <p className="text-sm text-slate-500">Aucun épisode pour ce titre.</p>}
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
                          {historiqueParEpisode.get(ep.id)?.derniere
                            ? formaterDateLongue(historiqueParEpisode.get(ep.id).derniere)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!chargement && !erreur && ongletCanal === 'NON_LINEAIRE' && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Publications non-linéaires (passées)</h3>
            <div className="flex flex-wrap gap-2">
              {plateformesPassees.length > 1 && (
                <select
                  value={filtrePlateforme}
                  onChange={(e) => setFiltrePlateforme(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                >
                  <option value="">Toutes les plateformes</option>
                  {plateformesPassees.map((code) => (
                    <option key={code} value={code}>
                      {LIBELLE_PLATEFORME[code] ?? code}
                    </option>
                  ))}
                </select>
              )}
              {episodes.length > 0 && (
                <select
                  value={filtreEpisode}
                  onChange={(e) => setFiltreEpisode(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                >
                  <option value="">Tous les épisodes</option>
                  {episodes.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.numero != null ? `ÉP.${String(ep.numero).padStart(2, '0')}` : '—'}
                      {ep.titre ? ` — ${ep.titre}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {publicationsPassees.length === 0 && (
            <p className="text-sm text-slate-500">
              {filtreEpisode
                ? 'Aucune publication non-linéaire passée pour cet épisode.'
                : 'Aucune publication non-linéaire passée pour ce titre.'}
            </p>
          )}
          {publicationsPassees.length > 0 && (
            <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pl-3 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Heure</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Canal</th>
                    <th className="py-2 pr-4 font-medium">Épisode</th>
                    <th className="py-2 pr-4 font-medium">Titre</th>
                    <th className="py-2 pr-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {publicationsPassees.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pl-3 pr-4 text-slate-700">{formaterDateLongue(p.date)}</td>
                      <td className="py-2 pr-4 text-slate-700">{p.heure ? p.heure.slice(0, 5) : '—'}</td>
                      <td className="py-2 pr-4 text-slate-700">{p.type}</td>
                      <td className="py-2 pr-4 text-slate-700">{p.canal}</td>
                      <td className="py-2 pr-4 text-slate-700">{p.episodeLabel}</td>
                      <td className="py-2 pr-4 text-slate-700">{p.titre || '—'}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            p.statut === 'PUBLIE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : p.statut === 'ANNULE'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {LIBELLE_STATUT[p.statut] ?? p.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
