import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import {
  listerDemandesPadParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerBibles,
  urlBible,
  mettreAJourEpisode,
  mettreAJourDemandePad,
  creerNotifications,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { messageDecisionPad } from '../lib/notifications.js'

const FILTRES_CATALOGUE = [
  { code: 'TOUS', label: 'Tous' },
  { code: 'NON_PAD', label: 'Non PAD' },
  { code: 'DEMANDE', label: 'Demande en attente' },
]

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
export default function ControlePad({ chaineActive, onNotificationCreee }) {
  const [demandes, setDemandes] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [bibles, setBibles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)
  const [filtreCatalogue, setFiltreCatalogue] = useState('NON_PAD')

  const rafraichir = useCallback(() => {
    setChargement(true)
    Promise.all([
      listerDemandesPadParChaine(chaineActive.id),
      listerProgrammesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      listerBibles(),
    ])
      .then(([d, p, e, b]) => {
        setDemandes(d)
        setProgrammes(p)
        setEpisodes(e)
        setBibles(b)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const episodesParId = useMemo(() => new Map(episodes.map((e) => [e.id, e])), [episodes])
  const bibleParProgrammeId = useMemo(() => new Map(bibles.map((b) => [b.programme_id, b])), [bibles])

  const enAttente = useMemo(() => demandes.filter((d) => d.statut === 'EN_ATTENTE'), [demandes])
  const traitees = useMemo(() => demandes.filter((d) => d.statut !== 'EN_ATTENTE'), [demandes])
  // Épisode -> demande PAD en attente (badge « demande en cours » du catalogue).
  const demandeEnAttenteParEpisodeId = useMemo(
    () => new Map(enAttente.map((d) => [d.episode_id, d])),
    [enAttente]
  )

  // Catalogue complet des épisodes de la chaîne (l'entité PAD doit tout voir),
  // trié par titre de programme puis numéro, avec un filtre d'affichage.
  const catalogue = useMemo(() => {
    const lignes = episodes
      .filter((e) => programmesParId.has(e.programme_id))
      .map((e) => ({
        episode: e,
        programme: programmesParId.get(e.programme_id),
        demande: demandeEnAttenteParEpisodeId.get(e.id) ?? null,
      }))
      .sort((a, b) => {
        const t = (a.programme?.titre ?? '').localeCompare(b.programme?.titre ?? '')
        return t !== 0 ? t : (a.episode.numero ?? 0) - (b.episode.numero ?? 0)
      })
    if (filtreCatalogue === 'NON_PAD') return lignes.filter((l) => !l.episode.pad)
    if (filtreCatalogue === 'DEMANDE') return lignes.filter((l) => l.demande)
    return lignes
  }, [episodes, programmesParId, demandeEnAttenteParEpisodeId, filtreCatalogue])

  function libelleEpisode(programmeId, episodeId) {
    const titre = programmesParId.get(programmeId)?.titre ?? '(programme inconnu)'
    const ep = episodesParId.get(episodeId)
    const numero = ep?.numero != null ? `ÉP. ${ep.numero}` : 'épisode'
    return `${titre} — ${numero}${ep?.titre ? ` : ${ep.titre}` : ''}`
  }

  function lienBible(programmeId) {
    const chemin = bibleParProgrammeId.get(programmeId)?.fichier_chemin
    return chemin ? urlBible(chemin) : null
  }

  function contexteRevue(programmeId, episodeId) {
    const p = programmesParId.get(programmeId)
    const ep = episodesParId.get(episodeId)
    const bouts = []
    if (p?.genre) bouts.push(p.genre)
    if (ep?.duree) bouts.push(`${ep.duree} min`)
    return bouts.join(' · ')
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
      // Notifie l'émetteur (rôle Gestion des droits et du stock) de la décision.
      const ep = episodesParId.get(demande.episode_id)
      await creerNotifications([
        {
          chaine_id: chaineActive.id,
          type: 'DECISION_PAD',
          destinataire_role: 'GESTION_DROITS_STOCK',
          programme_id: demande.programme_id,
          message: messageDecisionPad(programmesParId.get(demande.programme_id)?.titre ?? 'Programme', ep?.numero, statut),
          lu: false,
        },
      ])
      onNotificationCreee?.()
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
          Demandes de validation PAD reçues, et mise en PAD des épisodes après revue.
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
                        {contexteRevue(d.programme_id, d.episode_id) && `${contexteRevue(d.programme_id, d.episode_id)} · `}
                        Demandé par {d.demandeur} · {formaterHorodatage(d.cree_le)}
                        {d.relances > 0 && ` · ${d.relances} relance${d.relances > 1 ? 's' : ''}`}
                      </p>
                      {d.motif && <p className="mt-1 text-xs italic text-slate-600">« {d.motif} »</p>}
                      {lienBible(d.programme_id) && (
                        <a
                          href={lienBible(d.programme_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-snrt-navy hover:underline"
                        >
                          <FileText size={12} />
                          Bible (PDF)
                        </a>
                      )}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Catalogue — épisodes <span className="text-slate-400">({catalogue.length})</span>
              </h2>
              <div className="flex gap-1">
                {FILTRES_CATALOGUE.map((f) => (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => setFiltreCatalogue(f.code)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      filtreCatalogue === f.code
                        ? 'bg-snrt-navy text-white'
                        : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {catalogue.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun épisode pour ce filtre.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {catalogue.map(({ episode, programme, demande }) => (
                  <li key={episode.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700">
                        {libelleEpisode(episode.programme_id, episode.id)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        {contexteRevue(episode.programme_id, episode.id)}
                        {lienBible(programme?.id) && (
                          <a
                            href={lienBible(programme.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-snrt-navy hover:underline"
                          >
                            <FileText size={12} />
                            Bible
                          </a>
                        )}
                        {demande && <span className="text-amber-600">demande en attente</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          episode.pad ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {episode.pad ? 'PAD' : 'Non PAD'}
                      </span>
                      {!episode.pad && (
                        <button
                          type="button"
                          onClick={() => validerDirect(episode)}
                          disabled={enCours === episode.id}
                          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Valider PAD
                        </button>
                      )}
                    </div>
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
