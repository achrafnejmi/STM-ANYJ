import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, BellRing } from 'lucide-react'
import {
  listerDemandesPadParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  creerDemandePad,
  mettreAJourDemandePad,
  creerNotifications,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { useNotification } from '../components/NotificationProvider.jsx'
import { messageDemandePad, messageRelancePad } from '../lib/notifications.js'

// `cree_le` / `derniere_relance_le` sont des timestamptz — formatage court local.
function formaterHorodatage(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function joursDepuis(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
const MS_24H = 24 * 3600 * 1000

// Écran « Suivi PAD » du rôle Gestion des droits et du stock (P36) : suit le
// circuit de validation PAD SANS le faire (pas de mise en PAD ici). Permet
// d'initialiser une demande et de relancer le Contrôle PAD. Reçoit en retour
// les décisions (notifications DECISION_PAD, routées vers ce rôle).
export default function SuiviPad({ chaineActive, onOuvrirProgramme, onNotificationCreee }) {
  const [demandes, setDemandes] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [form, setForm] = useState({ programmeId: '', episodeId: '', motif: '' })
  const notifier = useNotification()

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

  const enCoursListe = useMemo(() => demandes.filter((d) => d.statut === 'EN_ATTENTE'), [demandes])
  const historique = useMemo(() => demandes.filter((d) => d.statut !== 'EN_ATTENTE'), [demandes])

  // Épisodes non PAD du programme choisi, pour le formulaire d'initialisation.
  const episodesNonPadDuProgramme = useMemo(() => {
    if (!form.programmeId) return []
    return episodes.filter((e) => e.programme_id === form.programmeId && !e.pad)
  }, [episodes, form.programmeId])

  function libelle(programmeId, episodeId) {
    const titre = programmesParId.get(programmeId)?.titre ?? '(programme inconnu)'
    const ep = episodesParId.get(episodeId)
    return `${titre}${ep?.numero != null ? ` — ÉP. ${ep.numero}` : ''}${ep?.titre ? ` : ${ep.titre}` : ''}`
  }

  function anciennete(iso) {
    const j = joursDepuis(iso)
    return `le ${formaterHorodatage(iso)}${j >= 1 ? ` · il y a ${j} j` : ''}`
  }

  // Ouvre la fiche du programme sur l'onglet Épisodes (consulter le programme /
  // l'épisode concerné par la demande).
  function ouvrirEpisode(demande) {
    onOuvrirProgramme?.(demande.programme_id, 'EPISODES')
  }

  async function initialiser(e) {
    e.preventDefault()
    if (!form.programmeId || !form.episodeId) return
    setEnCours('NOUVELLE')
    setErreur(null)
    try {
      const ep = episodesParId.get(form.episodeId)
      await creerDemandePad({
        chaine_id: chaineActive.id,
        programme_id: form.programmeId,
        episode_id: form.episodeId,
        demandeur: lireUtilisateur(),
        motif: form.motif.trim() || null,
      })
      await creerNotifications([
        {
          chaine_id: chaineActive.id,
          type: 'DEMANDE_PAD',
          destinataire_role: 'CONTROLE_PAD',
          programme_id: form.programmeId,
          message: messageDemandePad(programmesParId.get(form.programmeId)?.titre ?? 'Programme', ep?.numero),
          lu: false,
        },
      ])
      setForm({ programmeId: '', episodeId: '', motif: '' })
      notifier.succes('Demande de validation PAD envoyée au Contrôle PAD.')
      onNotificationCreee?.()
      rafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    } finally {
      setEnCours(null)
    }
  }

  async function relancer(d) {
    setEnCours(d.id)
    setErreur(null)
    try {
      const nb = (d.relances ?? 0) + 1
      await mettreAJourDemandePad(d.id, { relances: nb, derniere_relance_le: new Date().toISOString() })
      const ep = episodesParId.get(d.episode_id)
      await creerNotifications([
        {
          chaine_id: chaineActive.id,
          type: 'RELANCE_PAD',
          destinataire_role: 'CONTROLE_PAD',
          programme_id: d.programme_id,
          message: messageRelancePad(programmesParId.get(d.programme_id)?.titre ?? 'Programme', ep?.numero, nb),
          lu: false,
        },
      ])
      notifier.succes(`Relance n°${nb} envoyée au Contrôle PAD.`)
      onNotificationCreee?.()
      rafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Suivi PAD — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Suivi et relance des demandes de validation PAD. La mise en PAD est faite par le Contrôle PAD.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Initialiser une demande</h2>
        <form onSubmit={initialiser} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Programme</label>
            <select
              value={form.programmeId}
              onChange={(e) => setForm({ programmeId: e.target.value, episodeId: '', motif: form.motif })}
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">— Choisir —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Épisode (non PAD)</label>
            <select
              value={form.episodeId}
              onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
              disabled={!form.programmeId}
              className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            >
              <option value="">
                {form.programmeId && episodesNonPadDuProgramme.length === 0 ? 'Tous les épisodes sont PAD' : '— Choisir —'}
              </option>
              {episodesNonPadDuProgramme.map((e) => (
                <option key={e.id} value={e.id}>
                  ÉP. {e.numero ?? '?'}
                  {e.titre ? ` : ${e.titre}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Motif (optionnel)</label>
            <input
              type="text"
              value={form.motif}
              onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={enCours === 'NOUVELLE' || !form.programmeId || !form.episodeId}
            className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Plus size={15} />
            Envoyer
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Demandes en cours <span className="text-slate-400">({enCoursListe.length})</span>
        </h2>
        {chargement ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : enCoursListe.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande en cours.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {enCoursListe.map((d) => {
              const relancePossible = !d.derniere_relance_le || Date.now() - new Date(d.derniere_relance_le).getTime() >= MS_24H
              return (
                <li key={d.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => ouvrirEpisode(d)}
                      className="text-left text-sm font-medium text-snrt-navy hover:underline"
                    >
                      {libelle(d.programme_id, d.episode_id)}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Demandé par {d.demandeur} · {anciennete(d.cree_le)}
                      {d.relances > 0 && ` · ${d.relances} relance${d.relances > 1 ? 's' : ''}`}
                      {d.derniere_relance_le && ` · dernière relance ${formaterHorodatage(d.derniere_relance_le)}`}
                    </p>
                    {d.motif && <p className="mt-1 text-xs italic text-slate-600">« {d.motif} »</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => relancer(d)}
                    disabled={enCours === d.id || !relancePossible}
                    title={relancePossible ? 'Relancer le Contrôle PAD' : 'Déjà relancé il y a moins de 24 h'}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <BellRing size={13} />
                    Relancer
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Historique <span className="text-slate-400">({historique.length})</span>
        </h2>
        {historique.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande traitée.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historique.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => ouvrirEpisode(d)}
                    className="block max-w-full truncate text-left text-sm text-snrt-navy hover:underline"
                  >
                    {libelle(d.programme_id, d.episode_id)}
                  </button>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Demandé le {formaterHorodatage(d.cree_le)} · {d.demandeur} → {d.traite_par || '—'}
                    {d.traite_le ? ` · traité le ${formaterHorodatage(d.traite_le)}` : ''}
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
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
