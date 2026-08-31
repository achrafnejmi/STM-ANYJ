import { useEffect, useId, useRef, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import {
  ChevronLeft,
  ChevronRight,
  Library,
  PlusSquare,
  Upload,
  Plus,
  Pencil,
  Copy,
  Trash2,
  CheckSquare,
  ClipboardPaste,
  Undo2,
  Redo2,
  X,
  MoreHorizontal,
} from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleLiveParChaine,
  listerCampagnesParChaine,
  listerElementsSecondairesParChaine,
  listerSpotsBibliotheque,
  creerElementSecondaire,
  creerElementsSecondaires,
  supprimerElementsSecondairesAutomatiquesParPeriode,
  listerPlanMediaParChaine,
  creerPlanMedia,
  mettreAJourPlanMedia,
  supprimerPlanMedia,
  definirPlanMediaLive,
} from '../lib/db.js'
import { lireDocumentsOuverts, definirDocumentsOuverts, dupliquerPlanMedia } from '../lib/plansMedia.js'
import { lireUtilisateur } from '../lib/session.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import {
  aujourdHuiISO,
  ajouterJours,
  lundiDeLaSemaine,
  joursDeLaSemaine,
  formaterPlageSemaine,
  formaterDateLongue,
  formaterJourCourt,
} from '../lib/semaine.js'
import {
  calculerIntervalles,
  genererElementsSecondaires,
  estPlacementValide,
  heureHMSEnSecondes,
  DUREE_ECRAN_DEFAUT_SECONDES,
} from '../lib/planMedia.js'
import { calculerCouverture } from '../lib/couverture.js'
import {
  construireLignesPlanMedia,
  construireLignesTextePlanMedia,
  construireNomFichierPlanMedia,
  TITRE_FEUILLE_PLAN_MEDIA,
  ENTETE_PLAN_MEDIA,
} from '../lib/exportPlanMedia.js'
import { TRANCHES } from '../lib/tranches.js'
import Modal from '../components/Modal.jsx'
import TableauCampagnes from '../components/TableauCampagnes.jsx'
import PanneauReglesHabillage from '../components/PanneauReglesHabillage.jsx'
import PanneauApercuPlanMedia from '../components/PanneauApercuPlanMedia.jsx'
import PanneauCouvertureCampagnes from '../components/PanneauCouvertureCampagnes.jsx'
import BibliothequeSpots from '../components/BibliothequeSpots.jsx'
import BoutonExporter from '../components/BoutonExporter.jsx'
import PanneauInsertionManuelle from '../components/PanneauInsertionManuelle.jsx'
import PanneauImportPlanMedia from '../components/PanneauImportPlanMedia.jsx'
import { useNotification } from '../components/NotificationProvider.jsx'

const OPTS_DEFAUT = {
  habillageActif: true,
  ecranPubActif: true,
  bandesAnnoncesActives: true,
  dureeEcranSecondes: DUREE_ECRAN_DEFAUT_SECONDES,
  tranchesCommercialisees: TRANCHES.map((t) => t.code),
}

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}

// Champs copiés au presse-papier interne (P24) — jamais l'id/plan_media_id
// (une nouvelle ligne est toujours créée au collage). apres_transmission_id
// EST copié tel quel : tous les plans média d'une chaîne travaillent sur la
// même trame de diffusions live (Plan média ne lit que la grille live, P23),
// coller ne change donc jamais la date/heure/coupure — juste le document.
const CHAMPS_COPIABLES_ELEMENT = [
  'date',
  'heure_debut',
  'heure_fin',
  'duree_secondes',
  'apres_transmission_id',
  'type',
  'libelle',
  'campagne_id',
  'origine',
  'run_id',
]

