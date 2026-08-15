import { useEffect, useMemo, useState } from 'react'
import { creerElementSecondaire } from '../lib/db.js'
import {
  calculerIntervalles,
  estPlacementValide,
  heureHMSEnSecondes,
  secondesEnHeureHMS,
  DUREE_BANDE_ANNONCE_SECONDES,
} from '../lib/planMedia.js'
import { formaterDateLongue, minutesEnHeure } from '../lib/semaine.js'
import Modal from './Modal.jsx'

// Insertion manuelle dans une coupure (P16b) : date → coupure (recalculée en
// direct depuis `diffusions`, jamais un objet intervalle figé dans le state —
// seul apresTransmissionId est retenu comme sélection, pour ne jamais valider
// contre des bornes périmées) → spot de la bibliothèque ou bande-annonce pour
// une campagne → heure de début à la seconde près, validée en direct
// (estPlacementValide, mêmes bornes/anti-chevauchement que le moteur auto).
// origine='MANUELLE' : jamais retouché par une régénération (estProtege).
export default function PanneauInsertionManuelle({
  chaineActive,
  dates,
  diffusions,
  elementsSecondaires,
  campagnes,
  spots,
  programmesParId,
  onFermer,
  onElementCree,
}) {
  const [dateChoisie, setDateChoisie] = useState(dates[0])
  const [coupureId, setCoupureId] = useState('')
  const [sourceType, setSourceType] = useState('SPOT')
  const [spotId, setSpotId] = useState('')
  const [campagneId, setCampagneId] = useState('')
  const [heureDebutSaisie, setHeureDebutSaisie] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const diffusionsParId = useMemo(() => new Map(diffusions.map((d) => [d.id, d])), [diffusions])
  const intervalles = useMemo(() => calculerIntervalles(dates, diffusions), [dates, diffusions])
  const coupuresDuJour = useMemo(() => intervalles.filter((iv) => iv.date === dateChoisie), [intervalles, dateChoisie])
  const intervalleSelectionne = coupuresDuJour.find((iv) => iv.apresTransmissionId === coupureId) ?? null
  const elementsDansCoupure = useMemo(
    () => elementsSecondaires.filter((e) => e.apres_transmission_id === coupureId),
    [elementsSecondaires, coupureId]
  )

  // Valeur par défaut : juste après le dernier élément déjà présent dans la
  // coupure, ou le début de la coupure si elle est encore vide.
  useEffect(() => {
    if (!intervalleSelectionne) {
      setHeureDebutSaisie('')
      return
    }
    const dernierFin =
      elementsDansCoupure.length > 0
        ? Math.max(...elementsDansCoupure.map((e) => heureHMSEnSecondes(e.heure_fin)))
        : intervalleSelectionne.debut * 60
    setHeureDebutSaisie(secondesEnHeureHMS(dernierFin))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de coupure sélectionnée
  }, [coupureId])

  const spot = spots.find((s) => s.id === spotId)
  const campagne = campagnes.find((c) => c.id === campagneId)
  const titrePromu = campagne ? programmesParId.get(campagne.programme_id)?.titre : null

  const duree = sourceType === 'SPOT' ? spot?.duree_secondes : DUREE_BANDE_ANNONCE_SECONDES
  const type = sourceType === 'SPOT' ? spot?.type : 'BANDE_ANNONCE'
  const libelle = sourceType === 'SPOT' ? spot?.libelle : titrePromu ? `Bande-annonce — ${titrePromu}` : null

  const heureDebutSecondes = heureDebutSaisie ? heureHMSEnSecondes(heureDebutSaisie) : null
  const pretAValider = Boolean(intervalleSelectionne && duree && heureDebutSecondes != null)
  const valide = pretAValider && estPlacementValide(heureDebutSecondes, duree, intervalleSelectionne, elementsDansCoupure)

  function libelleCoupure(iv) {
    const diffusion = diffusionsParId.get(iv.apresTransmissionId)
    const titre = diffusion ? programmesParId.get(diffusion.programme_id)?.titre : null
    return `après ${titre ?? '—'}, de ${diffusion?.heure_fin?.slice(0, 5) ?? '?'} à ${minutesEnHeure(iv.fin)}`
  }

  async function inserer() {
    if (!valide) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const champs = {
        chaine_id: chaineActive.id,
        date: dateChoisie,
        heure_debut: secondesEnHeureHMS(heureDebutSecondes),
        heure_fin: secondesEnHeureHMS(heureDebutSecondes + duree),
        duree_secondes: duree,
        apres_transmission_id: coupureId,
        type,
        libelle,
        campagne_id: sourceType === 'BANDE_ANNONCE' ? campagneId : null,
        origine: 'MANUELLE',
        run_id: null,
      }
      const cree = await creerElementSecondaire(champs)
      onElementCree(cree)
      setCoupureId('')
      setSpotId('')
      setCampagneId('')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre="Insertion manuelle" onFermer={onFermer}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Date</label>
          <select
            value={dateChoisie}
            onChange={(e) => {
              setDateChoisie(e.target.value)
              setCoupureId('')
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {formaterDateLongue(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Coupure</label>
          <select
            value={coupureId}
            onChange={(e) => setCoupureId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Choisir une coupure —</option>
            {coupuresDuJour.map((iv) => (
              <option key={iv.apresTransmissionId} value={iv.apresTransmissionId}>
                {libelleCoupure(iv)}
              </option>
            ))}
          </select>
          {coupuresDuJour.length === 0 && <p className="mt-1 text-xs text-slate-500">Aucune coupure ce jour-là.</p>}
        </div>

        {coupureId && (
          <>
            {elementsDansCoupure.length > 0 && (
              <div className="rounded-md border border-slate-200 p-2 text-xs text-slate-500">
                <div className="mb-1 font-medium text-slate-700">Déjà dans cette coupure :</div>
                {elementsDansCoupure
                  .slice()
                  .sort((a, b) => (a.heure_debut < b.heure_debut ? -1 : 1))
                  .map((e) => (
                    <div key={e.id}>
                      {e.heure_debut.slice(0, 8)}–{e.heure_fin.slice(0, 8)} · {e.libelle}
                      {e.origine === 'MANUELLE' ? ' (manuel)' : ' (auto)'}
                    </div>
                  ))}
              </div>
            )}

            <div className="flex rounded-md border border-slate-300 text-sm">
              <button
                type="button"
                onClick={() => setSourceType('SPOT')}
                className={`flex-1 px-3 py-1.5 ${sourceType === 'SPOT' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Spot de la bibliothèque
              </button>
              <button
                type="button"
                onClick={() => setSourceType('BANDE_ANNONCE')}
                className={`flex-1 px-3 py-1.5 ${sourceType === 'BANDE_ANNONCE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Bande-annonce (campagne)
              </button>
            </div>

            {sourceType === 'SPOT' ? (
              <select
                value={spotId}
                onChange={(e) => setSpotId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Choisir un spot —</option>
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.libelle} ({s.duree_secondes}s)
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={campagneId}
                onChange={(e) => setCampagneId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Choisir une campagne —</option>
                {campagnes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {programmesParId.get(c.programme_id)?.titre ?? '—'}
                  </option>
                ))}
              </select>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Heure de début (précision seconde)</label>
              <input
                type="time"
                step="1"
                value={heureDebutSaisie}
                onChange={(e) => setHeureDebutSaisie(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {pretAValider && !valide && <p className="mt-1 text-xs text-red-600">Chevauchement ou hors des bornes de la coupure.</p>}
            </div>

            {erreur && <p className="text-xs text-red-600">{erreur}</p>}

            <button
              type="button"
              onClick={inserer}
              disabled={!valide || enregistrement}
              className="w-full rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Insertion…' : 'Insérer'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
