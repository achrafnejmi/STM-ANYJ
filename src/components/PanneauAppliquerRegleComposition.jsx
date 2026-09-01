import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import {
  calculerPointsInsertion,
  estPlacementValide,
  heureHMSEnSecondes,
  secondesEnHeureHMS,
} from '../lib/planMedia.js'
import { dureeTransmissionMinutes } from '../lib/semaine.js'

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}

// Application manuelle de la règle Plan média (P32, onglet Composition).
// Cycle propose → aperçu → confirme, rien n'est écrit avant « Confirmer ».
// Programmes éligibles = INTERSECTION : durée ∈ [min, max] ET coché par
// l'utilisateur. Items pré-cochés depuis regle.spot_ids (ou toute la
// bibliothèque si le pool de la règle est vide). Écriture en origine
// 'MANUELLE' (protégée : une génération auto ultérieure ne l'efface jamais).
export default function PanneauAppliquerRegleComposition({
  regle,
  spots = [],
  diffusions,
  programmesParId,
  elementsSecondairesActifs,
  dates,
  chaineActive,
  planMediaId,
  onFermer,
  onApplique,
}) {
  const points = useMemo(() => calculerPointsInsertion(dates, diffusions), [dates, diffusions])
  const diffusionsParId = useMemo(() => new Map(diffusions.map((d) => [d.id, d])), [diffusions])

  // Lignes de programmes : tous ceux du jour, dans l'ordre des points d'insertion.
  const lignesProgrammes = useMemo(
    () =>
      points
        .filter((p) => p.apresTransmissionId != null)
        .map((p) => {
          const d = diffusionsParId.get(p.apresTransmissionId)
          const dureeMin = d ? dureeTransmissionMinutes(d) : 0
          return {
            coupureId: p.apresTransmissionId,
            titre: d ? (programmesParId.get(d.programme_id)?.titre ?? '—') : '—',
            plage: d ? `${d.heure_debut.slice(0, 5)}–${d.heure_fin.slice(0, 5)}` : '—',
            dureeMin,
            dansLaBande: dureeMin >= regle.duree_min_minutes && dureeMin <= regle.duree_max_minutes,
          }
        }),
    [points, diffusionsParId, programmesParId, regle.duree_min_minutes, regle.duree_max_minutes]
  )

  const [programmesCoches, setProgrammesCoches] = useState(() => new Set())
  const [itemsCoches, setItemsCoches] = useState(() => {
    const pool = regle.spot_ids?.length ? regle.spot_ids.filter((id) => spots.some((s) => s.id === id)) : spots.map((s) => s.id)
    return new Set(pool)
  })
  const [apercu, setApercu] = useState(null) // null = vue sélection ; sinon { groupes, nbTotal, nbSautes }
  const [exclus, setExclus] = useState(() => new Set())
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  function basculer(setSet, valeur) {
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(valeur)) next.delete(valeur)
      else next.add(valeur)
      return next
    })
  }

  function toutCocherProgrammes() {
    const dansLaBande = lignesProgrammes.filter((l) => l.dansLaBande).map((l) => l.coupureId)
    setProgrammesCoches((prev) => (prev.size === dansLaBande.length ? new Set() : new Set(dansLaBande)))
  }

  function toutCocherItems() {
    setItemsCoches((prev) => (prev.size === spots.length ? new Set() : new Set(spots.map((s) => s.id))))
  }

  const programmesEligibles = lignesProgrammes.filter((l) => l.dansLaBande && programmesCoches.has(l.coupureId))
  const itemsPool = spots.filter((s) => itemsCoches.has(s.id))
  const peutApercu = programmesEligibles.length > 0 && itemsPool.length > 0 && regle.nombre_annonces > 0

  function construireApercu() {
    let idx = 0
    let nbSautes = 0
    const groupes = programmesEligibles.map((prog) => {
      const intervalle = points.find((p) => p.apresTransmissionId === prog.coupureId)
      const elementsCoupure = elementsSecondairesActifs.filter(
        (e) => e.apres_transmission_id === prog.coupureId && e.date === intervalle.date
      )
      let curseurSec = elementsCoupure.length
        ? Math.max(...elementsCoupure.map((e) => heureHMSEnSecondes(e.heure_fin)))
        : intervalle.debut * 60
      const dejaPlaces = [...elementsCoupure]
      const placements = []
      for (let k = 0; k < regle.nombre_annonces; k++) {
        const item = itemsPool[idx % itemsPool.length]
        idx += 1
        const dureeSec = item.duree_secondes
        if (!estPlacementValide(curseurSec, dureeSec, intervalle, dejaPlaces)) {
          nbSautes += 1
          break
        }
        const ligne = {
          chaine_id: chaineActive.id,
          plan_media_id: planMediaId,
          date: intervalle.date,
          heure_debut: secondesEnHeureHMS(curseurSec),
          heure_fin: secondesEnHeureHMS(curseurSec + dureeSec),
          duree_secondes: dureeSec,
          apres_transmission_id: prog.coupureId,
          type: item.type,
          libelle: item.libelle,
          campagne_id: null,
          origine: 'MANUELLE',
          run_id: null,
        }
        placements.push(ligne)
        dejaPlaces.push(ligne)
        curseurSec += dureeSec
      }
      return { titre: prog.titre, plage: prog.plage, placements }
    })
    const nbTotal = groupes.reduce((n, g) => n + g.placements.length, 0)
    setExclus(new Set())
    setApercu({ groupes, nbTotal, nbSautes })
  }

  function cleLigne(gi, pi) {
    return `${gi}:${pi}`
  }

  const retenues = apercu
    ? apercu.groupes.flatMap((g, gi) => g.placements.filter((_, pi) => !exclus.has(cleLigne(gi, pi))))
    : []

  async function confirmer() {
    if (retenues.length === 0) return
    setEnregistrement(true)
    setErreur(null)
    try {
      await onApplique(retenues)
    } catch (err) {
      setErreur(err.message)
      setEnregistrement(false)
    }
  }

  return (
    <Modal titre="Appliquer la règle" onFermer={onFermer} large>
      {!apercu ? (
        <div className="space-y-5 text-sm">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Règle : programme de {regle.duree_min_minutes}–{regle.duree_max_minutes} min → {regle.nombre_annonces} annonce
            {regle.nombre_annonces > 1 ? 's' : ''} ajoutée{regle.nombre_annonces > 1 ? 's' : ''}. Rien n'est écrit avant l'aperçu et la confirmation.
          </p>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Programmes du jour</span>
              <button type="button" onClick={toutCocherProgrammes} className="text-xs font-medium text-snrt-navy hover:underline">
                Tout cocher (dans la bande)
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
              {lignesProgrammes.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Aucun programme ce jour-là.</p>}
              {lignesProgrammes.map((l) => (
                <label
                  key={l.coupureId}
                  className={`flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-xs last:border-0 ${
                    l.dansLaBande ? '' : 'opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!l.dansLaBande}
                    checked={programmesCoches.has(l.coupureId)}
                    onChange={() => basculer(setProgrammesCoches, l.coupureId)}
                  />
                  <span className="flex-1 truncate text-slate-700">{l.titre}</span>
                  <span className="font-mono text-slate-400">{l.plage}</span>
                  <span className="w-14 text-right text-slate-500">{l.dureeMin} min</span>
                  <span className={`w-24 text-right ${l.dansLaBande ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {l.dansLaBande ? 'dans la bande' : 'hors bande'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Items à piocher</span>
              <button type="button" onClick={toutCocherItems} className="text-xs font-medium text-snrt-navy hover:underline">
                Tout cocher
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
              {spots.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Bibliothèque de spots vide.</p>}
              {spots.map((s) => (
                <label key={s.id} className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-xs last:border-0">
                  <input
                    type="checkbox"
                    checked={itemsCoches.has(s.id)}
                    onChange={() => basculer(setItemsCoches, s.id)}
                  />
                  <span className="flex-1 truncate text-slate-700">{s.libelle}</span>
                  <span className="text-slate-400">
                    {LIBELLES_TYPE[s.type] ?? s.type} · {s.duree_secondes}s
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onFermer}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={construireApercu}
              disabled={!peutApercu}
              className="rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              Aperçu
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
              {apercu.nbTotal} élément{apercu.nbTotal > 1 ? 's' : ''} · {apercu.groupes.length} coupure
              {apercu.groupes.length > 1 ? 's' : ''}
            </span>
            {apercu.nbSautes > 0 && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                {apercu.nbSautes} emplacement{apercu.nbSautes > 1 ? 's' : ''} sauté{apercu.nbSautes > 1 ? 's' : ''}
                {' '}(chevauchement ou hors bornes)
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
            {apercu.groupes.map((g, gi) => (
              <div key={gi} className="border-b border-slate-100 last:border-0">
                <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  {g.titre} <span className="font-mono text-slate-400">{g.plage}</span>
                </div>
                {g.placements.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-slate-400">Aucun emplacement disponible.</p>
                ) : (
                  g.placements.map((p, pi) => (
                    <label
                      key={pi}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                        exclus.has(cleLigne(gi, pi)) ? 'opacity-40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!exclus.has(cleLigne(gi, pi))}
                        onChange={() => basculer(setExclus, cleLigne(gi, pi))}
                      />
                      <span className="font-mono text-slate-500">
                        {p.heure_debut.slice(0, 5)}–{p.heure_fin.slice(0, 5)}
                      </span>
                      <span className="text-slate-400">{LIBELLES_TYPE[p.type] ?? p.type}</span>
                      <span className="flex-1 truncate text-slate-700">{p.libelle}</span>
                    </label>
                  ))
                )}
              </div>
            ))}
          </div>

          {erreur && <p className="text-xs text-red-600">{erreur}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApercu(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={enregistrement || retenues.length === 0}
              className="rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Écriture…' : `Confirmer (${retenues.length})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
