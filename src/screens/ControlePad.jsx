import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  listerDemandesPadParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  mettreAJourEpisode,
  mettreAJourDemandePad,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'

// `cree_le` / `traite_le` sont des timestamptz (ISO complet) — formatage local
// court, distinct de formaterDateLongue (semaine.js) qui n'attend qu'une date nue.
function formaterHorodatage(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const jour = String(d.getDate()).padStart(2, '0')
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const heure = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${jour}/${mois}/${d.getFullYear()} ${heure}:${min}`
}

// Écran Contrôle PAD (P35c, rôle Contrôle PAD) : traiter les demandes de
// validation PAD envoyées depuis le panneau Épisodes, et valider directement
// des épisodes encore non PAD. Circuit simplifié pour la démo (pas de vraie
// vérification de support).
export default function ControlePad({ chaineActive }) {
  const [demandes, setDemandes] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)

  const rafraichir = useCallback(() => {
    setChargement(true)
    Promise.all([
      listerDemandesPadParChaine(chaineActive.id),
      listerProgrammesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
    ])
      .then(([d, p, e]) => {
        setDemandes(d)
        setProgrammes(p)
        setEpisodes(e)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const episodesParId = useMemo(() => new Map(episodes.map((e) => [e.id, e])), [episodes])

  const enAttente = useMemo(() => demandes.filter((d) => d.statut === 'EN_ATTENTE'), [demandes])
  const traitees = useMemo(() => demandes.filter((d) => d.statut !== 'EN_ATTENTE'), [demandes])
  const episodesNonPad = useMemo(
    () => episodes.filter((e) => !e.pad && programmesParId.has(e.programme_id)),
    [episodes, programmesParId]
  )

  function libelleEpisode(programmeId, episodeId) {
    const titre = programmesParId.get(programmeId)?.titre ?? '(programme inconnu)'
    const ep = episodesParId.get(episodeId)
    const numero = ep?.numero != null ? `ÉP. ${ep.numero}` : 'épisode'
    return `${titre} — ${numero}${ep?.titre ? ` : ${ep.titre}` : ''}`
  }

  async function traiter(demande, statut) {
    setEnCours(demande.id)
    setErreur(null)
    try {
      if (statut === 'ACCEPTEE') {
        await mettreAJourEpisode(demande.episode_id, { pad: true })
      }
      await mettreAJourDemandePad(demande.id, {
        statut,
        traite_par: lireUtilisateur(),
        traite_le: new Date().toISOString(),
      })
      rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(null)
    }
  }

  async function validerDirect(episode) {
    setEnCours(episode.id)
    setErreur(null)
    try {
      await mettreAJourEpisode(episode.id, { pad: true })
      rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Contrôle PAD — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Demandes de validation PAD des programmateurs et épisodes en attente de contrôle.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {chargement && <p className="text-sm text-slate-500">Chargement…</p>}

      {!chargement && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Demandes en attente <span className="text-slate-400">({enAttente.length})</span>
            </h2>
            {enAttente.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune demande en attente.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {enAttente.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {libelleEpisode(d.programme_id, d.episode_id)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Demandé par {d.demandeur} · {formaterHorodatage(d.cree_le)}
                      </p>
                      {d.motif && <p className="mt-1 text-xs italic text-slate-600">« {d.motif} »</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => traiter(d, 'ACCEPTEE')}
                        disabled={enCours === d.id}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check size={13} />
                        Accepter
                      </button>
                      <button
                        type="button"
                        onClick={() => traiter(d, 'REFUSEE')}
                        disabled={enCours === d.id}
                        className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <X size={13} />
                        Refuser
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Épisodes non PAD <span className="text-slate-400">({episodesNonPad.length})</span>
            </h2>
            {episodesNonPad.length === 0 ? (
              <p className="text-sm text-slate-500">Tous les épisodes de la chaîne sont PAD.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {episodesNonPad.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="min-w-0 truncate text-sm text-slate-700">
                      {libelleEpisode(e.programme_id, e.id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => validerDirect(e)}
                      disabled={enCours === e.id}
                      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Valider PAD
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setHistoriqueOuvert((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-semibold text-slate-900"
            >
              {historiqueOuvert ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Demandes traitées <span className="text-slate-400">({traitees.length})</span>
            </button>
            {historiqueOuvert && (
              <ul className="mt-3 divide-y divide-slate-100">
                {traitees.length === 0 ? (
                  <li className="py-2 text-sm text-slate-500">Aucune demande traitée.</li>
                ) : (
                  traitees.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700">
                          {libelleEpisode(d.programme_id, d.episode_id)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {d.demandeur} → {d.traite_par || '—'}
                          {d.traite_le ? ` · ${formaterHorodatage(d.traite_le)}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.statut === 'ACCEPTEE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {d.statut === 'ACCEPTEE' ? 'Acceptée' : 'Refusée'}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
