import { useId, useMemo, useRef, useEffect, useState } from 'react'
import { Plus, Pencil, Copy, Trash2, X, Undo2, Redo2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  listerGrillesTypeParChaine,
  listerBlocsGrilleTypeParChaine,
  creerBlocGrilleType,
  mettreAJourBlocGrilleType,
  creerGrilleType,
  mettreAJourGrilleType,
  supprimerGrilleType,
  definirGrilleTypeLive,
} from '../lib/db.js'
import { lireGrillesTypeOuvertes, definirGrillesTypeOuvertes, dupliquerGrilleType } from '../lib/grillesType.js'
import { lireUtilisateur } from '../lib/session.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import { TYPES_BLOC } from '../lib/typesBloc.js'
import { couleurType } from '../lib/couleursType.js'
import { minutesEnHeure, minutesDepuisDebutAntenne, DEBUT_JOURNEE_ANTENNE, aujourdHuiISO, formaterDateJJMMAAAA } from '../lib/semaine.js'
import {
  PX_PAR_MINUTE,
  HAUTEUR_TOTALE,
  PAS_ARRONDI_MIN,
  genererMarquesHeures,
  positionVersMinute,
  disposerEnPistes,
} from '../lib/grilleAxe.js'
import Modal from '../components/Modal.jsx'
import PaletteTypes from '../components/PaletteTypes.jsx'
import PanneauBlocGrilleType from '../components/PanneauBlocGrilleType.jsx'
import { useNotification } from '../components/NotificationProvider.jsx'

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
// `confirmer` = NotificationProvider.useNotification().confirmer (P21 Lot G) —
// injecté : fonction hors composant, pas d'accès direct aux hooks.
function confirmerChevauchement(autre, confirmer) {
  return confirmer({
    titre: 'Chevauchement',
    message: `Ce créneau chevauche « ${autre.nom || autre.type_bloc || 'un bloc existant'} ». Continuer ? Les deux blocs resteront côte à côte.`,
    labelConfirmer: 'Continuer',
  })
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
  // Tous les blocs de la chaîne (toutes grilles type confondues), même
  // pattern que `diffusions`/`diffusionsGrilleActive` en Grille linéaire
  // (P23) : un seul chargement par chaîne, filtrage en mémoire par document
  // actif — bascule d'onglet instantanée, pas d'aller-retour réseau.
  const [blocsChaine, setBlocsChaine] = useState([])
  const [grillesType, setGrillesType] = useState([])
  const [grillesTypeOuvertesIds, setGrillesTypeOuvertesIds] = useState([])
  const [grilleTypeActiveId, setGrilleTypeActiveId] = useState(null)
  const [modaleGrilleType, setModaleGrilleType] = useState(null) // 'OUVRIR' | 'RENOMMER' | 'DUPLIQUER'
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [blocModifie, setBlocModifie] = useState(false)
  const [previsualisation, setPrevisualisation] = useState(null) // { blocId, heure_debut, heure_fin, jours }
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const [pleinEcran, setPleinEcran] = useState(false)
  const dragRef = useRef(null)
  const colonneRefs = useRef([])
  const etatRedimRef = useRef(null) // { bloc, mode, jourOccurrence, rectsColonnes }
  const previsualisationRef = useRef(null)
  const dernierRedimTermineRef = useRef(0)
  const chargementIdRef = useRef(0)
  const { confirmer } = useNotification()

  // `chargementIdRef` ignore une réponse dépassée par un chargement plus
  // récent (StrictMode double-invoque cet effet en dev — même garde que
  // GrilleLineaire.jsx/P23).
  useEffect(() => {
    const idAppel = ++chargementIdRef.current
    setChargement(true)
    setErreur(null)
    setBlocSelectionne(null)
    Promise.all([listerGrillesTypeParChaine(chaineActive.id), listerBlocsGrilleTypeParChaine(chaineActive.id)])
      .then(([lignesGrillesType, lignesBlocs]) => {
        if (idAppel !== chargementIdRef.current) return
        setGrillesType(lignesGrillesType)
        setBlocsChaine(lignesBlocs)
        const live = lignesGrillesType.find((g) => g.est_live)
        const sauvegardees = lireGrillesTypeOuvertes(chaineActive.code).filter((id) => lignesGrillesType.some((g) => g.id === id))
        const ouvertes = sauvegardees.length > 0 ? sauvegardees : [live?.id].filter(Boolean)
        setGrillesTypeOuvertesIds(ouvertes)
        setGrilleTypeActiveId(ouvertes[0] ?? null)
      })
      .catch((err) => {
        if (idAppel === chargementIdRef.current) setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === chargementIdRef.current) setChargement(false)
      })
  }, [chaineActive])

  // Persiste la liste des onglets ouverts en session (par chaîne) — même
  // pattern que GrilleLineaire.jsx (P23).
  useEffect(() => {
    if (grillesTypeOuvertesIds.length > 0) definirGrillesTypeOuvertes(chaineActive.code, grillesTypeOuvertesIds)
  }, [chaineActive.code, grillesTypeOuvertesIds])

  const grilleTypeActive = useMemo(() => grillesType.find((g) => g.id === grilleTypeActiveId) ?? null, [grillesType, grilleTypeActiveId])
  const grillesTypeOuvertes = useMemo(
    () => grillesTypeOuvertesIds.map((id) => grillesType.find((g) => g.id === id)).filter(Boolean),
    [grillesTypeOuvertesIds, grillesType]
  )

  // Blocs du document actuellement OUVERT — chaque grille type a ses propres
  // blocs, jamais mélangés à l'écran.
  const blocs = useMemo(
    () => (grilleTypeActiveId ? blocsChaine.filter((b) => b.grille_type_id === grilleTypeActiveId) : []),
    [blocsChaine, grilleTypeActiveId]
  )

  // Suggestion saisonnière (P28) : jamais de bascule automatique — juste un
  // bandeau proposant de définir comme live la grille type dont la fenêtre de
  // dates couvre aujourd'hui, si elle ne l'est pas déjà.
  const aujourdHui = aujourdHuiISO()
  const suggestionSaisonniere = useMemo(
    () =>
      grillesType.find(
        (g) => !g.est_live && g.date_debut && g.date_fin && aujourdHui >= g.date_debut && aujourdHui <= g.date_fin
      ) ?? null,
    [grillesType, aujourdHui]
  )

  // Rafraîchi après chaque écriture (blocs change systématiquement après une
  // création/édition/suppression, y compris via undoManager) — pile scopée
  // par document ouvert (comme GRILLE_LINEAIRE/PLAN_MEDIA en P23/P24).
  useEffect(() => {
    if (!grilleTypeActive) return
    etatPile(chaineActive.id, 'GRILLE_TYPE', grilleTypeActive.id).then(setPile)
  }, [chaineActive, grilleTypeActive, blocsChaine])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive/grilleTypeActive par closure, seules dépendances réelles
  }, [chaineActive, grilleTypeActive])

  const typesPresents = [...new Set(blocs.map((b) => b.type_bloc).filter(Boolean))]

  // Création directe en base (pas d'étape de formulaire intermédiaire), le
  // panneau s'ouvre ensuite sur le bloc fraîchement créé — même logique que
  // deposerEpisode dans GrilleLineaire.jsx (P10/P11).
  function creerEtSelectionner(champs) {
    if (!grilleTypeActive) return
    setErreur(null)
    creerBlocGrilleType({ ...champs, chaine_id: chaineActive.id, grille_type_id: grilleTypeActive.id })
      .then((cree) =>
        enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'GRILLE_TYPE',
          documentId: grilleTypeActive.id,
          libelle: `Création : ${cree.nom || cree.type_bloc || 'bloc'}`,
          operations: [{ table: 'bloc_grille_type', type: 'INSERT', id: cree.id, apres: cree }],
        }).then(() => {
          setBlocsChaine((prev) => [...prev, cree])
          setBlocSelectionne(cree)
        })
      )
      .catch((err) => setErreur(err.message))
  }

  // Applique le résultat d'un Annuler/Rétablir à l'état local — même
  // mécanique que appliquerModification/appliquerSuppression.
  function appliquerChangementsPile(changements) {
    setBlocsChaine((prev) => fusionnerChangements(prev, changements))
    setBlocSelectionne((actuel) => {
      if (!actuel) return actuel
      const c = changements.find((c) => c.id === actuel.id)
      return c ? c.ligne : actuel
    })
  }

  async function gererAnnuler() {
    if (!grilleTypeActive) return
    const resultat = await annulerDerniereAction(chaineActive.id, 'GRILLE_TYPE', grilleTypeActive.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    if (!grilleTypeActive) return
    const resultat = await retablirAction(chaineActive.id, 'GRILLE_TYPE', grilleTypeActive.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  // Chevauchement possible à la création (dépôt ou bouton) : confirmation,
  // jamais de fusion/écrasement silencieux — même règle qu'à l'étirement.
  async function creerAvecVerification(champs) {
    const autre = trouverChevauchement(null, champs, blocs)
    if (autre && !(await confirmerChevauchement(autre, confirmer))) return
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
    setBlocsChaine((prev) => prev.map((b) => (b.id === maj.id ? maj : b)))
    setBlocSelectionne((actuel) => (actuel && actuel.id === maj.id ? maj : actuel))
  }

  function appliquerSuppression(id) {
    setBlocsChaine((prev) => prev.filter((b) => b.id !== id))
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
    if (autre && !(await confirmerChevauchement(autre, confirmer))) return // annulé : aucune écriture, le bloc reprend son état d'origine

    try {
      const maj = await mettreAJourBlocGrilleType(etat.bloc.id, candidat)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_TYPE',
        documentId: grilleTypeActive?.id,
        libelle: `Déplacement/étirement : ${etat.bloc.nom || etat.bloc.type_bloc || 'bloc'}`,
        operations: [{ table: 'bloc_grille_type', type: 'UPDATE', id: etat.bloc.id, avant: etat.bloc, apres: maj }],
      })
      appliquerModification(maj)
    } catch (err) {
      setErreur(err.message)
    }
  }

  // --- Gestion des grilles type (P28, même pattern que GrilleLineaire.jsx/P23) ---

  function selectionnerGrilleType(id) {
    setGrilleTypeActiveId(id)
    setBlocSelectionne(null)
  }

  function ouvrirGrilleType(id) {
    setGrillesTypeOuvertesIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    selectionnerGrilleType(id)
  }

  function fermerOnglet(id) {
    setGrillesTypeOuvertesIds((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((x) => x !== id)
      if (grilleTypeActiveId === id) selectionnerGrilleType(next[0])
      return next
    })
  }

  async function creerEtOuvrirGrilleType(nom, dateDebut, dateFin) {
    const nouvelle = await creerGrilleType({
      chaine_id: chaineActive.id,
      nom,
      est_live: false,
      date_debut: dateDebut || null,
      date_fin: dateFin || null,
      cree_par: lireUtilisateur(),
    })
    setGrillesType((prev) => [...prev, nouvelle])
    ouvrirGrilleType(nouvelle.id)
    setModaleGrilleType(null)
  }

  async function renommerGrilleTypeActive(nom, dateDebut, dateFin) {
    const maj = await mettreAJourGrilleType(grilleTypeActive.id, { nom, date_debut: dateDebut || null, date_fin: dateFin || null })
    setGrillesType((prev) => prev.map((g) => (g.id === maj.id ? maj : g)))
    setModaleGrilleType(null)
  }

  async function dupliquerGrilleTypeActive(nom, dateDebut, dateFin) {
    const nouvelle = await dupliquerGrilleType(grilleTypeActive, nom, lireUtilisateur())
    const avecDates = dateDebut || dateFin ? await mettreAJourGrilleType(nouvelle.id, { date_debut: dateDebut || null, date_fin: dateFin || null }) : nouvelle
    const lignesBlocs = await listerBlocsGrilleTypeParChaine(chaineActive.id)
    setGrillesType((prev) => [...prev, avecDates])
    setBlocsChaine(lignesBlocs)
    ouvrirGrilleType(avecDates.id)
    setModaleGrilleType(null)
  }

  async function definirLiveGrilleType() {
    if (!grilleTypeActive || grilleTypeActive.est_live) return
    const liveActuelle = grillesType.find((g) => g.est_live)
    const confirme = await confirmer({
      titre: 'Définir comme live',
      message: `Définir « ${grilleTypeActive.nom} » comme grille type live de ${chaineActive.nom} ? Elle remplacera « ${liveActuelle?.nom ?? '—'} » pour la Grille linéaire, les Anomalies et l'Auto-programmation.`,
      labelConfirmer: 'Définir comme live',
    })
    if (!confirme) return
    await definirGrilleTypeLive(chaineActive.id, grilleTypeActive.id)
    setGrillesType(await listerGrillesTypeParChaine(chaineActive.id))
  }

  async function supprimerGrilleTypeActive() {
    if (!grilleTypeActive || grilleTypeActive.est_live) return
    const nb = blocsChaine.filter((b) => b.grille_type_id === grilleTypeActive.id).length
    const confirme = await confirmer({
      titre: 'Supprimer la grille type',
      message: `Supprimer définitivement « ${grilleTypeActive.nom} »${nb > 0 ? ` et ses ${nb} bloc(s)` : ''} ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!confirme) return
    const idSupprime = grilleTypeActive.id
    await supprimerGrilleType(idSupprime)
    setGrillesType((prev) => prev.filter((g) => g.id !== idSupprime))
    setBlocsChaine((prev) => prev.filter((b) => b.grille_type_id !== idSupprime))
    setGrillesTypeOuvertesIds((prev) => {
      const next = prev.filter((x) => x !== idSupprime)
      const restante = next.length > 0 ? next : [grillesType.find((g) => g.est_live)?.id].filter(Boolean)
      setGrilleTypeActiveId(restante[0] ?? null)
      return restante
    })
  }

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : passe par ici
  // pour changer OU fermer (bloc=null) le bloc inspecté — blocModifie est
  // reporté par PanneauBlocGrilleType.
  async function selectionnerBloc(bloc) {
    if (Date.now() - dernierRedimTermineRef.current < 200) return // ignore le clic qui suit un étirement (mousedown/up sur le même bloc)
    if (blocSelectionne && blocModifie) {
      const ok = await confirmer({
        titre: 'Modifications non enregistrées',
        message: 'Modifications non enregistrées. Quitter sans enregistrer ?',
        labelConfirmer: 'Quitter sans enregistrer',
        labelAnnuler: 'Rester',
      })
      if (!ok) return
    }
    setBlocSelectionne(bloc)
    setBlocModifie(false)
  }

  return (
    <div className="space-y-6">
      {suggestionSaisonniere && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            Période « {suggestionSaisonniere.nom} » en cours ({formaterDateJJMMAAAA(suggestionSaisonniere.date_debut)}–
            {formaterDateJJMMAAAA(suggestionSaisonniere.date_fin)}) — définir cette grille type comme active ?
          </span>
          <button
            type="button"
            onClick={() => ouvrirGrilleType(suggestionSaisonniere.id)}
            className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Ouvrir « {suggestionSaisonniere.nom} »
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {/* Barre d'onglets (P28) : grilles type ouvertes de la chaîne active. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          {grillesTypeOuvertes.map((g) => (
            <div
              key={g.id}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                g.id === grilleTypeActiveId
                  ? 'border-snrt-navy bg-snrt-navy/5 font-medium text-snrt-navy'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <button type="button" onClick={() => selectionnerGrilleType(g.id)} className="flex items-center gap-1.5">
                {g.nom}
                {g.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
                {g.date_debut && g.date_fin && (
                  <span className="text-[10px] text-slate-400">
                    {formaterDateJJMMAAAA(g.date_debut)}–{formaterDateJJMMAAAA(g.date_fin)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => fermerOnglet(g.id)}
                disabled={grillesTypeOuvertes.length <= 1}
                title={grillesTypeOuvertes.length <= 1 ? 'Dernier onglet ouvert' : 'Fermer (la grille type reste enregistrée)'}
                className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setModaleGrilleType('OUVRIR')}
            title="Ouvrir une grille type"
            className="rounded-md border border-dashed border-slate-300 p-1.5 text-slate-500 hover:border-snrt-navy hover:text-snrt-navy"
          >
            <Plus size={15} />
          </button>

          {grilleTypeActive && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModaleGrilleType('RENOMMER')}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={12} />
                Renommer
              </button>
              <button
                type="button"
                onClick={() => setModaleGrilleType('DUPLIQUER')}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Copy size={12} />
                Dupliquer
              </button>
              {!grilleTypeActive.est_live && (
                <button
                  type="button"
                  onClick={definirLiveGrilleType}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Définir comme live
                </button>
              )}
              <button
                type="button"
                onClick={supprimerGrilleTypeActive}
                disabled={grilleTypeActive.est_live}
                title={grilleTypeActive.est_live ? 'Basculez une autre grille type en live avant de supprimer celle-ci' : 'Supprimer'}
                className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={12} />
                Supprimer
              </button>
            </div>
          )}
        </div>

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
              disabled={!grilleTypeActive}
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
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
          grilleTypeId={grilleTypeActive?.id}
          onFermer={() => selectionnerBloc(null)}
          onModifie={appliquerModification}
          onSupprime={appliquerSuppression}
          onModifieChange={setBlocModifie}
        />
      )}

      {modaleGrilleType === 'OUVRIR' && (
        <ModaleOuvrirGrilleType
          grillesType={grillesType}
          grillesTypeOuvertesIds={grillesTypeOuvertesIds}
          onOuvrir={ouvrirGrilleType}
          onCreer={creerEtOuvrirGrilleType}
          onFermer={() => setModaleGrilleType(null)}
        />
      )}
      {modaleGrilleType === 'RENOMMER' && grilleTypeActive && (
        <ModaleNomGrilleType
          titre="Renommer la grille type"
          valeurInitiale={grilleTypeActive.nom}
          dateDebutInitiale={grilleTypeActive.date_debut ?? ''}
          dateFinInitiale={grilleTypeActive.date_fin ?? ''}
          labelBouton="Renommer"
          onValider={renommerGrilleTypeActive}
          onFermer={() => setModaleGrilleType(null)}
        />
      )}
      {modaleGrilleType === 'DUPLIQUER' && grilleTypeActive && (
        <ModaleNomGrilleType
          titre="Dupliquer la grille type"
          valeurInitiale={`${grilleTypeActive.nom} (copie)`}
          dateDebutInitiale={grilleTypeActive.date_debut ?? ''}
          dateFinInitiale={grilleTypeActive.date_fin ?? ''}
          labelBouton="Dupliquer"
          onValider={dupliquerGrilleTypeActive}
          onFermer={() => setModaleGrilleType(null)}
        />
      )}
    </div>
  )
}

// Panneau "Ouvrir une grille type" (P28, miroir GrilleLineaire.jsx/P23) :
// liste des documents de la chaîne pas encore ouverts + création d'un
// nouveau (nom + fenêtre de dates optionnelle), dans la même modale.
function ModaleOuvrirGrilleType({ grillesType, grillesTypeOuvertesIds, onOuvrir, onCreer, onFermer }) {
  const [nomNouvelle, setNomNouvelle] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [creation, setCreation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()
  const idDebut = useId()
  const idFin = useId()
  const fermees = grillesType.filter((g) => !grillesTypeOuvertesIds.includes(g.id))

  async function creer(e) {
    e.preventDefault()
    if (!nomNouvelle.trim()) return
    setCreation(true)
    setErreur(null)
    try {
      await onCreer(nomNouvelle.trim(), dateDebut, dateFin)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setCreation(false)
    }
  }

  return (
    <Modal titre="Ouvrir une grille type" onFermer={onFermer}>
      <div className="space-y-4">
        {fermees.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
            {fermees.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onOuvrir(g.id)}
                className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
              >
                <span>
                  {g.nom}
                  {g.date_debut && g.date_fin && (
                    <span className="ml-2 text-xs text-slate-400">
                      {formaterDateJJMMAAAA(g.date_debut)}–{formaterDateJJMMAAAA(g.date_fin)}
                    </span>
                  )}
                </span>
                {g.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Toutes les grilles type de cette chaîne sont déjà ouvertes.</p>
        )}
        <form onSubmit={creer} className="space-y-3 border-t border-slate-100 pt-4">
          <div>
            <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
              Nouvelle grille type
            </label>
            <input
              id={idNom}
              type="text"
              value={nomNouvelle}
              onChange={(e) => setNomNouvelle(e.target.value)}
              placeholder="ex. Ramadan 2027"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={idDebut} className="mb-1 block text-xs font-medium text-slate-700">
                Période saisonnière — début (optionnel)
              </label>
              <input
                id={idDebut}
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor={idFin} className="mb-1 block text-xs font-medium text-slate-700">
                Fin
              </label>
              <input
                id={idFin}
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creation || !nomNouvelle.trim()}
            className="w-full rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            Créer
          </button>
        </form>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      </div>
    </Modal>
  )
}

// Modale nom + dates saisonnières (P28, miroir ModaleNomGrille/P23) —
// réutilisée par Renommer et Dupliquer, les 2 dates restent modifiables
// chaque année (pas de calcul astronomique du Ramadan).
function ModaleNomGrilleType({ titre, valeurInitiale, dateDebutInitiale, dateFinInitiale, labelBouton, onValider, onFermer }) {
  const [nom, setNom] = useState(valeurInitiale)
  const [dateDebut, setDateDebut] = useState(dateDebutInitiale)
  const [dateFin, setDateFin] = useState(dateFinInitiale)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()
  const idDebut = useId()
  const idFin = useId()

  async function soumettre(e) {
    e.preventDefault()
    if (!nom.trim()) return
    setEnCours(true)
    setErreur(null)
    try {
      await onValider(nom.trim(), dateDebut, dateFin)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modal titre={titre} onFermer={onFermer}>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
            Nom
          </label>
          <input
            id={idNom}
            type="text"
            required
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idDebut} className="mb-1 block text-xs font-medium text-slate-700">
              Période saisonnière — début (optionnel)
            </label>
            <input
              id={idDebut}
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor={idFin} className="mb-1 block text-xs font-medium text-slate-700">
              Fin
            </label>
            <input
              id={idFin}
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={enCours}
            className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            {enCours ? 'Enregistrement…' : labelBouton}
          </button>
        </div>
      </form>
    </Modal>
  )
}
