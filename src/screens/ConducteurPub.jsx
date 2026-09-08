// Conducteur de publicité (P39a — réf. exemple Abir « Édité par BOA »).
// La Régie publicitaire (Abir) saisit ici le CADRE de la journée : les écrans
// publicitaires prévus (libellé, heure prévisionnelle, contexte, nb de spots,
// durée de tranche). Le Programmateur (Salma / Younes) le consulte EN LECTURE
// SEULE pour élaborer le plan média — plus d'envoi par mail.
// Saisie seule : aucun rapprochement automatique avec les spots réellement
// placés (→ P39b).
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  listerCadrePubParChaine,
  creerCadrePubEcran,
  mettreAJourCadrePubEcran,
  supprimerCadrePubEcran,
} from '../lib/db.js'
import { aujourdHuiISO, ajouterJours, formaterDateLongue } from '../lib/semaine.js'
import { formaterDureeHMS } from '../lib/exportConducteur.js'
import { lireUtilisateur } from '../lib/session.js'
import { peutEditerCadrePub } from '../lib/roles.js'
import { useNotification } from '../components/NotificationProvider.jsx'

// "mm:ss" ou entier seul (secondes) → secondes ; vide → null.
function parseMMSS(v) {
  const t = (v ?? '').trim()
  if (!t) return null
  if (t.includes(':')) {
    const [m, s] = t.split(':').map((x) => Number(x))
    if (Number.isNaN(m) || Number.isNaN(s)) return null
    return m * 60 + s
  }
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

function formatMMSS(sec) {
  if (sec == null) return ''
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

export default function ConducteurPub({ chaineActive, roleUtilisateur }) {
  const lectureSeule = !peutEditerCadrePub(roleUtilisateur)
  const [date, setDate] = useState(aujourdHuiISO())
  const [ecrans, setEcrans] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const { confirmer } = useNotification()

  function recharger() {
    setChargement(true)
    listerCadrePubParChaine(chaineActive.id)
      .then((lignes) => setEcrans(lignes.filter((l) => l.date === date).sort((a, b) => a.ordre - b.ordre)))
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne/date
  }, [chaineActive, date])

  const totaux = useMemo(
    () => ({
      nbSpots: ecrans.reduce((acc, e) => acc + (e.nb_spots ?? 0), 0),
      duree: ecrans.reduce((acc, e) => acc + (e.duree_tranche_secondes ?? 0), 0),
    }),
    [ecrans]
  )

  async function modifier(id, champs) {
    try {
      await mettreAJourCadrePubEcran(id, champs)
      recharger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function ajouter() {
    setErreur(null)
    try {
      await creerCadrePubEcran({
        chaine_id: chaineActive.id,
        date,
        ordre: ecrans.length,
        nb_spots: 0,
        cree_par: lireUtilisateur(),
      })
      recharger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function supprimer(ecran) {
    const ok = await confirmer({
      titre: 'Supprimer l’écran',
      message: `Supprimer l’écran « ${ecran.nom || ecran.heure_previsionnelle || 'sans nom'} » du cadre ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!ok) return
    try {
      await supprimerCadrePubEcran(ecran.id)
      recharger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Conducteur de publicité — {chaineActive.nom}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {lectureSeule
                ? 'Cadre préparé par la Régie publicitaire — lecture seule.'
                : 'Écrans publicitaires prévus pour la journée : nb de spots et durée de tranche.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDate((d) => ajouterJours(d, -1))}
              className="rounded-md border border-slate-300 p-1 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-slate-700">{formaterDateLongue(date)}</span>
            <button
              type="button"
              onClick={() => setDate((d) => ajouterJours(d, 1))}
              className="rounded-md border border-slate-300 p-1 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDate(aujourdHuiISO())}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Aujourd'hui
            </button>
          </div>
        </div>
        {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {chargement ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 pl-3 pr-3 font-medium">Nom</th>
                    <th className="py-2 pr-3 font-medium">Heure prév.</th>
                    <th className="py-2 pr-3 font-medium">Contexte</th>
                    <th className="py-2 pr-3 font-medium">Nb spots</th>
                    <th className="py-2 pr-3 font-medium">Durée tranche</th>
                    {!lectureSeule && <th className="py-2 pr-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {ecrans.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-1.5 pl-3 pr-3">
                        <input
                          defaultValue={e.nom ?? ''}
                          disabled={lectureSeule}
                          onBlur={(ev) => {
                            const v = ev.target.value.trim()
                            if (v !== (e.nom ?? '')) modifier(e.id, { nom: v || null })
                          }}
                          placeholder="ex. Ecran 09:30"
                          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          type="time"
                          step="1"
                          defaultValue={e.heure_previsionnelle ?? ''}
                          disabled={lectureSeule}
                          onBlur={(ev) => {
                            const v = ev.target.value
                            if (v !== (e.heure_previsionnelle ?? '')) modifier(e.id, { heure_previsionnelle: v || null })
                          }}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          defaultValue={e.contexte ?? ''}
                          disabled={lectureSeule}
                          onBlur={(ev) => {
                            const v = ev.target.value.trim()
                            if (v !== (e.contexte ?? '')) modifier(e.id, { contexte: v || null })
                          }}
                          placeholder="ex. AVANT SERIE HAYNA"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          type="number"
                          min="0"
                          defaultValue={e.nb_spots ?? 0}
                          disabled={lectureSeule}
                          onBlur={(ev) => {
                            const v = Number(ev.target.value) || 0
                            if (v !== (e.nb_spots ?? 0)) modifier(e.id, { nb_spots: v })
                          }}
                          className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          defaultValue={formatMMSS(e.duree_tranche_secondes)}
                          disabled={lectureSeule}
                          onBlur={(ev) => {
                            const sec = parseMMSS(ev.target.value)
                            if (sec !== (e.duree_tranche_secondes ?? null)) modifier(e.id, { duree_tranche_secondes: sec })
                          }}
                          placeholder="mm:ss"
                          className="w-20 rounded-md border border-slate-300 px-1.5 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      {!lectureSeule && (
                        <td className="py-1.5 pr-3">
                          <button
                            type="button"
                            onClick={() => supprimer(e)}
                            className="text-red-500 hover:text-red-700"
                            title="Supprimer l’écran"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {ecrans.length === 0 && (
                    <tr>
                      <td colSpan={lectureSeule ? 5 : 6} className="py-3 pl-3 text-sm text-slate-500">
                        Aucun écran pour cette date.
                      </td>
                    </tr>
                  )}
                </tbody>
                {ecrans.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-slate-700">
                      <td className="py-2 pl-3 pr-3 text-xs font-semibold" colSpan={3}>
                        Total journée
                      </td>
                      <td className="py-2 pr-3 text-sm font-semibold">{totaux.nbSpots}</td>
                      <td className="py-2 pr-3 text-sm font-semibold">{formaterDureeHMS(totaux.duree)}</td>
                      {!lectureSeule && <td className="py-2 pr-3"></td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {!lectureSeule && (
              <button
                type="button"
                onClick={ajouter}
                className="mt-3 flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                <Plus size={14} />
                Ajouter un écran
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
