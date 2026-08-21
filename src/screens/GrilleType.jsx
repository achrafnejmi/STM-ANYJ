import { useRef, useEffect, useState } from 'react'
import { Plus, Undo2, Redo2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { listerBlocsGrilleTypeParChaine, creerBlocGrilleType, mettreAJourBlocGrilleType } from '../lib/db.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import { TYPES_BLOC } from '../lib/typesBloc.js'
import { couleurType } from '../lib/couleursType.js'
import { minutesEnHeure, minutesDepuisDebutAntenne, DEBUT_JOURNEE_ANTENNE } from '../lib/semaine.js'
import {
  PX_PAR_MINUTE,
  HAUTEUR_TOTALE,
  PAS_ARRONDI_MIN,
  genererMarquesHeures,
  positionVersMinute,
  disposerEnPistes,
} from '../lib/grilleAxe.js'
import PaletteTypes from '../components/PaletteTypes.jsx'
import PanneauBlocGrilleType from '../components/PanneauBlocGrilleType.jsx'

const MARQUES_HEURES = genererMarquesHeures()

// Calendrier hebdomadaire FIXE (pas de date ni de navigation semaine
// précédente/suivante) : un bloc_grille_type n'est pas daté, seulement
// rattaché à des jours de semaine récurrents (0=lundi..6=dimanche, même
// convention que semaine.js/P11).
const JOURS_SEMAINE = [
  { index: 0, label: 'Lundi' },
  { index: 1, label: 'Mardi' },
  { index: 2, label: 'Mercredi' },
  { index: 3, label: 'Jeudi' },
  { index: 4, label: 'Vendredi' },
  { index: 5, label: 'Samedi' },
  { index: 6, label: 'Dimanche' },
]

// Message de confirmation partagé (création par dépôt ET étirement) — jamais
// de fusion/écrasement automatique, juste une coexistence côte à côte comme
// n'importe quel autre chevauchement (EXG-M3-07) si l'utilisateur confirme.
function confirmerChevauchement(autre) {
  return window.confirm(
    `Ce créneau chevauche « ${autre.nom || autre.type_bloc || 'un bloc existant'} ». Continuer ? Les deux blocs resteront côte à côte.`
  )
}

// Premier bloc (hors celui qu'on exclut par id) dont les jours et l'horaire
// intersectent la plage candidate — même définition que seChevauchent dans
// anomalies.js.
function trouverChevauchement(idAExclure, candidat, tousLesBlocs) {
  const debut = minutesDepuisDebutAntenne(candidat.heure_debut)
  const fin = minutesDepuisDebutAntenne(candidat.heure_fin)
  return (
    tousLesBlocs.find((autre) => {
      if (autre.id === idAExclure) return false
      if (!candidat.jours.some((j) => autre.jours.includes(j))) return false
      const autreDebut = minutesDepuisDebutAntenne(autre.heure_debut)
      const autreFin = minutesDepuisDebutAntenne(autre.heure_fin)
      return fin > autreDebut && autreFin > debut
    }) ?? null
  )
}

// Étirement horizontal (poignées latérales) : ne touche que la plage
// CONTIGUË de `jours` du côté de la poignée saisie, jamais les jours détachés
// de l'autre côté ou non contigus. `jourOccurrence` = jour de la case saisie.
function plageContigueDroite(jours, depart) {
  let r = depart
  while (jours.includes(r + 1)) r++
  return r
}
function plageContigueGauche(jours, depart) {
  let l = depart
  while (jours.includes(l - 1)) l--
  return l
}
function calculerNouveauxJours(joursOriginaux, jourOccurrence, mode, jourPointeur) {
  const jours = new Set(joursOriginaux)
  if (mode === 'droite') {
    const r = plageContigueDroite(joursOriginaux, jourOccurrence)
    if (jourPointeur > r) {
      for (let j = r + 1; j <= jourPointeur; j++) jours.add(j)
    } else if (jourPointeur >= jourOccurrence && jourPointeur < r) {
      for (let j = jourPointeur + 1; j <= r; j++) jours.delete(j)
    }
  } else {
    const l = plageContigueGauche(joursOriginaux, jourOccurrence)
    if (jourPointeur < l) {
      for (let j = jourPointeur; j < l; j++) jours.add(j)
    } else if (jourPointeur <= jourOccurrence && jourPointeur > l) {
      for (let j = l; j < jourPointeur; j++) jours.delete(j)
    }
  }
  return [...jours].sort((a, b) => a - b)
}

export default function GrilleType({ chaineActive }) {
  const [blocs, setBlocs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [previsualisation, setPrevisualisation] = useState(null) // { blocId, heure_debut, heure_fin, jours }
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const [pleinEcran, setPleinEcran] = useState(false)
  const dragRef = useRef(null)
  const colonneRefs = useRef([])
  const etatRedimRef = useRef(null) // { bloc, mode, jourOccurrence, rectsColonnes }
  const previsualisationRef = useRef(null)
  const dernierRedimTermineRef = useRef(0)

  useEffect(() => {
    setChargement(true)
    setBlocSelectionne(null)
    listerBlocsGrilleTypeParChaine(chaineActive.id)
      .then(setBlocs)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  // Rafraîchi après chaque écriture (blocs change systématiquement après une
  // création/édition/suppression, y compris via undoManager).
  useEffect(() => {
    etatPile(chaineActive.id, 'GRILLE_TYPE').then(setPile)
  }, [chaineActive, blocs])

  // Ctrl+Z/Ctrl+Y locaux à cet écran, jamais interceptés si le focus est dans
  // un champ texte (même garde que GrilleLineaire.jsx).
  useEffect(() => {
    function onKeyDown(e) {
      const cible = document.activeElement
      if (cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        gererAnnuler()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        gererRetablir()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive par closure, seule dépendance réelle
  }, [chaineActive])

  const typesPresents = [...new Set(blocs.map((b) => b.type_bloc).filter(Boolean))]

  // Création directe en base (pas d'étape de formulaire intermédiaire), le
  // panneau s'ouvre ensuite sur le bloc fraîchement créé — même logique que
  // deposerEpisode dans GrilleLineaire.jsx (P10/P11).
  function creerEtSelectionner(champs) {
    setErreur(null)
    creerBlocGrilleType({ ...champs, chaine_id: chaineActive.id })
      .then((cree) =>
        enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'GRILLE_TYPE',
          libelle: `Création : ${cree.nom || cree.type_bloc || 'bloc'}`,
          operations: [{ table: 'bloc_grille_type', type: 'INSERT', id: cree.id, apres: cree }],
        }).then(() => {
          setBlocs((prev) => [...prev, cree])
          setBlocSelectionne(cree)
        })
      )
      .catch((err) => setErreur(err.message))
  }

  // Applique le résultat d'un Annuler/Rétablir à l'état local — même
  // mécanique que appliquerModification/appliquerSuppression.
  function appliquerChangementsPile(changements) {
    setBlocs((prev) => fusionnerChangements(prev, changements))
    setBlocSelectionne((actuel) => {
      if (!actuel) return actuel
      const c = changements.find((c) => c.id === actuel.id)
      return c ? c.ligne : actuel
    })
  }

  async function gererAnnuler() {
    const resultat = await annulerDerniereAction(chaineActive.id, 'GRILLE_TYPE')
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    const resultat = await retablirAction(chaineActive.id, 'GRILLE_TYPE')
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  // Chevauchement possible à la création (dépôt ou bouton) : confirmation,
  // jamais de fusion/écrasement silencieux — même règle qu'à l'étirement.
  function creerAvecVerification(champs) {
    const autre = trouverChevauchement(null, champs, blocs)
    if (autre && !confirmerChevauchement(autre)) return
    creerEtSelectionner(champs)
  }

  function deposerType(jourIndex, minuteDebut) {
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
    const type = TYPES_BLOC.find((t) => t.nom === payload.type)
    if (!type) return
    const dureeMin = minutesDepuisDebutAntenne(type.heure_fin) - minutesDepuisDebutAntenne(type.heure_debut)
    creerAvecVerification({
      nom: type.nom,
      type_bloc: type.nom,
      genre_attendu: type.genre_defaut,
      heure_debut: minutesEnHeure(minuteDebut),
      heure_fin: minutesEnHeure(minuteDebut + dureeMin),
      jours: [jourIndex],
      frequence: 'Quotidien',
    })
  }

  // Bouton "+ Ajouter un bloc" : fallback clavier/sans souris du
  // glisser-déposer, valeurs génériques (renommables tout de suite dans le
  // panneau qui s'ouvre juste après, comme pour le dépôt).
  function nouveauBlocGenerique() {
    const type = TYPES_BLOC[0]
    creerAvecVerification({
      nom: type.nom,
      type_bloc: type.nom,
      genre_attendu: type.genre_defaut,
      heure_debut: '15:00',
      heure_fin: '17:00',
      jours: [0],
      frequence: 'Quotidien',
    })
  }

  function appliquerModification(maj) {
    setBlocs((prev) => prev.map((b) => (b.id === maj.id ? maj : b)))
    setBlocSelectionne((actuel) => (actuel && actuel.id === maj.id ? maj : actuel))
  }

  function appliquerSuppression(id) {
    setBlocs((prev) => prev.filter((b) => b.id !== id))
    setBlocSelectionne(null)
  }

  // --- Étirement des bords (évolution 2) : suivi souris manuel, pas de HTML5
  // DnD (nécessaire pour un retour visuel continu). Une seule écriture au
  // relâchement ; annulation possible si chevauchement refusé.
  function demarrerRedimensionnement(e, bloc, jourOccurrence, mode) {
    e.preventDefault()
    e.stopPropagation()
    const rectsColonnes = colonneRefs.current.map((el) => el?.getBoundingClientRect())
    etatRedimRef.current = { bloc, mode, jourOccurrence, rectsColonnes }
    const preview = { blocId: bloc.id, heure_debut: bloc.heure_debut.slice(0, 5), heure_fin: bloc.heure_fin.slice(0, 5), jours: bloc.jours }
    previsualisationRef.current = preview
    setPrevisualisation(preview)
    window.addEventListener('mousemove', gererDeplacementRedim)
    window.addEventListener('mouseup', terminerRedimensionnement)
  }

  function gererDeplacementRedim(e) {
    const etat = etatRedimRef.current
    if (!etat) return
    if (etat.mode === 'haut' || etat.mode === 'bas') {
      const rect = etat.rectsColonnes[etat.jourOccurrence]
      if (!rect) return
      const minute = positionVersMinute(e.clientY - rect.top)
      const debutMin = minutesDepuisDebutAntenne(etat.bloc.heure_debut)
      const finMin = minutesDepuisDebutAntenne(etat.bloc.heure_fin)
      let nouvelle
      if (etat.mode === 'bas') {
        if (minute - debutMin < PAS_ARRONDI_MIN) return
        nouvelle = { ...previsualisationRef.current, heure_fin: minutesEnHeure(minute) }
      } else {
        if (finMin - minute < PAS_ARRONDI_MIN) return
        nouvelle = { ...previsualisationRef.current, heure_debut: minutesEnHeure(minute) }
      }
      previsualisationRef.current = nouvelle
      setPrevisualisation(nouvelle)
    } else {
      const index = etat.rectsColonnes.findIndex((r) => r && e.clientX >= r.left && e.clientX < r.right)
      let jourPointeur = index
      if (index === -1) {
        const premier = etat.rectsColonnes[0]
        jourPointeur = premier && e.clientX < premier.left ? 0 : 6
      }
      const nouvelle = {
        ...previsualisationRef.current,
        jours: calculerNouveauxJours(etat.bloc.jours, etat.jourOccurrence, etat.mode, jourPointeur),
      }
      previsualisationRef.current = nouvelle
      setPrevisualisation(nouvelle)
    }
  }

  async function terminerRedimensionnement() {
    window.removeEventListener('mousemove', gererDeplacementRedim)
    window.removeEventListener('mouseup', terminerRedimensionnement)
    const etat = etatRedimRef.current
    const preview = previsualisationRef.current
    etatRedimRef.current = null
    previsualisationRef.current = null
    setPrevisualisation(null)
    dernierRedimTermineRef.current = Date.now()
    if (!etat || !preview) return

    const inchange =
      preview.heure_debut === etat.bloc.heure_debut.slice(0, 5) &&
      preview.heure_fin === etat.bloc.heure_fin.slice(0, 5) &&
      JSON.stringify(preview.jours) === JSON.stringify(etat.bloc.jours)
    if (inchange) return

    const candidat = { heure_debut: preview.heure_debut, heure_fin: preview.heure_fin, jours: preview.jours }
    const autre = trouverChevauchement(etat.bloc.id, candidat, blocs)
    if (autre && !confirmerChevauchement(autre)) return // annulé : aucune écriture, le bloc reprend son état d'origine

    try {
      const maj = await mettreAJourBlocGrilleType(etat.bloc.id, candidat)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_TYPE',
        libelle: `Déplacement/étirement : ${etat.bloc.nom || etat.bloc.type_bloc || 'bloc'}`,
        operations: [{ table: 'bloc_grille_type', type: 'UPDATE', id: etat.bloc.id, avant: etat.bloc, apres: maj }],
      })
      appliquerModification(maj)
    } catch (err) {
      setErreur(err.message)
    }
  }

  function selectionnerBloc(bloc) {
    if (Date.now() - dernierRedimTermineRef.current < 200) return // ignore le clic qui suit un étirement (mousedown/up sur le même bloc)
    setBlocSelectionne(bloc)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Grille type — {chaineActive.nom}</h2>
            <p className="text-sm text-slate-500">La grille type décrit la structure de la journée, pas les titres.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPleinEcran((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                pleinEcran ? 'border-snrt-navy bg-snrt-navy/5 text-snrt-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={pleinEcran ? 'Afficher le panneau des types de bloc' : 'Masquer le panneau des types de bloc pour élargir la grille'}
            >
              {pleinEcran ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              Plein écran
            </button>
            <div className="flex rounded-md border border-slate-300">
              <button
                type="button"
                onClick={gererAnnuler}
                disabled={!pile.peutAnnuler}
                title={pile.peutAnnuler ? `Annuler : ${pile.libelleAnnuler}` : 'Rien à annuler'}
                className="rounded-l-md border-r border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={gererRetablir}
                disabled={!pile.peutRetablir}
                title={pile.peutRetablir ? `Rétablir : ${pile.libelleRetablir}` : 'Rien à rétablir'}
                className="rounded-r-md p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Redo2 size={15} />
              </button>
            </div>
            <button
              type="button"
              onClick={nouveauBlocGenerique}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              <Plus size={16} />
              Ajouter un bloc
            </button>
          </div>
        </div>

        {typesPresents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            {typesPresents.map((t) => {
              const { fond } = couleurType(t)
              return (
                <span key={t} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${fond}`} />
                  {t}
                </span>
              )
            })}
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="flex items-start gap-4">
        {!pleinEcran && <PaletteTypes dragRef={dragRef} />}

        {!chargement && (
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${JOURS_SEMAINE.length}, minmax(140px, 1fr))` }}>
                <div className="sticky top-0 z-10 bg-white" style={{ gridRow: 1, gridColumn: 1 }} />
                {JOURS_SEMAINE.map((j, i) => (
                  <div
                    key={j.index}
                    style={{ gridRow: 1, gridColumn: i + 2 }}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600"
                  >
                    {j.label}
                  </div>
                ))}

                <div className="relative" style={{ gridRow: 2, gridColumn: 1, height: HAUTEUR_TOTALE }}>
                  {MARQUES_HEURES.map((m) => (
                    <div
                      key={m}
                      style={{ position: 'absolute', top: (m - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE - 6, right: 8 }}
                      className="text-[11px] text-slate-400"
                    >
                      {minutesEnHeure(m)}
                    </div>
                  ))}
                </div>

                {JOURS_SEMAINE.map((j, i) => {
                  const blocsDuJour = blocs.filter((b) => b.jours.includes(j.index))
                  const pistees = disposerEnPistes(blocsDuJour)
                  return (
                    <div
                      key={j.index}
                      ref={(el) => {
                        colonneRefs.current[j.index] = el
                      }}
                      className="relative border-l border-slate-100"
                      style={{ gridRow: 2, gridColumn: i + 2, height: HAUTEUR_TOTALE }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top)
                        deposerType(j.index, minute)
                      }}
                    >
                      {MARQUES_HEURES.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: (m - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE }}
                        />
                      ))}
                      {pistees.map(({ item: bloc, debut: debutOrig, fin: finOrig, piste, nbPistes }) => {
                        const enPrevisualisation = previsualisation?.blocId === bloc.id
                        const debut = enPrevisualisation
                          ? minutesDepuisDebutAntenne(previsualisation.heure_debut)
                          : debutOrig
                        const fin = enPrevisualisation ? minutesDepuisDebutAntenne(previsualisation.heure_fin) : finOrig
                        // Pendant un étirement horizontal, seule l'occurrence
                        // saisie doit disparaître si son jour est retiré de la
                        // prévisualisation (les autres occurrences du même
                        // bloc restent à leur état d'origine, affichées normalement).
                        if (enPrevisualisation && !previsualisation.jours.includes(j.index)) return null
                        const top = (debut - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
                        const hauteur = Math.max(14, (fin - debut) * PX_PAR_MINUTE - 2)
                        const { fond, texte } = couleurType(bloc.type_bloc)
                        const estSelectionne = blocSelectionne?.id === bloc.id
                        return (
                          <button
                            type="button"
                            key={bloc.id}
                            onClick={() => selectionnerBloc(bloc)}
                            className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte} ${
                              estSelectionne ? 'ring-2 ring-offset-1 ring-snrt-navy' : ''
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${hauteur}px`,
                              left: `${(piste / nbPistes) * 100}%`,
                              width: `${100 / nbPistes}%`,
                            }}
                          >
                            <div
                              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize hover:bg-black/20"
                              onMouseDown={(e) => demarrerRedimensionnement(e, bloc, j.index, 'haut')}
                            />
                            <div
                              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize hover:bg-black/20"
                              onMouseDown={(e) => demarrerRedimensionnement(e, bloc, j.index, 'bas')}
                            />
                            <div
                              className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-black/20"
                              onMouseDown={(e) => demarrerRedimensionnement(e, bloc, j.index, 'gauche')}
                            />
                            <div
                              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-black/20"
                              onMouseDown={(e) => demarrerRedimensionnement(e, bloc, j.index, 'droite')}
                            />
                            <div className="font-medium truncate">{bloc.nom || bloc.type_bloc}</div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {blocSelectionne && (
        <PanneauBlocGrilleType
          bloc={blocSelectionne}
          chaineActive={chaineActive}
          onFermer={() => setBlocSelectionne(null)}
          onModifie={appliquerModification}
          onSupprime={appliquerSuppression}
        />
      )}
    </div>
  )
}
