import { useCallback, useEffect, useMemo, useState } from 'react'
import { Send, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  listerDemandesProgrammationParChaine,
  listerProgrammesParChaine,
  mettreAJourDemandeProgrammation,
  autoriserChaineProgramme,
  creerNotifications,
} from '../lib/db.js'
import { CHAINES } from '../lib/chaines.js'
import { lireUtilisateur } from '../lib/session.js'
import { useNotification } from '../components/NotificationProvider.jsx'
import { messageDemandeProgSoumise, messageDemandeProgDecision } from '../lib/notifications.js'

function formaterHorodatage(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const LIBELLE_STATUT = {
  REJETEE_INTERNE: 'Non transmise',
  ACCEPTEE: 'Approuvée',
  REFUSEE: 'Refusée',
}

// Écran « Demandes de programmation » (P37, rôles Administrateur de chaîne +
// Super Admin). Deux files :
//  - À transmettre : demandes des programmateurs de MA chaîne → je transmets au
//    détenteur de l'exclusivité, ou je rejette en interne.
//  - Reçues : demandes d'autres chaînes visant MON exclusivité → j'approuve
//    (la chaîne demandeuse est ajoutée à programme.chaines_autorisees) ou je refuse.
export default function DemandesProgrammation({ chaineActive, onNotificationCreee, onOuvrirProgramme }) {
  const [demandes, setDemandes] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false)
  const notifier = useNotification()

  const rafraichir = useCallback(() => {
    setChargement(true)
    Promise.all([
      listerDemandesProgrammationParChaine(chaineActive.id),
      listerProgrammesParChaine(chaineActive.id),
    ])
      .then(([d, p]) => {
        setDemandes(d)
        setProgrammes(p)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])

  const aTransmettre = useMemo(
    () => demandes.filter((d) => d.statut === 'A_TRANSMETTRE' && d.chaine_demandeuse_id === chaineActive.id),
    [demandes, chaineActive]
  )
  const recues = useMemo(
    () => demandes.filter((d) => d.statut === 'SOUMISE' && d.chaine_exclusive_id === chaineActive.id),
    [demandes, chaineActive]
  )
  const historique = useMemo(
    () => demandes.filter((d) => ['REJETEE_INTERNE', 'ACCEPTEE', 'REFUSEE'].includes(d.statut)),
    [demandes]
  )

  function titreDe(programmeId) {
    return programmesParId.get(programmeId)?.titre ?? '(programme)'
  }
  function nomChaine(id) {
    return CHAINES.find((c) => c.id === id)?.nom ?? '—'
  }

  async function transmettre(d) {
    setEnCours(d.id)
    setErreur(null)
    try {
      await mettreAJourDemandeProgrammation(d.id, {
        statut: 'SOUMISE',
        transmise_par: lireUtilisateur(),
        transmise_le: new Date().toISOString(),
      })
      await creerNotifications([
        {
          chaine_id: d.chaine_exclusive_id,
          type: 'DEMANDE_PROG_SOUMISE',
          destinataire_role: 'ADMIN_CHAINE',
          programme_id: d.programme_id,
          message: messageDemandeProgSoumise(titreDe(d.programme_id), nomChaine(d.chaine_demandeuse_id)),
          lu: false,
        },
      ])
      onNotificationCreee?.()
      notifier.succes(`Demande transmise à ${nomChaine(d.chaine_exclusive_id)}.`)
      rafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    } finally {
      setEnCours(null)
    }
  }

  async function decider(d, statut, { autoriser = false } = {}) {
    setEnCours(d.id)
    setErreur(null)
    try {
      if (autoriser) await autoriserChaineProgramme(d.programme_id, d.chaine_demandeuse_id)
      await mettreAJourDemandeProgrammation(d.id, {
        statut,
        traite_par: lireUtilisateur(),
        traite_le: new Date().toISOString(),
      })
      await creerNotifications([
        {
          chaine_id: d.chaine_demandeuse_id,
          type: 'DEMANDE_PROG_DECISION',
          destinataire_role: statut === 'REJETEE_INTERNE' ? 'PROGRAMMATEUR' : 'ADMIN_CHAINE',
          programme_id: d.programme_id,
          message: messageDemandeProgDecision(titreDe(d.programme_id), statut),
          lu: false,
        },
      ])
      onNotificationCreee?.()
      notifier.succes(
        statut === 'ACCEPTEE'
          ? `${nomChaine(d.chaine_demandeuse_id)} est autorisée à programmer « ${titreDe(d.programme_id)} ».`
          : 'Décision enregistrée.'
      )
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
        <h1 className="text-lg font-semibold text-slate-900">Demandes de programmation — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">
          Titres exclusifs : transmettre les demandes de mes programmateurs, décider des demandes reçues.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {chargement && <p className="text-sm text-slate-500">Chargement…</p>}

      {!chargement && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              À transmettre <span className="text-slate-400">({aTransmettre.length})</span>
            </h2>
            {aTransmettre.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune demande de vos programmateurs.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {aTransmettre.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOuvrirProgramme?.(d.programme_id)}
                        className="text-left text-sm font-medium text-snrt-navy hover:underline"
                      >
                        {titreDe(d.programme_id)}
                      </button>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Vers {nomChaine(d.chaine_exclusive_id)} · demandé par {d.demandeur} ·{' '}
                        {formaterHorodatage(d.cree_le)}
                      </p>
                      {d.motif && <p className="mt-1 text-xs italic text-slate-600">« {d.motif} »</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => transmettre(d)}
                        disabled={enCours === d.id}
                        className="flex items-center gap-1 rounded-md bg-snrt-navy px-2.5 py-1.5 text-xs font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
                      >
                        <Send size={13} />
                        Transmettre
                      </button>
                      <button
                        type="button"
                        onClick={() => decider(d, 'REJETEE_INTERNE')}
                        disabled={enCours === d.id}
                        className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <X size={13} />
                        Rejeter
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Reçues <span className="text-slate-400">({recues.length})</span>
            </h2>
            {recues.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune demande visant vos titres exclusifs.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recues.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOuvrirProgramme?.(d.programme_id)}
                        className="text-left text-sm font-medium text-snrt-navy hover:underline"
                      >
                        {titreDe(d.programme_id)}
                      </button>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Demandé par {nomChaine(d.chaine_demandeuse_id)} ({d.demandeur}) · transmis par{' '}
                        {d.transmise_par || '—'} · {formaterHorodatage(d.transmise_le || d.cree_le)}
                      </p>
                      {d.motif && <p className="mt-1 text-xs italic text-slate-600">« {d.motif} »</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => decider(d, 'ACCEPTEE', { autoriser: true })}
                        disabled={enCours === d.id}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check size={13} />
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() => decider(d, 'REFUSEE')}
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
            <button
              type="button"
              onClick={() => setHistoriqueOuvert((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-semibold text-slate-900"
            >
              {historiqueOuvert ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Historique <span className="text-slate-400">({historique.length})</span>
            </button>
            {historiqueOuvert && (
              <ul className="mt-3 divide-y divide-slate-100">
                {historique.length === 0 ? (
                  <li className="py-2 text-sm text-slate-500">Aucune demande traitée.</li>
                ) : (
                  historique.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700">{titreDe(d.programme_id)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {nomChaine(d.chaine_demandeuse_id)} → {nomChaine(d.chaine_exclusive_id)}
                          {d.traite_le ? ` · ${formaterHorodatage(d.traite_le)}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.statut === 'ACCEPTEE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {LIBELLE_STATUT[d.statut] ?? d.statut}
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