export default function PlanMedia({ chaineActive }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [programmes, setProgrammes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [elementsSecondaires, setElementsSecondaires] = useState([])
  const [spots, setSpots] = useState([])
  const [planMedias, setPlanMedias] = useState([])
  const [planMediaOuvertsIds, setPlanMediaOuvertsIds] = useState([])
  const [planMediaActifId, setPlanMediaActifId] = useState(null)
  const [modaleDocument, setModaleDocument] = useState(null) // 'OUVRIR' | 'RENOMMER' | 'DUPLIQUER'
  // Retouche placement/couleur : Renommer/Dupliquer/Supprimer (actions rares sur le
  // document) regroupées derrière « … », même patron que GrilleType.jsx/GrilleLineaire.jsx.
  const [menuDocumentOuvert, setMenuDocumentOuvert] = useState(false)
  // P26bis : Composition (éditeur manuel, par défaut) / Génération auto
  // (secondaire) — pure réorganisation d'affichage, aucune donnée/logique
  // n'en dépend.
  const [ongletPanneau, setOngletPanneau] = useState('COMPOSITION')
  const [selectionActive, setSelectionActive] = useState(false)
  const [elementsSelectionnesIds, setElementsSelectionnesIds] = useState(() => new Set())
  const [presseGaPapier, setPresseGaPapier] = useState([])
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [opts, setOpts] = useState(OPTS_DEFAUT)
  const [proposition, setProposition] = useState(null)
  const [rapportEcrit, setRapportEcrit] = useState(null)
  const [derniereActionId, setDerniereActionId] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [annulation, setAnnulation] = useState(false)
  const [bibliothequeOuverte, setBibliothequeOuverte] = useState(false)
  const [insertionOuverte, setInsertionOuverte] = useState(false)
  const [importOuvert, setImportOuvert] = useState(false)
  const [spotPreselectionne, setSpotPreselectionne] = useState(null) // P26bis : raccourci "+" bibliothèque
  const chargementIdRef = useRef(0)
  const { confirmer } = useNotification()

  // P23 : le Plan média (M5) ne place ses éléments secondaires que sur la
  // grille LIVE de la chaîne — mélanger des grilles parallèles fausserait le
  // calcul des espaces publicitaires disponibles. P24 : charge aussi les
  // plans média de la chaîne. `chargementIdRef` ignore une réponse dépassée
  // par un chargement plus récent (StrictMode double-invoque cet effet en
  // dev, bug trouvé et corrigé en P23 — même garde ici dès le départ).
  async function chargerTout() {
    const idAppel = ++chargementIdRef.current
    setChargement(true)
    setErreur(null)
    try {
      const [grilleLive, lignesPlanMedia] = await Promise.all([
        obtenirGrilleLiveParChaine(chaineActive.id),
        listerPlanMediaParChaine(chaineActive.id),
      ])
      const [lignesProgrammes, lignesDiffusions, lignesCampagnes, lignesElements, lignesSpots] = await Promise.all([
        listerProgrammesParChaine(chaineActive.id),
        grilleLive ? listerDiffusionsLineairesParGrille(grilleLive.id) : Promise.resolve([]),
        listerCampagnesParChaine(chaineActive.id),
        listerElementsSecondairesParChaine(chaineActive.id),
        listerSpotsBibliotheque(chaineActive.id),
      ])
      if (idAppel !== chargementIdRef.current) return
      setProgrammes(lignesProgrammes)
      setDiffusions(lignesDiffusions)
      setCampagnes(lignesCampagnes)
      setElementsSecondaires(lignesElements)
      setSpots(lignesSpots)
      setPlanMedias(lignesPlanMedia)
      const live = lignesPlanMedia.find((p) => p.est_live)
      const sauvegardees = lireDocumentsOuverts(chaineActive.code).filter((id) => lignesPlanMedia.some((p) => p.id === id))
      const ouverts = sauvegardees.length > 0 ? sauvegardees : [live?.id].filter(Boolean)
      setPlanMediaOuvertsIds(ouverts)
      setPlanMediaActifId(ouverts[0] ?? null)
      setSelectionActive(false)
      setElementsSelectionnesIds(new Set())
      setPresseGaPapier([])
    } catch (err) {
      if (idAppel === chargementIdRef.current) setErreur(err.message)
    } finally {
      if (idAppel === chargementIdRef.current) setChargement(false)
    }
  }

  useEffect(() => {
    setProposition(null)
    setRapportEcrit(null)
    chargerTout()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne
  }, [chaineActive])

  // Persiste la liste des onglets ouverts en session (par chaîne) — même
  // pattern que GrilleLineaire.jsx (P23).
  useEffect(() => {
    if (planMediaOuvertsIds.length > 0) definirDocumentsOuverts(chaineActive.code, planMediaOuvertsIds)
  }, [chaineActive.code, planMediaOuvertsIds])

  const planMediaActif = useMemo(() => planMedias.find((p) => p.id === planMediaActifId) ?? null, [planMedias, planMediaActifId])
  const planMediasOuverts = useMemo(
    () => planMediaOuvertsIds.map((id) => planMedias.find((p) => p.id === id)).filter(Boolean),
    [planMediaOuvertsIds, planMedias]
  )

  // Rafraîchi après chaque écriture — pile scopée par document ouvert (comme
  // GRILLE_LINEAIRE en P23).
  useEffect(() => {
    if (!planMediaActif) return
    etatPile(chaineActive.id, 'PLAN_MEDIA', planMediaActif.id).then(setPile)
  }, [chaineActive, planMediaActif, elementsSecondaires])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive/planMediaActif par closure
  }, [chaineActive, planMediaActif])

  const lundi = lundiDeLaSemaine(dateReference)
  const dates = useMemo(() => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]), [vue, lundi, dateReference])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const campagnesParId = useMemo(() => new Map(campagnes.map((c) => [c.id, c])), [campagnes])

  // Filtrés sur le document actuellement OUVERT — chaque plan média a ses
  // propres éléments, tous chargés en mémoire pour permettre plusieurs
  // onglets sans aller-retour réseau (même pattern que diffusionsGrilleActive
  // en P23).
  const elementsSecondairesActifs = useMemo(
    () => (planMediaActif ? elementsSecondaires.filter((e) => e.plan_media_id === planMediaActif.id) : []),
    [elementsSecondaires, planMediaActif]
  )
  const elementsPeriode = useMemo(
    () => elementsSecondairesActifs.filter((e) => dates.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut)),
    [elementsSecondairesActifs, dates]
  )
  const couverture = useMemo(() => calculerCouverture(campagnes, elementsSecondairesActifs), [campagnes, elementsSecondairesActifs])

  function naviguer(delta) {
    setDateReference((d) => ajouterJours(d, vue === 'SEMAINE' ? 7 * delta : delta))
  }

  // Aucune écriture ici — pure lecture + calcul (planMedia.js). L'écriture
  // n'a lieu qu'après confirmation explicite dans confirmerGeneration().
  function generer() {
    if (!planMediaActif) return
    setErreur(null)
    const dateDebut = dates[0]
    const dateFin = dates[dates.length - 1]
    const intervalles = calculerIntervalles(dates, diffusions)
    const runId = crypto.randomUUID()
    const resultat = genererElementsSecondaires({
      dates,
      intervalles,
      campagnes,
      programmesParId,
      diffusionsToutes: diffusions,
      elementsExistants: elementsSecondairesActifs,
      opts,
      runId,
      chaineActive,
      planMediaId: planMediaActif.id,
    })
    const nbAutomatiquesRemplaces = elementsSecondairesActifs.filter(
      (e) => e.origine === 'AUTOMATIQUE' && e.date >= dateDebut && e.date <= dateFin
    ).length
    setRapportEcrit(null)
    setProposition({ ...resultat, runId, nbAutomatiquesRemplaces })
  }

  // RG-M5-06 : inconditionnel, pas de case « Écraser » — chaque confirmation
  // recalcule systématiquement les éléments AUTOMATIQUE de la période, ne
  // touche jamais les MANUELLE. P24 : passe désormais par enregistrerAction
  // (delete + insert groupés en une seule entrée) — exactement le pattern
  // déjà utilisé par AutoProgrammation.jsx pour M4 (P23).
  async function confirmerGeneration(retenues) {
    if (!planMediaActif) return
    setEnregistrement(true)
    setErreur(null)
    try {
      const dateDebut = dates[0]
      const dateFin = dates[dates.length - 1]
      const supprimes = await supprimerElementsSecondairesAutomatiquesParPeriode(chaineActive.id, dateDebut, dateFin, planMediaActif.id)
      const creees = retenues.length > 0 ? await creerElementsSecondaires(retenues) : []
      const entree = await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'PLAN_MEDIA',
        documentId: planMediaActif.id,
        libelle: `Génération plan média (${creees.length} élément${creees.length > 1 ? 's' : ''})`,
        operations: [
          ...supprimes.map((e) => ({ table: 'element_secondaire', type: 'DELETE', id: e.id, avant: e })),
          ...creees.map((e) => ({ table: 'element_secondaire', type: 'INSERT', id: e.id, apres: e })),
        ],
      })
      const idsSupprimes = new Set(supprimes.map((e) => e.id))
      setElementsSecondaires((prev) => [...prev.filter((e) => !idsSupprimes.has(e.id)), ...creees])
      setRapportEcrit({ causesNonCouvertes: proposition.rapport.causesNonCouvertes, runId: proposition.runId })
      setDerniereActionId(entree.id)
      setProposition(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // Raccourci vers la pile générique PLAN_MEDIA — revérifie que cette
  // génération représente toujours le sommet de la pile avant de déléguer
  // (même pattern que AutoProgrammation.jsx pour M4, P23).
  async function annulerGeneration() {
    if (!rapportEcrit || !derniereActionId || !planMediaActif) return
    setAnnulation(true)
    setErreur(null)
    try {
      const { entreeActiveId } = await etatPile(chaineActive.id, 'PLAN_MEDIA', planMediaActif.id)
      if (entreeActiveId !== derniereActionId) {
        setErreur("Cette génération n'est plus la dernière action sur ce plan média — utilisez Annuler dans la barre d'outils.")
        return
      }
      const resultat = await annulerDerniereAction(chaineActive.id, 'PLAN_MEDIA', planMediaActif.id)
      if (!resultat.ok) {
        setErreur(resultat.motif)
        return
      }
      setElementsSecondaires((prev) => fusionnerChangements(prev, resultat.changements))
      setRapportEcrit(null)
      setDerniereActionId(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setAnnulation(false)
    }
  }

  function ajouterElementLocal(nouveau) {
    setElementsSecondaires((prev) => [...prev, nouveau])
  }

  // Raccourci "+" de la bibliothèque (P26bis) : ferme la bibliothèque, ouvre
  // l'insertion manuelle avec ce spot présélectionné — même formulaire, même
  // validation, même écriture que l'insertion manuelle normale (aucun chemin
  // parallèle).
  function ouvrirInsertionDepuisBibliotheque(spot) {
    setBibliothequeOuverte(false)
    setSpotPreselectionne(spot.id)
    setInsertionOuverte(true)
  }

  function fermerInsertion() {
    setInsertionOuverte(false)
    setSpotPreselectionne(null)
  }

  // Import Plan média (P26) : le document créé n'est jamais live par défaut
  // — ouvert comme un nouvel onglet, l'utilisateur choisit ensuite
  // explicitement « Définir comme live » s'il le souhaite (même geste que
  // pour tout autre document, aucun raccourci silencieux ici).
  function documentImporte(nouveauDocument, elementsCrees) {
    setPlanMedias((prev) => [...prev, nouveauDocument])
    setElementsSecondaires((prev) => [...prev, ...elementsCrees])
    ouvrirDocument(nouveauDocument.id)
    setImportOuvert(false)
  }

  function appliquerChangementsPile(changements) {
    setElementsSecondaires((prev) => fusionnerChangements(prev, changements))
  }

  async function gererAnnuler() {
    if (!planMediaActif) return
    const resultat = await annulerDerniereAction(chaineActive.id, 'PLAN_MEDIA', planMediaActif.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    if (!planMediaActif) return
    const resultat = await retablirAction(chaineActive.id, 'PLAN_MEDIA', planMediaActif.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  // --- Gestion des plans média (P24) ---

  function selectionnerDocument(id) {
    setPlanMediaActifId(id)
    setSelectionActive(false)
    setElementsSelectionnesIds(new Set())
  }

  function ouvrirDocument(id) {
    setPlanMediaOuvertsIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    selectionnerDocument(id)
  }

  function fermerOnglet(id) {
    setPlanMediaOuvertsIds((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((x) => x !== id)
      if (planMediaActifId === id) selectionnerDocument(next[0])
      return next
    })
  }

  async function creerEtOuvrirDocument(nom) {
    const nouveau = await creerPlanMedia({ chaine_id: chaineActive.id, nom, est_live: false, cree_par: lireUtilisateur() })
    setPlanMedias((prev) => [...prev, nouveau])
    ouvrirDocument(nouveau.id)
    setModaleDocument(null)
  }

  async function renommerDocumentActif(nom) {
    const maj = await mettreAJourPlanMedia(planMediaActif.id, { nom })
    setPlanMedias((prev) => prev.map((p) => (p.id === maj.id ? maj : p)))
    setModaleDocument(null)
  }

  async function dupliquerDocumentActif(nom) {
    const nouveau = await dupliquerPlanMedia(planMediaActif, nom, lireUtilisateur())
    const lignes = await listerElementsSecondairesParChaine(chaineActive.id)
    setPlanMedias((prev) => [...prev, nouveau])
    setElementsSecondaires(lignes)
    ouvrirDocument(nouveau.id)
    setModaleDocument(null)
  }

  async function definirLive() {
    if (!planMediaActif || planMediaActif.est_live) return
    const liveActuel = planMedias.find((p) => p.est_live)
    const confirme = await confirmer({
      titre: 'Définir comme live',
      message: `Définir « ${planMediaActif.nom} » comme plan média live de ${chaineActive.nom} ? Il remplacera « ${liveActuel?.nom ?? '—'} » pour le Conducteur et la couverture du dashboard.`,
      labelConfirmer: 'Définir comme live',
    })
    if (!confirme) return
    await definirPlanMediaLive(chaineActive.id, planMediaActif.id)
    setPlanMedias(await listerPlanMediaParChaine(chaineActive.id))
  }

  async function supprimerDocumentActif() {
    if (!planMediaActif || planMediaActif.est_live) return
    const nb = elementsSecondaires.filter((e) => e.plan_media_id === planMediaActif.id).length
    const confirme = await confirmer({
      titre: 'Supprimer le plan média',
      message: `Supprimer définitivement « ${planMediaActif.nom} »${nb > 0 ? ` et ses ${nb} élément(s)` : ''} ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!confirme) return
    const idSupprime = planMediaActif.id
    await supprimerPlanMedia(idSupprime)
    setPlanMedias((prev) => prev.filter((p) => p.id !== idSupprime))
    setElementsSecondaires((prev) => prev.filter((e) => e.plan_media_id !== idSupprime))
    setPlanMediaOuvertsIds((prev) => {
      const next = prev.filter((x) => x !== idSupprime)
      const restante = next.length > 0 ? next : [planMedias.find((p) => p.est_live)?.id].filter(Boolean)
      setPlanMediaActifId(restante[0] ?? null)
      return restante
    })
  }

  // --- Sélection multiple + copier/coller (P24) ---

  function activerSelection() {
    setSelectionActive(true)
    setElementsSelectionnesIds(new Set())
  }

  function annulerSelection() {
    setSelectionActive(false)
    setElementsSelectionnesIds(new Set())
  }

  // Tout sélectionner / tout désélectionner les éléments de la période affichée.
  function basculerToutSelectionner() {
    setElementsSelectionnesIds((prev) =>
      prev.size === elementsPeriode.length ? new Set() : new Set(elementsPeriode.map((e) => e.id))
    )
  }

  function toggleSelectionElement(id) {
    setElementsSelectionnesIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copierSelection() {
    const snapshots = elementsSecondairesActifs
      .filter((e) => elementsSelectionnesIds.has(e.id))
      .map((e) => Object.fromEntries(CHAMPS_COPIABLES_ELEMENT.map((c) => [c, e[c]])))
    setPresseGaPapier(snapshots)
    annulerSelection()
  }

  // Colle dans le document actuellement ouvert, à la MÊME coupure/horaire que
  // la copie (cf. commentaire CHAMPS_COPIABLES_ELEMENT). Valide via
  // estPlacementValide (même fonction que l'insertion manuelle) contre les
  // éléments déjà présents dans cette coupure du document cible —
  // silencieusement écarté si conflit, décompte des refus affiché.
  async function coller() {
    if (!planMediaActif || presseGaPapier.length === 0) return
    const intervalles = calculerIntervalles(dates, diffusions)
    const creees = []
    for (const item of presseGaPapier) {
      // P31 : un élément « hors coupure » (apres_transmission_id null) se colle
      // dans la journée d'antenne de sa date, sans dépendre de la grille live.
      const intervalle =
        item.apres_transmission_id == null
          ? { date: item.date, debut: 6 * 60, fin: 30 * 60, apresTransmissionId: null }
          : intervalles.find((iv) => iv.apresTransmissionId === item.apres_transmission_id)
      if (!intervalle) continue
      const elementsCoupureCible = elementsSecondairesActifs.filter((e) =>
        item.apres_transmission_id == null
          ? e.apres_transmission_id == null && e.date === item.date
          : e.apres_transmission_id === item.apres_transmission_id
      )
      const heureDebutSecondes = heureHMSEnSecondes(item.heure_debut)
      if (!estPlacementValide(heureDebutSecondes, item.duree_secondes, intervalle, elementsCoupureCible)) continue
      const cree = await creerElementSecondaire({ ...item, chaine_id: chaineActive.id, plan_media_id: planMediaActif.id })
      creees.push(cree)
    }
    if (creees.length === 0) {
      setErreur("Aucun élément collé — conflit d'horaire dans la coupure cible.")
      return
    }
    await enregistrerAction({
      chaineId: chaineActive.id,
      ecran: 'PLAN_MEDIA',
      documentId: planMediaActif.id,
      libelle: `Collage (${creees.length} élément${creees.length > 1 ? 's' : ''})`,
      operations: creees.map((e) => ({ table: 'element_secondaire', type: 'INSERT', id: e.id, apres: e })),
    })
    setElementsSecondaires((prev) => [...prev, ...creees])
    const refuses = presseGaPapier.length - creees.length
    setPresseGaPapier([])
    if (refuses > 0) setErreur(`${refuses} élément(s) refusé(s) (conflit d'horaire) sur ${creees.length + refuses}.`)
  }

  // Export Plan média (P16b) — remplace le fichier PM réel : feuille "PM",
  // titre "Plan Média Autopromotion", H.FIN/DUREE en cellules numériques
  // (fraction de journée, format hh:mm:ss) pour un rendu identique au
  // fichier d'origine à l'ouverture dans Excel/LibreOffice.
  function exporterPlanMedia() {
    try {
      const { lignes, cellulesHeure } = construireLignesPlanMedia(dates, diffusions, elementsSecondairesActifs, programmesParId, campagnesParId)
      const feuilleAOA = [[TITRE_FEUILLE_PLAN_MEDIA], ENTETE_PLAN_MEDIA, ...lignes]
      const feuille = XLSX.utils.aoa_to_sheet(feuilleAOA)
      feuille['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
      for (const [indexLigne, colonne] of cellulesHeure) {
        const adresse = XLSX.utils.encode_cell({ r: indexLigne + 2, c: colonne })
        if (feuille[adresse]) {
          feuille[adresse].t = 'n'
          feuille[adresse].z = 'hh:mm:ss'
        }
      }
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'PM')
      XLSX.writeFile(classeur, construireNomFichierPlanMedia(vue, dates))
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  // Word/PDF (P31 — passe design, unification du bouton Export) : mêmes
  // données que l'Excel métier ci-dessus (même regroupement/tri/libellés,
  // construireLignesTextePlanMedia ne fait que reformater H.FIN/DUREE en
  // texte plutôt qu'en fraction de journée) — présentées en tableau simple,
  // pas de mise en forme du fichier réel à reproduire pour ces 2 formats.
  function exporterPlanMediaPdf() {
    try {
      const lignes = construireLignesTextePlanMedia(dates, diffusions, elementsSecondairesActifs, programmesParId, campagnesParId)
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(TITRE_FEUILLE_PLAN_MEDIA, 14, 16)
      autoTable(doc, { startY: 24, head: [ENTETE_PLAN_MEDIA], body: lignes })
      doc.save(construireNomFichierPlanMedia(vue, dates, 'pdf'))
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    }
  }

  async function exporterPlanMediaWord() {
    try {
      const lignes = construireLignesTextePlanMedia(dates, diffusions, elementsSecondairesActifs, programmesParId, campagnesParId)
      const ligneEntete = (libelles) =>
        new TableRow({ children: libelles.map((l) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: l, bold: true })] })] })) })
      const ligne = (valeurs) => new TableRow({ children: valeurs.map((v) => new TableCell({ children: [new Paragraph(String(v))] })) })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: TITRE_FEUILLE_PLAN_MEDIA, heading: HeadingLevel.HEADING_1 }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [ligneEntete(ENTETE_PLAN_MEDIA), ...lignes.map(ligne)],
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = construireNomFichierPlanMedia(vue, dates, 'docx')
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {/* Barre d'onglets (P24) : plans média ouverts de la chaîne active. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          {planMediasOuverts.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                p.id === planMediaActifId
                  ? 'border-snrt-navy bg-snrt-navy/5 font-medium text-snrt-navy'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <button type="button" onClick={() => selectionnerDocument(p.id)} className="flex items-center gap-1.5">
                {p.nom}
                {p.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => fermerOnglet(p.id)}
                disabled={planMediasOuverts.length <= 1}
                title={planMediasOuverts.length <= 1 ? 'Dernier onglet ouvert' : 'Fermer (le document reste enregistré)'}
                className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setModaleDocument('OUVRIR')}
            title="Ouvrir un plan média"
            className="rounded-md border border-dashed border-slate-300 p-1.5 text-slate-500 hover:border-snrt-navy hover:text-snrt-navy"
          >
            <Plus size={15} />
          </button>

          {planMediaActif && (
            <div className="ml-auto flex items-center gap-1.5">
              <BoutonExporter
                onExcel={exporterPlanMedia}
                onWord={exporterPlanMediaWord}
                onPdf={exporterPlanMediaPdf}
                sousTitre={planMediaActif.nom}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-snrt-accent hover:bg-snrt-accent/5 hover:text-snrt-accent"
              />
              {!planMediaActif.est_live && (
                <button
                  type="button"
                  onClick={definirLive}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Définir comme live
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenuDocumentOuvert(true)}
                title="Autres actions (renommer, dupliquer, supprimer)"
                className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Onglets Composition / Génération auto (P26bis) — pure réorganisation
            d'affichage, partagent le même document/dates/undo ci-dessous. */}
        <div className="mb-4 flex rounded-md border border-slate-300 text-sm">
          <button
            type="button"
            onClick={() => setOngletPanneau('COMPOSITION')}
            className={`flex-1 px-3 py-2 font-medium ${ongletPanneau === 'COMPOSITION' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Composition
          </button>
          <button
            type="button"
            onClick={() => setOngletPanneau('GENERATION')}
            className={`flex-1 px-3 py-2 font-medium ${ongletPanneau === 'GENERATION' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Génération auto
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex rounded-md border border-slate-300 text-sm">
              <button
                type="button"
                onClick={() => setVue('SEMAINE')}
                className={`px-3 py-2 ${vue === 'SEMAINE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setVue('JOUR')}
                className={`px-3 py-2 ${vue === 'JOUR' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Jour
              </button>
            </div>
            {ongletPanneau === 'COMPOSITION' && !selectionActive && (
              <button
                type="button"
                onClick={activerSelection}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <CheckSquare size={15} />
                Sélectionner
              </button>
            )}
            {ongletPanneau === 'COMPOSITION' && selectionActive && (
              <div className="flex items-center gap-2 rounded-md border border-snrt-navy bg-snrt-navy/5 px-3 py-1.5 text-sm text-snrt-navy">
                <span>{elementsSelectionnesIds.size} sélectionné(s)</span>
                <button
                  type="button"
                  onClick={basculerToutSelectionner}
                  disabled={elementsPeriode.length === 0}
                  className="font-medium underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {elementsSelectionnesIds.size === elementsPeriode.length && elementsPeriode.length > 0
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
                <button
                  type="button"
                  onClick={copierSelection}
                  disabled={elementsSelectionnesIds.size === 0}
                  className="font-medium underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copier
                </button>
                <button type="button" onClick={annulerSelection} className="text-slate-500 hover:text-slate-700">
                  Annuler
                </button>
              </div>
            )}
            {ongletPanneau === 'COMPOSITION' && presseGaPapier.length > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
                <span>{presseGaPapier.length} copié(s)</span>
                <button type="button" onClick={coller} className="flex items-center gap-1 font-medium underline hover:no-underline">
                  <ClipboardPaste size={13} />
                  Coller
                </button>
                <button type="button" onClick={() => setPresseGaPapier([])} className="text-amber-700/70 hover:text-amber-900">
                  Vider
                </button>
              </div>
            )}
            {ongletPanneau === 'COMPOSITION' && (
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
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => naviguer(-1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[12rem] text-center text-sm font-medium text-slate-700">
              {vue === 'SEMAINE' ? formaterPlageSemaine(lundi) : formaterDateLongue(dateReference)}
            </span>
            <button type="button" onClick={() => naviguer(1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDateReference(aujourdHuiISO())}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {ongletPanneau === 'COMPOSITION' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInsertionOuverte(true)}
                className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
              >
                <PlusSquare size={15} />
                Insertion manuelle
              </button>
              <div className="flex rounded-md border border-slate-300">
                <button
                  type="button"
                  onClick={() => setBibliothequeOuverte(true)}
                  className="flex items-center gap-1.5 rounded-l-md border-r border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Library size={15} />
                  Bibliothèque de spots
                </button>
                <button
                  type="button"
                  onClick={() => setImportOuvert(true)}
                  className="flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Upload size={15} />
                  Importer
                </button>
              </div>
            </div>
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      {ongletPanneau === 'COMPOSITION' && (
        <div className="space-y-6">
          {!chargement && planMediaActif && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Éléments placés — {planMediaActif.nom}</h3>
              {elementsPeriode.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun élément sur cette période dans ce document.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        {selectionActive && <th className="w-8 py-1.5" />}
                        <th className="py-1.5 pr-3">Date</th>
                        <th className="py-1.5 pr-3">Heure</th>
                        <th className="py-1.5 pr-3">Type</th>
                        <th className="py-1.5 pr-3">Libellé</th>
                        <th className="py-1.5">Campagne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elementsPeriode.map((e) => {
                        const campagne = e.campagne_id ? campagnesParId.get(e.campagne_id) : null
                        const titrePromu = campagne ? programmesParId.get(campagne.programme_id)?.titre : null
                        return (
                          <tr key={e.id} className="border-b border-slate-100 text-slate-700 last:border-0">
                            {selectionActive && (
                              <td className="py-1.5">
                                <input
                                  type="checkbox"
                                  checked={elementsSelectionnesIds.has(e.id)}
                                  onChange={() => toggleSelectionElement(e.id)}
                                />
                              </td>
                            )}
                            <td className="py-1.5 pr-3">{formaterJourCourt(e.date)}</td>
                            <td className="py-1.5 pr-3 font-mono text-xs">
                              {e.heure_debut?.slice(0, 5)}–{e.heure_fin?.slice(0, 5)}
                            </td>
                            <td className="py-1.5 pr-3">{LIBELLES_TYPE[e.type] ?? e.type}</td>
                            <td className="py-1.5 pr-3">{e.libelle ?? '—'}</td>
                            <td className="py-1.5">{titrePromu ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {ongletPanneau === 'GENERATION' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_1fr]">
          <div className="space-y-6">
            <TableauCampagnes
              chaineActive={chaineActive}
              campagnes={campagnes}
              programmes={programmes}
              couverture={couverture}
              onRafraichir={chargerTout}
            />

            {proposition && (
              <PanneauApercuPlanMedia
                proposition={proposition}
                nbAutomatiquesRemplaces={proposition.nbAutomatiquesRemplaces}
                onConfirmer={confirmerGeneration}
                onAnnuler={() => setProposition(null)}
                enregistrement={enregistrement}
              />
            )}

            {rapportEcrit && (
              <PanneauCouvertureCampagnes
                campagnes={campagnes}
                programmesParId={programmesParId}
                couverture={couverture}
                causesNonCouvertes={rapportEcrit.causesNonCouvertes}
                onAnnulerGeneration={annulerGeneration}
                annulation={annulation}
              />
            )}
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <PanneauReglesHabillage
              periodeLabel={vue === 'SEMAINE' ? formaterPlageSemaine(lundi) : formaterDateLongue(dateReference)}
              opts={opts}
              onChangerOpts={setOpts}
              onGenerer={generer}
              chargement={chargement}
            />
          </div>
        </div>
      )}

      {bibliothequeOuverte && (
        <BibliothequeSpots
          spots={spots}
          onFermer={() => setBibliothequeOuverte(false)}
          onRafraichir={chargerTout}
          onAjouterAuPlan={ouvrirInsertionDepuisBibliotheque}
        />
      )}

      {insertionOuverte && planMediaActif && (
        <PanneauInsertionManuelle
          chaineActive={chaineActive}
          planMediaId={planMediaActif.id}
          dates={dates}
          diffusions={diffusions}
          elementsSecondaires={elementsSecondairesActifs}
          campagnes={campagnes}
          spots={spots}
          programmesParId={programmesParId}
          spotIdInitial={spotPreselectionne}
          onFermer={fermerInsertion}
          onElementCree={ajouterElementLocal}
        />
      )}

      {importOuvert && (
        <PanneauImportPlanMedia
          chaineActive={chaineActive}
          diffusions={diffusions}
          campagnes={campagnes}
          programmesParId={programmesParId}
          onFermer={() => setImportOuvert(false)}
          onImporte={documentImporte}
        />
      )}

      {menuDocumentOuvert && planMediaActif && (
        <Modal titre={`Plan média « ${planMediaActif.nom} »`} onFermer={() => setMenuDocumentOuvert(false)}>
          <div className="space-y-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setMenuDocumentOuvert(false)
                setModaleDocument('RENOMMER')
              }}
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={16} />
              Renommer
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuDocumentOuvert(false)
                setModaleDocument('DUPLIQUER')
              }}
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Copy size={16} />
              Dupliquer
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuDocumentOuvert(false)
                supprimerDocumentActif()
              }}
              disabled={planMediaActif.est_live}
              title={planMediaActif.est_live ? 'Basculez un autre document en live avant de supprimer celui-ci' : 'Supprimer'}
              className="flex w-full items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={16} />
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {modaleDocument === 'OUVRIR' && (
        <ModaleOuvrirDocument
          documents={planMedias}
          documentsOuvertsIds={planMediaOuvertsIds}
          onOuvrir={ouvrirDocument}
          onCreer={creerEtOuvrirDocument}
          onFermer={() => setModaleDocument(null)}
        />
      )}
      {modaleDocument === 'RENOMMER' && planMediaActif && (
        <ModaleNomDocument
          titre="Renommer le plan média"
          valeurInitiale={planMediaActif.nom}
          labelBouton="Renommer"
          onValider={renommerDocumentActif}
          onFermer={() => setModaleDocument(null)}
        />
      )}
      {modaleDocument === 'DUPLIQUER' && planMediaActif && (
        <ModaleNomDocument
          titre="Dupliquer le plan média"
          valeurInitiale={`${planMediaActif.nom} (copie)`}
          labelBouton="Dupliquer"
          onValider={dupliquerDocumentActif}
          onFermer={() => setModaleDocument(null)}
        />
      )}
    </div>
  )
}

// Panneau "Ouvrir un plan média" (P24, miroir GrilleLineaire.jsx/P23) : liste
// des documents de la chaîne pas encore ouverts + création d'un nouveau,
// dans la même modale.
function ModaleOuvrirDocument({ documents, documentsOuvertsIds, onOuvrir, onCreer, onFermer }) {
  const [nomNouveau, setNomNouveau] = useState('')
  const [creation, setCreation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()
  const fermes = documents.filter((d) => !documentsOuvertsIds.includes(d.id))

  async function creer(e) {
    e.preventDefault()
    if (!nomNouveau.trim()) return
    setCreation(true)
    setErreur(null)
    try {
      await onCreer(nomNouveau.trim())
    } catch (err) {
      setErreur(err.message)
    } finally {
      setCreation(false)
    }
  }

  return (
    <Modal titre="Ouvrir un plan média" onFermer={onFermer}>
      <div className="space-y-4">
        {fermes.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
            {fermes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOuvrir(d.id)}
                className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
              >
                {d.nom}
                {d.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Tous les plans média de cette chaîne sont déjà ouverts.</p>
        )}
        <form onSubmit={creer} className="flex items-end gap-2 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
              Nouveau plan média
            </label>
            <input
              id={idNom}
              type="text"
              value={nomNouveau}
              onChange={(e) => setNomNouveau(e.target.value)}
              placeholder="ex. Plan média Ramadan"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creation || !nomNouveau.trim()}
            className="rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            Créer
          </button>
        </form>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      </div>
    </Modal>
  )
}

// Modale nom unique (P24, miroir GrilleLineaire.jsx/P23) : réutilisée par
// Renommer et Dupliquer.
function ModaleNomDocument({ titre, valeurInitiale, labelBouton, onValider, onFermer }) {
  const [nom, setNom] = useState(valeurInitiale)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()

  async function soumettre(e) {
    e.preventDefault()
    if (!nom.trim()) return
    setEnCours(true)
    setErreur(null)
    try {
      await onValider(nom.trim())
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
