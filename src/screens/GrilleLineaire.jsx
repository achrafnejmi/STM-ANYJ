import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Layers3,
  Undo2,
  Redo2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Pencil,
  Copy,
  Trash2,
  CheckSquare,
  ClipboardPaste,
  Download,
  Save,
  FileSpreadsheet,
  FileText,
  File,
} from 'lucide-react'
import {
  listerDiffusionsLineairesParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  obtenirGrilleTypeLiveParChaine,
  listerBlocsGrilleTypeParGrilleType,
  listerToutesLesFenetresDroits,
  listerEpisodes,
  creerDiffusionLineaire,
  listerGrillesParChaine,
  creerGrille,
  mettreAJourGrille,
  supprimerGrille,
  definirGrilleLive,
} from '../lib/db.js'
import { lireGrillesOuvertes, definirGrillesOuvertes, dupliquerGrille } from '../lib/grilles.js'
import { lireUtilisateur } from '../lib/session.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import { deprogrammerDiffusion } from '../lib/deprogrammation.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { couleurType } from '../lib/couleursType.js'
import { calculerAnomalies, compterBloquantes } from '../lib/anomalies.js'
import { blocsActifsCeJour } from '../lib/grilleType.js'
import { estProgrammable, estEpisodePret } from '../lib/droits.js'
import { construireDonneesListeTransmissions, construireLignesExcelListeTransmissions, construireNomFichierListeTransmissions, ENTETE_LISTE_TRANSMISSIONS } from '../lib/exportListeTransmissions.js'
import {
  PRESETS_ZOOM,
  INDEX_ZOOM_DEFAUT,
  calculerHauteurTotale,
  genererMarquesHeures,
  genererGraduationsMineures,
  positionVersMinute,
  disposerEnPistes,
} from '../lib/grilleAxe.js'
import {
  aujourdHuiISO,
  ajouterJours,
  lundiDeLaSemaine,
  joursDeLaSemaine,
  joursDuMoisAffiches,
  joursDeLAnnee,
  estMemeMois,
  ajouterMois,
  ajouterAnnees,
  moisDeLAnnee,
  jourAntenneLundi0,
  formaterJourCourt,
  formaterPlageSemaine,
  formaterDateLongue,
  formaterMoisAnnee,
  formaterAnnee,
  heureEnMinutes,
  minutesEnHeure,
  DEBUT_JOURNEE_ANTENNE,
  minutesDepuisDebutAntenne,
} from '../lib/semaine.js'
import Modal from '../components/Modal.jsx'
import CataloguePanel from '../components/CataloguePanel.jsx'
import PopoverHistorique from '../components/PopoverHistorique.jsx'
import InspecteurBloc from '../components/InspecteurBloc.jsx'
import PanneauAnomalies from '../components/PanneauAnomalies.jsx'
import { useNotification } from '../components/NotificationProvider.jsx'

const DUREE_PAR_DEFAUT_MIN = 30
const MARQUES_HEURES = genererMarquesHeures()
// Champs copiés au presse-papier interne (P23) — jamais l'id (une nouvelle
// ligne est toujours créée au collage) ni chaine/chaine_id/grille_id
// (recalculés à partir de la grille cible au moment de coller).
const CHAMPS_COPIABLES = ['programme_id', 'episode_id', 'episode_numero', 'date', 'heure_debut', 'heure_fin', 'genre', 'titre_cache', 'vecteur']

export default function GrilleLineaire({ chaineActive, onAnomaliesBloquantes }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [diffusions, setDiffusions] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [blocsGrilleType, setBlocsGrilleType] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [grilles, setGrilles] = useState([])
  const [grillesOuvertesIds, setGrillesOuvertesIds] = useState([])
  const [grilleActiveId, setGrilleActiveId] = useState(null)
  const [modaleGrille, setModaleGrille] = useState(null) // 'OUVRIR' | 'RENOMMER' | 'DUPLIQUER'
  const [selectionActive, setSelectionActive] = useState(false)
  const [blocsSelectionnesIds, setBlocsSelectionnesIds] = useState(() => new Set())
  const [presseGaPapier, setPresseGaPapier] = useState([])
  const [indexZoom, setIndexZoom] = useState(INDEX_ZOOM_DEFAUT)
  const [afficherGrilleType, setAfficherGrilleType] = useState(true)
  const [pleinEcran, setPleinEcran] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [modale, setModale] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [blocModifie, setBlocModifie] = useState(false)
  const [anomaliesOuvertes, setAnomaliesOuvertes] = useState(false)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(null)
  const [listeTransmissionsOuverte, setListeTransmissionsOuverte] = useState(false)
  // P27b : 2 positions seulement ('TNT' | 'SATELLITE', pas de vue "Unifié") —
  // défaut Satellite, la vue où se fait l'édition au quotidien.
  const [vueVecteur, setVueVecteur] = useState('SATELLITE')
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const dragRef = useRef(null)
  const chargementIdRef = useRef(0)
  const { confirmer, succes } = useNotification()

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : passe par ici
  // pour changer/fermer le bloc inspecté — bloc_Modifie est reporté par
  // InspecteurBloc (onglet Bloc). Les mises à jour "système" après une
  // écriture réussie (appliquerEdition/appliquerSuppression/pile) restent en
  // setBlocSelectionne direct, plus bas — rien à confirmer, ce n'est pas
  // l'utilisateur qui abandonne une saisie.
  async function changerBlocSelectionne(nouveau) {
    if (blocSelectionne && blocModifie && !(await confirmer({
      titre: 'Modifications non enregistrées',
      message: 'Modifications non enregistrées. Quitter sans enregistrer ?',
      labelConfirmer: 'Quitter sans enregistrer',
      labelAnnuler: 'Rester',
    }))) {
      return false
    }
    setBlocSelectionne(nouveau)
    setBlocModifie(false)
    return true
  }

  // P23 : charge aussi les grilles de la chaîne — une seule requête
  // supplémentaire dans le même Promise.all. Onglets ouverts = session
  // (lireGrillesOuvertes), repli sur [grille live] si rien en session ou si
  // des ids sauvegardés ne correspondent plus à une grille existante.
  //
  // `chargementIdRef` ignore la réponse d'un chargement dépassé par un plus
  // récent (StrictMode double-invoque cet effet en dev, ou un changement
  // rapide de chaîne) — même pattern que `requeteEpisodesId`
  // (FormulaireCreneau) et `idAppel` (ListeProgrammes.jsx). Sans ça, une
  // réponse arrivée en retard écrase silencieusement la grille/onglet que
  // l'utilisateur vient de sélectionner entre-temps.
  useEffect(() => {
    const idAppel = ++chargementIdRef.current
    setChargement(true)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerDiffusionsLineairesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      obtenirGrilleTypeLiveParChaine(chaineActive.id),
      listerToutesLesFenetresDroits(),
      listerGrillesParChaine(chaineActive.id),
    ])
      // P28 : les bandes de fond/anomalies ne suivent que la grille type LIVE
      // (jamais "tous les blocs de la chaîne") — dépend du résultat ci-dessus,
      // d'où ce second Promise.all imbriqué plutôt qu'un 7e élément du premier.
      .then(([lignesProgrammes, lignesDiffusions, lignesEpisodes, grilleTypeLive, lignesFenetres, lignesGrilles]) =>
        (grilleTypeLive ? listerBlocsGrilleTypeParGrilleType(grilleTypeLive.id) : Promise.resolve([])).then((lignesBlocs) => {
          if (idAppel !== chargementIdRef.current) return
          setProgrammes(lignesProgrammes)
          setDiffusions(lignesDiffusions)
          setEpisodes(lignesEpisodes)
          setBlocsGrilleType(lignesBlocs)
          setFenetresDroits(lignesFenetres)
          setGrilles(lignesGrilles)
          const live = lignesGrilles.find((g) => g.est_live)
          const sauvegardees = lireGrillesOuvertes(chaineActive.code).filter((id) => lignesGrilles.some((g) => g.id === id))
          const ouvertes = sauvegardees.length > 0 ? sauvegardees : [live?.id].filter(Boolean)
          setGrillesOuvertesIds(ouvertes)
          setGrilleActiveId(ouvertes[0] ?? null)
          setSelectionActive(false)
          setBlocsSelectionnesIds(new Set())
          setPresseGaPapier([])
        })
      )
      .catch((err) => {
        if (idAppel === chargementIdRef.current) setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === chargementIdRef.current) setChargement(false)
      })
  }, [chaineActive])

  // Persiste la liste des onglets ouverts en session (par chaîne) à chaque
  // changement — fermer un onglet ne supprime aucune donnée, juste retiré
  // d'ici ; rouvrir recharge le même contenu depuis diffusions/grilles déjà
  // en mémoire.
  useEffect(() => {
    if (grillesOuvertesIds.length > 0) definirGrillesOuvertes(chaineActive.code, grillesOuvertesIds)
  }, [chaineActive.code, grillesOuvertesIds])

  const grilleActive = useMemo(() => grilles.find((g) => g.id === grilleActiveId) ?? null, [grilles, grilleActiveId])
  const grilleLive = useMemo(() => grilles.find((g) => g.est_live) ?? null, [grilles])
  const grillesOuvertes = useMemo(
    () => grillesOuvertesIds.map((id) => grilles.find((g) => g.id === id)).filter(Boolean),
    [grillesOuvertesIds, grilles]
  )

  // Rafraîchi après chaque écriture (diffusions change systématiquement
  // après une création/édition/suppression, y compris via undoManager) — pas
  // de canal séparé à faire remonter depuis chaque site d'écriture. P23 :
  // pile scopée par grille ouverte, pas seulement par chaîne.
  useEffect(() => {
    if (!grilleActive) return
    etatPile(chaineActive.id, 'GRILLE_LINEAIRE', grilleActive.id).then(setPile)
  }, [chaineActive, grilleActive, diffusions])

  // Ctrl+Z/Ctrl+Y locaux à cet écran (pas globaux comme Ctrl+K de la
  // recherche) — jamais interceptés si le focus est dans un champ texte, pour
  // ne pas voler le undo natif du navigateur.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive/grilleActive par closure, seules dépendances réelles
  }, [chaineActive, grilleActive])

  const presetZoom = PRESETS_ZOOM[indexZoom]
  const graduationsMineures = useMemo(() => genererGraduationsMineures(presetZoom.pasGraduationMin), [presetZoom])
  // Mois/Année = aperçu en lecture seule (drill-down uniquement) — le rendu
  // continu à la minute, le zoom et la sélection/copier-coller n'existent
  // qu'en Jour/Semaine.
  const vueEditable = vue === 'JOUR' || vue === 'SEMAINE'
  const lundi = lundiDeLaSemaine(dateReference)
  // P25 : 4 vues, même pipeline diffusionsParJour/anomalies pour toutes —
  // seul le rendu diffère (grille continue en Jour/Semaine, aperçu résumé en
  // Mois/Année).
  const jours = useMemo(() => {
    if (vue === 'JOUR') return [dateReference]
    if (vue === 'SEMAINE') return joursDeLaSemaine(lundi)
    if (vue === 'MOIS') return joursDuMoisAffiches(dateReference)
    return joursDeLAnnee(dateReference) // ANNEE
  }, [vue, lundi, dateReference])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const programmesDeLaChaine = useMemo(
    () => [...programmes].sort((a, b) => a.titre.localeCompare(b.titre)),
    [programmes]
  )

  // Filtrées sur la grille actuellement OUVERTE (l'onglet affiché) — chaque
  // grille de la chaîne a ses propres blocs, jamais mélangés à l'écran mais
  // tous chargés en mémoire pour permettre plusieurs onglets sans aller-
  // retour réseau à chaque bascule. NON filtrée par vueVecteur (P27) — reste
  // la source complète transmise à l'Inspecteur, qui doit pouvoir retrouver
  // une ligne sœur même masquée par la vue courante (Retirer d'un vecteur).
  const diffusionsGrilleActive = useMemo(
    () => (grilleActive ? diffusions.filter((d) => d.grille_id === grilleActive.id) : []),
    [diffusions, grilleActive]
  )

  // Bascule d'affichage Unifié/TNT/Satellite (P27, RG-13) : un pur filtre de
  // rendu — le drag-drop et la création restent inchangés quelle que soit la
  // vue. Unifié et TNT partagent le même prédicat (RG-13 : la vue Unifié
  // n'affiche que les versions communes et TNT, une exception satellite
  // existe mais n'y est pas dupliquée) — même logique que Conducteur.jsx.
  const diffusionsGrilleActiveVue = useMemo(() => {
    if (vueVecteur === 'SATELLITE') return diffusionsGrilleActive.filter((d) => d.vecteur == null || d.vecteur === 'SATELLITE')
    return diffusionsGrilleActive.filter((d) => d.vecteur == null || d.vecteur === 'TNT')
  }, [diffusionsGrilleActive, vueVecteur])

  const diffusionsParJour = useMemo(() => {
    const map = new Map()
    for (const j of jours) map.set(j, [])
    for (const d of diffusionsGrilleActiveVue) {
      if (map.has(d.date)) map.get(d.date).push(d)
    }
    return map
  }, [diffusionsGrilleActiveVue, jours])

  const episodesParId = useMemo(() => new Map(episodes.map((e) => [e.id, e])), [episodes])

  // Anomalies LOCALES (cahier §4.9.1) : calculées sur la grille actuellement
  // ouverte, période affichée — feedback d'édition pendant qu'on construit un
  // brouillon, quel qu'il soit. Alimentent le panneau et le surlignage des
  // blocs dans CET écran uniquement.
  const diffusionsAffichees = useMemo(
    () => jours.flatMap((j) => diffusionsParJour.get(j) ?? []),
    [jours, diffusionsParJour]
  )
  const anomalies = useMemo(
    () => calculerAnomalies(diffusionsAffichees, episodesParId, blocsGrilleType, fenetresDroits),
    [diffusionsAffichees, episodesParId, blocsGrilleType, fenetresDroits]
  )
  const idsBloquants = useMemo(
    () => new Set(anomalies.filter((a) => a.niveau === 'bloquant').map((a) => a.id)),
    [anomalies]
  )
  const nbBloquantes = compterBloquantes(anomalies)

  // Badge global du rail de navigation (P23) : UNIQUEMENT la grille LIVE de
  // la chaîne, indépendamment de l'onglet affiché — c'est elle qui pilote
  // réellement l'antenne (M8). Même fenêtre de dates que la vue courante
  // (comportement de période déjà en place avant P23, inchangé).
  const diffusionsLiveAffichees = useMemo(() => {
    if (!grilleLive) return []
    return jours.flatMap((j) => diffusions.filter((d) => d.grille_id === grilleLive.id && d.date === j))
  }, [diffusions, grilleLive, jours])
  const anomaliesLive = useMemo(
    () => calculerAnomalies(diffusionsLiveAffichees, episodesParId, blocsGrilleType, fenetresDroits),
    [diffusionsLiveAffichees, episodesParId, blocsGrilleType, fenetresDroits]
  )
  const nbBloquantesLive = compterBloquantes(anomaliesLive)

  useEffect(() => {
    onAnomaliesBloquantes?.(nbBloquantesLive)
  }, [nbBloquantesLive, onAnomaliesBloquantes])

  const genresPresents = useMemo(() => {
    const set = new Set()
    for (const j of jours) {
      for (const d of diffusionsParJour.get(j) ?? []) {
        set.add(programmesParId.get(d.programme_id)?.genre || '')
      }
    }
    return [...set]
  }, [diffusionsParJour, jours, programmesParId])

  // Libellé de période, même logique que la barre de navigation (span
  // affiché juste en dessous) — réutilisé comme titre/nom de fichier de
  // l'export « Liste des transmissions » (P26).
  const periodeLabel =
    vue === 'SEMAINE'
      ? formaterPlageSemaine(lundi)
      : vue === 'JOUR'
        ? formaterDateLongue(dateReference)
        : vue === 'MOIS'
          ? formaterMoisAnnee(dateReference)
          : formaterAnnee(dateReference)

  // Export « Liste des transmissions » (EXG-M2-11, P26) — grille active (P23)
  // + période/vue affichées (P25) : reprend exactement diffusionsAffichees,
  // déjà scopée pour les anomalies locales de cet écran. Même découpage que
  // Accueil.jsx : la fonction pure construit un bundle unique, chaque format
  // le met en forme.
  function donneesExportTransmissions() {
    return construireDonneesListeTransmissions({
      chaineNom: chaineActive.nom,
      periodeLabel,
      diffusions: diffusionsAffichees,
      programmesParId,
      fenetresDroits,
    })
  }

  function exporterTransmissionsExcel() {
    try {
      const donnees = donneesExportTransmissions()
      const feuille = XLSX.utils.aoa_to_sheet(construireLignesExcelListeTransmissions(donnees))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Transmissions')
      XLSX.writeFile(classeur, construireNomFichierListeTransmissions(chaineActive.nom, periodeLabel, 'xlsx'))
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  // Export « 2 feuilles TNT/SAT » (P27) — montre toujours les 2 vecteurs côte
  // à côte, indépendamment de la bascule d'affichage Unifié/TNT/Satellite
  // (Partie C) : reconstruit sa propre liste depuis diffusionsGrilleActive
  // (non filtrée), jamais depuis diffusionsAffichees. Même prédicat RG-13 que
  // la bascule et Conducteur.jsx.
  function exporterTransmissionsExcelTNTSat() {
    try {
      const diffusionsPeriodeToutVecteur = jours.flatMap((j) => diffusionsGrilleActive.filter((d) => d.date === j))
      const donneesTNT = construireDonneesListeTransmissions({
        chaineNom: chaineActive.nom,
        periodeLabel,
        diffusions: diffusionsPeriodeToutVecteur.filter((d) => d.vecteur == null || d.vecteur === 'TNT'),
        programmesParId,
        fenetresDroits,
      })
      const donneesSAT = construireDonneesListeTransmissions({
        chaineNom: chaineActive.nom,
        periodeLabel,
        diffusions: diffusionsPeriodeToutVecteur.filter((d) => d.vecteur == null || d.vecteur === 'SATELLITE'),
        programmesParId,
        fenetresDroits,
      })
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(construireLignesExcelListeTransmissions(donneesTNT)), 'TNT')
      XLSX.utils.book_append_sheet(classeur, XLSX.utils.aoa_to_sheet(construireLignesExcelListeTransmissions(donneesSAT)), 'SAT')
      XLSX.writeFile(classeur, `Liste des transmissions — ${chaineActive.nom} — ${periodeLabel} (TNT+SAT).xlsx`)
    } catch (err) {
      setErreur(`Échec de l'export Excel TNT/SAT : ${err.message}`)
    }
  }

  function exporterTransmissionsPdf() {
    try {
      const donnees = donneesExportTransmissions()
      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(14)
      doc.text(donnees.titre, 14, 16)
      doc.setFontSize(9)
      doc.text(donnees.periodeLabel, 14, 22)
      autoTable(doc, {
        startY: 28,
        head: [ENTETE_LISTE_TRANSMISSIONS],
        body: donnees.lignes.map((l) => [l.date, l.debut, l.fin, l.titre, l.episode, l.genre, l.duree, l.vecteur, l.support, l.statutDroits]),
        styles: { fontSize: 8 },
      })
      doc.save(construireNomFichierListeTransmissions(chaineActive.nom, periodeLabel, 'pdf'))
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    }
  }

  async function exporterTransmissionsWord() {
    try {
      const donnees = donneesExportTransmissions()
      const ligneEntete = (libelles) =>
        new TableRow({ children: libelles.map((l) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: l, bold: true })] })] })) })
      const ligne = (valeurs) => new TableRow({ children: valeurs.map((v) => new TableCell({ children: [new Paragraph(String(v))] })) })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: donnees.titre, heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: donnees.periodeLabel }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [ligneEntete(ENTETE_LISTE_TRANSMISSIONS), ...donnees.lignes.map((l) => ligne([l.date, l.debut, l.fin, l.titre, l.episode, l.genre, l.duree, l.vecteur, l.support, l.statutDroits]))],
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = construireNomFichierListeTransmissions(chaineActive.nom, periodeLabel, 'docx')
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  function naviguer(delta) {
    if (vue === 'SEMAINE') return setDateReference((d) => ajouterJours(d, 7 * delta))
    if (vue === 'MOIS') return setDateReference((d) => ajouterMois(d, delta))
    if (vue === 'ANNEE') return setDateReference((d) => ajouterAnnees(d, delta))
    setDateReference((d) => ajouterJours(d, delta)) // JOUR
  }

  // Drill-down (P25) : clic sur une cellule de la vue Mois → vue Jour à cette
  // date ; clic sur une tuile de la vue Année → vue Mois à ce mois. Aucune
  // édition directe en Mois/Année (RG confirmée) — ces vues ne font que
  // naviguer.
  function ouvrirJourDepuisApercu(date) {
    setDateReference(date)
    setVue('JOUR')
  }

  function ouvrirMoisDepuisApercu(premierJour) {
    setDateReference(premierJour)
    setVue('MOIS')
  }

  async function ouvrirCreation(date, heureDebut) {
    if (!(await changerBlocSelectionne(null))) return
    setAnomaliesOuvertes(false)
    setModale({ mode: 'CREATION', date, heureDebut })
  }

  // Panneau Anomalies et Inspecteur partagent le même emplacement flottant
  // (P11 : panneau flottant plutôt que 3e colonne) — mutuellement exclusifs,
  // comme le prescrit le cahier pour les 2 onglets du panneau droit (§4.3.2).
  async function ouvrirAnomalies() {
    if (!(await changerBlocSelectionne(null))) return
    setAnomaliesOuvertes(true)
  }

  async function allerVersAnomalie(id) {
    const diffusion = diffusions.find((d) => d.id === id)
    if (!diffusion) return
    if (!(await changerBlocSelectionne(diffusion))) return
    setAnomaliesOuvertes(false)
  }

  function appliquerCreation(nouvelle) {
    setDiffusions((prev) => [...prev, nouvelle])
    setModale(null)
  }

  // Réutilisée par l'onglet Bloc (édition horaire) et l'onglet Vecteur (mise à
  // jour de l'original après scission) de l'Inspecteur — si le bloc modifié
  // est celui actuellement inspecté, son affichage est resynchronisé sans que
  // l'utilisateur ait besoin de rouvrir le panneau.
  function appliquerEdition(maj) {
    setDiffusions((prev) => prev.map((d) => (d.id === maj.id ? maj : d)))
    setBlocSelectionne((actuel) => (actuel && actuel.id === maj.id ? maj : actuel))
  }

  function appliquerSuppression(id) {
    setDiffusions((prev) => prev.filter((d) => d.id !== id))
    setBlocSelectionne((actuel) => (actuel && actuel.id === id ? null : actuel))
  }

  // Onglet Répéter de l'Inspecteur : ajout en bloc après un insert en 1 seule
  // requête (creerDiffusionsLineaires), et onglet Vecteur : ajout de la ligne
  // SATELLITE créée par la scission (tableau à 1 élément). Aussi utilisée par
  // le collage (P23, plusieurs éléments d'un coup).
  function appliquerCreationMultiple(nouvelles) {
    setDiffusions((prev) => [...prev, ...nouvelles])
  }

  // Applique le résultat d'un Annuler/Rétablir (toolbar ou raccourcis P11/P15
  // unifiés dans la pile générique, undoManager.js) à l'état local — même
  // mécanique que appliquerEdition/appliquerSuppression, réutilisée plutôt
  // que dupliquée : `ligne === null` -> la transmission disparaît, sinon elle
  // (ré)apparaît avec ce contenu.
  function appliquerChangementsPile(changements) {
    setDiffusions((prev) => fusionnerChangements(prev, changements))
    setBlocSelectionne((actuel) => {
      if (!actuel) return actuel
      const c = changements.find((c) => c.id === actuel.id)
      return c ? c.ligne : actuel
    })
  }

  async function gererAnnuler() {
    if (!grilleActive) return
    const resultat = await annulerDerniereAction(chaineActive.id, 'GRILLE_LINEAIRE', grilleActive.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    if (!grilleActive) return
    const resultat = await retablirAction(chaineActive.id, 'GRILLE_LINEAIRE', grilleActive.id)
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  // La `date` d'une transmission = le jour d'antenne de la colonne où l'on
  // dépose/clique (RG-19/20) — jamais recalculée depuis heureDebut, même pour
  // un dépôt entre 00:00 et 05:59 qui reste rattaché à ce même jour d'antenne.
  //
  // Garde-fou (RG-01/RG-03/RG-07, EXG-M2-04/05, P14a) : contrôle AVANT toute
  // écriture, à la date de diffusion VISÉE (jourAntenne), pas aujourd'hui.
  // Le catalogue empêche déjà le drag d'un épisode non-PAD (defense en
  // profondeur ici, même logique que les gardes anti-réponse-périmée déjà en
  // place ailleurs) ; les droits du titre, eux, ne peuvent être vérifiés
  // qu'ici puisqu'ils dépendent du jour visé, connu seulement au dépôt.
  function deposerEpisode(jourAntenne, minuteDebut) {
    if (!grilleActive) return
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
    const episode = episodesParId.get(payload.episodeId)
    if (!estEpisodePret(episode)) {
      setErreur('Dépôt refusé — support non prêt à diffuser (PAD).')
      return
    }
    const droits = estProgrammable(payload.programmeId, fenetresDroits, jourAntenne)
    if (!droits.ok) {
      setErreur(`Dépôt refusé — ${droits.motif}`)
      return
    }
    const heureDebut = minutesEnHeure(minuteDebut)
    const heureFin = minutesEnHeure(minuteDebut + (payload.duree ?? DUREE_PAR_DEFAUT_MIN))
    const programme = programmesParId.get(payload.programmeId)
    const champs = {
      programme_id: payload.programmeId,
      episode_id: payload.episodeId,
      episode_numero: payload.numero ?? null,
      chaine: chaineActive.nom,
      chaine_id: chaineActive.id,
      grille_id: grilleActive.id,
      date: jourAntenne,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme?.genre || null,
      titre_cache: programme?.titre ?? null,
    }
    creerDiffusionLineaire(champs)
      .then((cree) =>
        enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'GRILLE_LINEAIRE',
          documentId: grilleActive.id,
          libelle: `Dépôt : ${cree.titre_cache}`,
          operations: [{ table: 'diffusion_lineaire', type: 'INSERT', id: cree.id, apres: cree }],
        }).then(() => appliquerCreation(cree))
      )
      .catch((err) => setErreur(err.message))
  }

  // --- Gestion des grilles (P23) ---

  function selectionnerGrille(id) {
    setGrilleActiveId(id)
    setBlocSelectionne(null)
    setAnomaliesOuvertes(false)
    setSelectionActive(false)
    setBlocsSelectionnesIds(new Set())
  }

  function ouvrirGrille(id) {
    setGrillesOuvertesIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    selectionnerGrille(id)
  }

  function fermerOnglet(id) {
    setGrillesOuvertesIds((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((x) => x !== id)
      if (grilleActiveId === id) selectionnerGrille(next[0])
      return next
    })
  }

  async function creerEtOuvrirGrille(nom) {
    const nouvelle = await creerGrille({ chaine_id: chaineActive.id, nom, est_live: false, cree_par: lireUtilisateur() })
    setGrilles((prev) => [...prev, nouvelle])
    ouvrirGrille(nouvelle.id)
    setModaleGrille(null)
  }

  async function renommerGrilleActive(nom) {
    const maj = await mettreAJourGrille(grilleActive.id, { nom })
    setGrilles((prev) => prev.map((g) => (g.id === maj.id ? maj : g)))
    setModaleGrille(null)
  }

  async function dupliquerGrilleActive(nom) {
    const nouvelle = await dupliquerGrille(grilleActive, nom, lireUtilisateur())
    const lignes = await listerDiffusionsLineairesParChaine(chaineActive.id)
    setGrilles((prev) => [...prev, nouvelle])
    setDiffusions(lignes)
    ouvrirGrille(nouvelle.id)
    setModaleGrille(null)
  }

  async function definirLive() {
    if (!grilleActive || grilleActive.est_live) return
    const confirme = await confirmer({
      titre: 'Définir comme live',
      message: `Définir « ${grilleActive.nom} » comme grille live de ${chaineActive.nom} ? Elle remplacera « ${grilleLive?.nom ?? '—'} » pour le Conducteur, les Anomalies et le Stock/bilans.`,
      labelConfirmer: 'Définir comme live',
    })
    if (!confirme) return
    await definirGrilleLive(chaineActive.id, grilleActive.id)
    setGrilles(await listerGrillesParChaine(chaineActive.id))
  }

  async function supprimerGrilleActive() {
    if (!grilleActive || grilleActive.est_live) return
    const nb = diffusions.filter((d) => d.grille_id === grilleActive.id).length
    const confirme = await confirmer({
      titre: 'Supprimer la grille',
      message: `Supprimer définitivement « ${grilleActive.nom} »${nb > 0 ? ` et ses ${nb} diffusion(s)` : ''} ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!confirme) return
    const idSupprime = grilleActive.id
    await supprimerGrille(idSupprime)
    setGrilles((prev) => prev.filter((g) => g.id !== idSupprime))
    setDiffusions((prev) => prev.filter((d) => d.grille_id !== idSupprime))
    setGrillesOuvertesIds((prev) => {
      const next = prev.filter((x) => x !== idSupprime)
      const restante = next.length > 0 ? next : [grilleLive?.id].filter(Boolean)
      setGrilleActiveId(restante[0] ?? null)
      return restante
    })
  }

  // --- Sélection multiple + copier/coller (P23) ---

  function activerSelection() {
    setSelectionActive(true)
    setBlocsSelectionnesIds(new Set())
  }

  function annulerSelection() {
    setSelectionActive(false)
    setBlocsSelectionnesIds(new Set())
  }

  function copierSelection() {
    const snapshots = diffusions
      .filter((d) => blocsSelectionnesIds.has(d.id))
      .map((d) => Object.fromEntries(CHAMPS_COPIABLES.map((c) => [c, d[c]])))
    setPresseGaPapier(snapshots)
    annulerSelection()
  }

  // Colle à la MÊME date/heure que la copie, dans la grille actuellement
  // ouverte — mêmes contrôles PAD/droits qu'un dépôt manuel (principe 2 : le
  // contrôle intervient au geste). Un élément refusé est silencieusement
  // écarté, le nombre de refus est signalé après coup ; un conflit d'horaire
  // n'est PAS bloquant, seulement signalé par le centre d'anomalies (comme le
  // dépôt manuel actuel).
  async function coller() {
    if (!grilleActive || presseGaPapier.length === 0) return
    const creees = []
    for (const item of presseGaPapier) {
      const episode = episodesParId.get(item.episode_id)
      if (!estEpisodePret(episode)) continue
      if (!estProgrammable(item.programme_id, fenetresDroits, item.date).ok) continue
      const cree = await creerDiffusionLineaire({
        ...item,
        chaine: chaineActive.nom,
        chaine_id: chaineActive.id,
        grille_id: grilleActive.id,
      })
      creees.push(cree)
    }
    if (creees.length === 0) {
      setErreur('Aucun élément collé — droits ou PAD invalides à la date cible.')
      return
    }
    await enregistrerAction({
      chaineId: chaineActive.id,
      ecran: 'GRILLE_LINEAIRE',
      documentId: grilleActive.id,
      libelle: `Collage (${creees.length} programme${creees.length > 1 ? 's' : ''})`,
      operations: creees.map((d) => ({ table: 'diffusion_lineaire', type: 'INSERT', id: d.id, apres: d })),
    })
    appliquerCreationMultiple(creees)
    const refuses = presseGaPapier.length - creees.length
    setPresseGaPapier([])
    if (refuses > 0) setErreur(`${refuses} élément(s) refusé(s) (droits/PAD) sur ${creees.length + refuses}.`)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {/* Barre d'onglets (P23) : grilles ouvertes de la chaîne active. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          {grillesOuvertes.map((g) => (
            <div
              key={g.id}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                g.id === grilleActiveId
                  ? 'border-snrt-navy bg-snrt-navy/5 font-medium text-snrt-navy'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <button type="button" onClick={() => selectionnerGrille(g.id)} className="flex items-center gap-1.5">
                {g.nom}
                {g.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => fermerOnglet(g.id)}
                disabled={grillesOuvertes.length <= 1}
                title={grillesOuvertes.length <= 1 ? 'Dernier onglet ouvert' : 'Fermer (la grille reste enregistrée)'}
                className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setModaleGrille('OUVRIR')}
            title="Ouvrir une grille"
            className="rounded-md border border-dashed border-slate-300 p-1.5 text-slate-500 hover:border-snrt-navy hover:text-snrt-navy"
          >
            <Plus size={15} />
          </button>

          {grilleActive && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModaleGrille('RENOMMER')}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={12} />
                Renommer
              </button>
              <button
                type="button"
                onClick={() => setModaleGrille('DUPLIQUER')}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Copy size={12} />
                Dupliquer
              </button>
              <button
                type="button"
                onClick={() => setListeTransmissionsOuverte(true)}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                title="Exporter la grille (Excel/Word/PDF/TNT+SAT)"
              >
                <Download size={12} />
                Exporter
              </button>
              {!grilleActive.est_live && (
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
                onClick={supprimerGrilleActive}
                disabled={grilleActive.est_live}
                title={grilleActive.est_live ? 'Basculez une autre grille en live avant de supprimer celle-ci' : 'Supprimer'}
                className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={12} />
                Supprimer
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex rounded-md border border-slate-300 text-sm">
              {[
                ['JOUR', 'Jour'],
                ['SEMAINE', 'Semaine'],
                ['MOIS', 'Mois'],
                ['ANNEE', 'Année'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setVue(code)}
                  className={`px-3 py-2 ${vue === code ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-md border border-slate-300 text-sm" title="Bascule d'affichage par vecteur (RG-13) — filtre visuel uniquement">
              {[
                ['SATELLITE', 'Satellite'],
                ['TNT', 'TNT'],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setVueVecteur(code)}
                  className={`px-3 py-2 ${vueVecteur === code ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {vueEditable && (
              <div className="flex rounded-md border border-slate-300 text-sm" title="Précision de programmation">
                {PRESETS_ZOOM.map((preset, i) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => setIndexZoom(i)}
                    className={`px-3 py-2 ${i === indexZoom ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            {vueEditable && !selectionActive && (
              <button
                type="button"
                onClick={activerSelection}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <CheckSquare size={15} />
                Sélectionner
              </button>
            )}
            {vueEditable && selectionActive && (
              <div className="flex items-center gap-2 rounded-md border border-snrt-navy bg-snrt-navy/5 px-3 py-1.5 text-sm text-snrt-navy">
                <span>{blocsSelectionnesIds.size} sélectionné(s)</span>
                <button
                  type="button"
                  onClick={copierSelection}
                  disabled={blocsSelectionnesIds.size === 0}
                  className="font-medium underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copier
                </button>
                <button type="button" onClick={annulerSelection} className="text-slate-500 hover:text-slate-700">
                  Annuler
                </button>
              </div>
            )}
            {vueEditable && presseGaPapier.length > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
                <span>{presseGaPapier.length} copié(s)</span>
                <button
                  type="button"
                  onClick={coller}
                  className="flex items-center gap-1 font-medium underline hover:no-underline"
                >
                  <ClipboardPaste size={13} />
                  Coller
                </button>
                <button type="button" onClick={() => setPresseGaPapier([])} className="text-amber-700/70 hover:text-amber-900">
                  Vider
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => naviguer(-1)}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[12rem] text-center text-sm font-medium text-slate-700">
              {vue === 'SEMAINE' && formaterPlageSemaine(lundi)}
              {vue === 'JOUR' && formaterDateLongue(dateReference)}
              {vue === 'MOIS' && formaterMoisAnnee(dateReference)}
              {vue === 'ANNEE' && formaterAnnee(dateReference)}
            </span>
            <button
              type="button"
              onClick={() => naviguer(1)}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"
            >
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPleinEcran((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                pleinEcran ? 'border-snrt-navy bg-snrt-navy/5 text-snrt-navy' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={pleinEcran ? 'Afficher le panneau catalogue' : 'Masquer le panneau catalogue pour élargir la grille'}
            >
              {pleinEcran ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              Plein écran
            </button>
            <button
              type="button"
              onClick={() => setAfficherGrilleType((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                afficherGrilleType
                  ? 'border-snrt-navy bg-snrt-navy/5 text-snrt-navy'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title="Afficher les blocs de la grille type en fond"
            >
              <Layers3 size={15} />
              Grille type
            </button>
            <button
              type="button"
              onClick={ouvrirAnomalies}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                nbBloquantes > 0
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CircleAlert size={15} />
              Anomalies
              {nbBloquantes > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{nbBloquantes}</span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => succes('Grille enregistrée ✓')}
              title="Chaque action écrit déjà en base immédiatement — ce bouton confirme simplement que tout est à jour."
              className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover"
            >
              <Save size={15} />
              Enregistrer
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
          </div>
        </div>

        {genresPresents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            {genresPresents.map((g) => {
              const { fond } = couleurGenre(g)
              return (
                <span key={g} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${fond}`} />
                  {g || 'Sans genre'}
                </span>
              )
            })}
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="flex items-start gap-4">
        {!pleinEcran && (
          <CataloguePanel chaineActive={chaineActive} dragRef={dragRef} onOuvrirHistorique={setHistoriqueOuvert} />
        )}

        {!chargement && grilleActive && vueEditable && (
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${jours.length}, minmax(140px, 1fr))` }}>
                <div className="sticky top-0 z-10 bg-white" style={{ gridRow: 1, gridColumn: 1 }} />
                {jours.map((j, i) => (
                  <div
                    key={j}
                    style={{ gridRow: 1, gridColumn: i + 2 }}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600"
                  >
                    {formaterJourCourt(j)}
                  </div>
                ))}

                <div className="relative" style={{ gridRow: 2, gridColumn: 1, height: calculerHauteurTotale(presetZoom) }}>
                  {MARQUES_HEURES.map((m) => (
                    <div
                      key={m}
                      style={{ position: 'absolute', top: (m - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute - 6, right: 8 }}
                      className="text-[11px] text-slate-400"
                    >
                      {minutesEnHeure(m)}
                    </div>
                  ))}
                  {/* Graduations mineures (P25) : trait court sans heure
                      écrite — le pas dépend du palier de zoom (10 min en
                      Standard, 5 min en Précis), juste un repère visuel pour
                      aligner un dépôt/clic précisément. */}
                  {graduationsMineures.map((m) => (
                    <div
                      key={m}
                      style={{ position: 'absolute', top: (m - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute, right: 8, width: 6 }}
                      className="border-t border-slate-300"
                    />
                  ))}
                </div>

                {jours.map((j, i) => {
                  const pistees = disposerEnPistes(diffusionsParJour.get(j) ?? [])
                  const bandes = afficherGrilleType ? blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(j)) : []
                  return (
                    <div
                      key={j}
                      className="relative cursor-pointer border-l border-slate-100 hover:bg-slate-50/50"
                      style={{ gridRow: 2, gridColumn: i + 2, height: calculerHauteurTotale(presetZoom) }}
                      onClick={(e) => {
                        if (selectionActive) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top, presetZoom)
                        ouvrirCreation(j, minutesEnHeure(minute))
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (selectionActive) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top, presetZoom)
                        deposerEpisode(j, minute)
                      }}
                    >
                      {MARQUES_HEURES.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: (m - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute }}
                        />
                      ))}
                      {/* Graduations mineures (P25) : mêmes pas que l'axe,
                          trait plus discret que les marques horaires pour ne
                          pas rivaliser visuellement avec elles. */}
                      {graduationsMineures.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                          style={{ top: (m - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute }}
                        />
                      ))}
                      {/* Bandes de grille type (EXG-M3-04) : purement visuelles,
                          pointer-events-none garantit qu'aucun geste (clic,
                          drag) n'est intercepté — le clic traverse jusqu'à la
                          cellule ou au bloc de transmission en dessous/dessus.
                          Rendues avant les blocs de transmission dans le JSX
                          pour rester visuellement en arrière-plan. */}
                      {bandes.map((bloc) => {
                        // Couleur du TYPE de bloc (Grille type — évolution des
                        // types) ; repli sur le genre attendu pour d'éventuels
                        // blocs sans type (avant cette évolution / migration).
                        const { fondClair, bordure } = bloc.type_bloc
                          ? couleurType(bloc.type_bloc)
                          : couleurGenre(bloc.genre_attendu)
                        const topBande = (minutesDepuisDebutAntenne(bloc.heure_debut) - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute
                        const hauteurBande =
                          (minutesDepuisDebutAntenne(bloc.heure_fin) - minutesDepuisDebutAntenne(bloc.heure_debut)) *
                          presetZoom.pxParMinute
                        return (
                          <div
                            key={bloc.id}
                            className={`pointer-events-none absolute left-0 right-0 overflow-hidden border-t ${fondClair} ${bordure}`}
                            style={{ top: `${topBande}px`, height: `${hauteurBande}px` }}
                          >
                            <span className="absolute left-1 top-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                              {bloc.nom}
                            </span>
                          </div>
                        )
                      })}
                      {pistees.map(({ item: diffusion, debut, fin, piste, nbPistes }) => {
                        const top = (debut - DEBUT_JOURNEE_ANTENNE) * presetZoom.pxParMinute
                        const hauteur = Math.max(14, (fin - debut) * presetZoom.pxParMinute - 2)
                        const genre = programmesParId.get(diffusion.programme_id)?.genre
                        const { fond, texte } = couleurGenre(genre)
                        const etiquetteEpisode =
                          diffusion.episode_numero != null ? `ÉP.${String(diffusion.episode_numero).padStart(2, '0')} — ` : ''
                        const estSelectionne = blocSelectionne?.id === diffusion.id
                        const estCoche = selectionActive && blocsSelectionnesIds.has(diffusion.id)
                        const enAnomalieBloquante = idsBloquants.has(diffusion.id)
                        const selectionner = async (e) => {
                          e.stopPropagation()
                          if (selectionActive) {
                            setBlocsSelectionnesIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(diffusion.id)) next.delete(diffusion.id)
                              else next.add(diffusion.id)
                              return next
                            })
                            return
                          }
                          if (!(await changerBlocSelectionne(diffusion))) return
                          setModale(null)
                          setAnomaliesOuvertes(false)
                        }
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            key={diffusion.id}
                            onClick={selectionner}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return
                              if (e.key === 'Enter' || e.key === ' ') selectionner(e)
                            }}
                            className={`group absolute cursor-pointer overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte} ${
                              estCoche
                                ? 'ring-2 ring-offset-1 ring-emerald-600'
                                : estSelectionne
                                  ? 'ring-2 ring-offset-1 ring-snrt-navy'
                                  : enAnomalieBloquante
                                    ? 'ring-2 ring-offset-1 ring-red-600'
                                    : ''
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${hauteur}px`,
                              left: `${(piste / nbPistes) * 100}%`,
                              width: `${100 / nbPistes}%`,
                            }}
                          >
                            {!selectionActive && (
                              <button
                                type="button"
                                title="Déprogrammer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deprogrammerDiffusion(diffusion, {
                                    chaineActive,
                                    grilleId: grilleActive.id,
                                    onSupprime: appliquerSuppression,
                                    confirmer,
                                  }).catch((err) => setErreur(err.message))
                                }}
                                className="absolute top-0.5 right-0.5 z-10 flex h-3 w-3 items-center justify-center rounded-full bg-white text-red-600 opacity-0 shadow-sm ring-1 ring-red-200 hover:bg-red-50 focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <X size={8} strokeWidth={3} />
                              </button>
                            )}
                            <div className="font-medium">
                              {diffusion.heure_debut}–{diffusion.heure_fin}
                            </div>
                            <div className="truncate">
                              {etiquetteEpisode}
                              {diffusion.vecteur ? `[${diffusion.vecteur === 'SATELLITE' ? 'SAT' : 'TNT'}] ` : ''}
                              {diffusion.titre_cache}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!chargement && grilleActive && vue === 'MOIS' && (
          <VueCalendrierMois
            dateReference={dateReference}
            jours={jours}
            diffusionsParJour={diffusionsParJour}
            programmesParId={programmesParId}
            onOuvrirJour={ouvrirJourDepuisApercu}
          />
        )}

        {!chargement && grilleActive && vue === 'ANNEE' && (
          <VueAnnee
            moisListe={moisDeLAnnee(dateReference)}
            diffusionsGrilleActive={diffusionsGrilleActiveVue}
            onOuvrirMois={ouvrirMoisDepuisApercu}
          />
        )}
      </div>

      {modale && grilleActive && (
        <Modal titre="Ajouter un créneau" onFermer={() => setModale(null)}>
          <FormulaireCreneau
            modale={modale}
            chaineActive={chaineActive}
            grilleId={grilleActive.id}
            programmesDisponibles={programmesDeLaChaine}
            programmesParId={programmesParId}
            fenetresDroits={fenetresDroits}
            onCree={appliquerCreation}
          />
        </Modal>
      )}

      {historiqueOuvert && (
        <PopoverHistorique programme={historiqueOuvert} onFermer={() => setHistoriqueOuvert(null)} />
      )}

      {blocSelectionne && grilleActive && (
        <InspecteurBloc
          diffusion={blocSelectionne}
          programme={programmesParId.get(blocSelectionne.programme_id)}
          chaineActive={chaineActive}
          grilleId={grilleActive.id}
          diffusionsGrilleActive={diffusionsGrilleActive}
          onFermer={() => changerBlocSelectionne(null)}
          onModifie={appliquerEdition}
          onSupprime={appliquerSuppression}
          onCreerPlusieurs={appliquerCreationMultiple}
          onChangementsPile={appliquerChangementsPile}
          onModifieChange={setBlocModifie}
        />
      )}

      {anomaliesOuvertes && (
        <PanneauAnomalies
          anomalies={anomalies}
          onFermer={() => setAnomaliesOuvertes(false)}
          onAller={allerVersAnomalie}
        />
      )}

      {listeTransmissionsOuverte && (
        <Modal titre="Exporter la grille" onFermer={() => setListeTransmissionsOuverte(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              {grilleActive?.nom} — {periodeLabel} ({diffusionsAffichees.length} transmission{diffusionsAffichees.length > 1 ? 's' : ''})
            </p>
            <button type="button" onClick={exporterTransmissionsExcel} className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button type="button" onClick={exporterTransmissionsWord} className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50">
              <FileText size={16} />
              Word
            </button>
            <button type="button" onClick={exporterTransmissionsPdf} className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              <File size={16} />
              PDF
            </button>
            <button
              type="button"
              onClick={exporterTransmissionsExcelTNTSat}
              title="Feuilles TNT + Satellite séparées, indépendamment de la bascule d'affichage"
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              <FileSpreadsheet size={16} />
              Excel (TNT + SAT)
            </button>
          </div>
        </Modal>
      )}

      {modaleGrille === 'OUVRIR' && (
        <ModaleOuvrirGrille
          grilles={grilles}
          grillesOuvertesIds={grillesOuvertesIds}
          onOuvrir={ouvrirGrille}
          onCreer={creerEtOuvrirGrille}
          onFermer={() => setModaleGrille(null)}
        />
      )}
      {modaleGrille === 'RENOMMER' && grilleActive && (
        <ModaleNomGrille
          titre="Renommer la grille"
          valeurInitiale={grilleActive.nom}
          labelBouton="Renommer"
          onValider={renommerGrilleActive}
          onFermer={() => setModaleGrille(null)}
        />
      )}
      {modaleGrille === 'DUPLIQUER' && grilleActive && (
        <ModaleNomGrille
          titre="Dupliquer la grille"
          valeurInitiale={`${grilleActive.nom} (copie)`}
          labelBouton="Dupliquer"
          onValider={dupliquerGrilleActive}
          onFermer={() => setModaleGrille(null)}
        />
      )}
    </div>
  )
}

// Vue Mois (P25) : aperçu en lecture seule — calendrier 7 colonnes, une
// cellule par jour de `jours` (déjà la grille calendrier complète, jours
// hors-mois inclus pour ne jamais avoir de semaine incomplète). Résumé par
// cellule = puces de couleur par genre présent + nombre de diffusions.
// Aucune création/édition ici (RG confirmée) — seul le clic sur une cellule
// bascule en vue Jour à cette date pour éditer normalement.
const JOURS_SEMAINE_ABBR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function VueCalendrierMois({ dateReference, jours, diffusionsParJour, programmesParId, onOuvrirJour }) {
  const aujourdHui = aujourdHuiISO()
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
        {JOURS_SEMAINE_ABBR.map((label) => (
          <div key={label} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-600">
            {label}
          </div>
        ))}
        {jours.map((jour) => {
          const diffusionsJour = diffusionsParJour.get(jour) ?? []
          const horsMois = !estMemeMois(jour, dateReference)
          const estAujourdHui = jour === aujourdHui
          const genresPresents = [...new Set(diffusionsJour.map((d) => programmesParId.get(d.programme_id)?.genre || ''))]
          return (
            <button
              key={jour}
              type="button"
              onClick={() => onOuvrirJour(jour)}
              className={`flex min-h-[84px] flex-col items-start gap-1.5 bg-white p-2 text-left hover:bg-slate-50 ${
                horsMois ? 'opacity-40' : ''
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  estAujourdHui ? 'bg-snrt-navy text-white' : 'text-slate-700'
                }`}
              >
                {Number(jour.slice(8, 10))}
              </span>
              {diffusionsJour.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-0.5">
                    {genresPresents.slice(0, 8).map((g) => (
                      <span key={g} className={`h-1.5 w-1.5 rounded-full ${couleurGenre(g).fond}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {diffusionsJour.length} diffusion{diffusionsJour.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Vue Année (P25) : aperçu en lecture seule — 12 tuiles mensuelles, résumé
// léger (nombre total de diffusions ce mois, filtre simple sur les
// diffusions déjà chargées en mémoire, pas de détail jour par jour). Clic
// sur une tuile bascule en vue Mois à ce mois.
function VueAnnee({ moisListe, diffusionsGrilleActive, onOuvrirMois }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {moisListe.map(({ mois, annee, premierJour }) => {
          const prefixe = premierJour.slice(0, 7) // "AAAA-MM"
          const nb = diffusionsGrilleActive.filter((d) => d.date.startsWith(prefixe)).length
          return (
            <button
              key={`${annee}-${mois}`}
              type="button"
              onClick={() => onOuvrirMois(premierJour)}
              className="flex flex-col items-start gap-1 rounded-md border border-slate-200 p-4 text-left hover:border-snrt-navy hover:bg-snrt-navy/5"
            >
              <span className="text-sm font-medium text-slate-800">{formaterMoisAnnee(premierJour)}</span>
              <span className="text-xs text-slate-500">
                {nb} diffusion{nb > 1 ? 's' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Panneau "Ouvrir une grille" (P23) : liste des grilles de la chaîne pas
// encore ouvertes + création d'une nouvelle grille, dans la même modale.
function ModaleOuvrirGrille({ grilles, grillesOuvertesIds, onOuvrir, onCreer, onFermer }) {
  const [nomNouvelle, setNomNouvelle] = useState('')
  const [creation, setCreation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()
  const fermees = grilles.filter((g) => !grillesOuvertesIds.includes(g.id))

  async function creer(e) {
    e.preventDefault()
    if (!nomNouvelle.trim()) return
    setCreation(true)
    setErreur(null)
    try {
      await onCreer(nomNouvelle.trim())
    } catch (err) {
      setErreur(err.message)
    } finally {
      setCreation(false)
    }
  }

  return (
    <Modal titre="Ouvrir une grille" onFermer={onFermer}>
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
                {g.nom}
                {g.est_live && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    LIVE
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Toutes les grilles de cette chaîne sont déjà ouvertes.</p>
        )}
        <form onSubmit={creer} className="flex items-end gap-2 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
              Nouvelle grille
            </label>
            <input
              id={idNom}
              type="text"
              value={nomNouvelle}
              onChange={(e) => setNomNouvelle(e.target.value)}
              placeholder="ex. Grille Ramadan"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creation || !nomNouvelle.trim()}
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

// Modale nom unique (P23) : réutilisée par Renommer et Dupliquer.
function ModaleNomGrille({ titre, valeurInitiale, labelBouton, onValider, onFermer }) {
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

function FormulaireCreneau({ modale, chaineActive, grilleId, programmesDisponibles, programmesParId, fenetresDroits, onCree }) {
  const [date, setDate] = useState(modale.date)
  // RG-03 : « non proposé » — les programmes hors droits À LA DATE COURANTE
  // DU FORMULAIRE (pas la date d'ouverture) sont exclus du select, recalculé
  // à chaque changement de date.
  const programmesProgrammables = useMemo(
    () => programmesDisponibles.filter((p) => estProgrammable(p.id, fenetresDroits, date).ok),
    [programmesDisponibles, fenetresDroits, date]
  )
  const [programmeId, setProgrammeId] = useState(programmesProgrammables[0]?.id ?? '')
  const [episodes, setEpisodes] = useState([])
  const [chargementEpisodes, setChargementEpisodes] = useState(false)
  const [episodeId, setEpisodeId] = useState('')
  const [heureDebut, setHeureDebut] = useState(modale.heureDebut)
  const [heureFin, setHeureFin] = useState(
    minutesEnHeure(heureEnMinutes(modale.heureDebut ?? '06:00') + DUREE_PAR_DEFAUT_MIN)
  )
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idProgramme = useId()
  const idEpisode = useId()
  const idDate = useId()
  const idDebut = useId()
  const idFin = useId()
  const requeteEpisodesId = useRef(0)

  // Si le programme sélectionné sort de la liste programmable (changement de
  // date vers un jour hors droits), retombe sur le premier programme encore
  // programmable — RG-03 « non proposé », pas seulement refusé à la soumission.
  useEffect(() => {
    setProgrammeId((actuel) =>
      programmesProgrammables.some((p) => p.id === actuel) ? actuel : (programmesProgrammables[0]?.id ?? '')
    )
  }, [programmesProgrammables])

  // `requeteEpisodesId` ignore la réponse d'un fetch dépassé par un
  // changement de programme plus récent (même pattern que `requeteId` dans
  // ListeProgrammes.jsx) — sans ça, une réponse arrivée en retard peut écraser
  // episodes/episodeId avec ceux d'un AUTRE programme que celui affiché.
  useEffect(() => {
    const idAppel = ++requeteEpisodesId.current
    if (!programmeId) {
      setEpisodes([])
      return
    }
    setChargementEpisodes(true)
    listerEpisodes(programmeId)
      .then((lignes) => {
        if (idAppel !== requeteEpisodesId.current) return
        setEpisodes(lignes)
        // RG-07 : ne présélectionne qu'un épisode prêt à diffuser (PAD).
        setEpisodeId((actuel) =>
          lignes.some((ep) => ep.id === actuel && estEpisodePret(ep)) ? actuel : (lignes.find(estEpisodePret)?.id ?? '')
        )
      })
      .catch((err) => {
        if (idAppel !== requeteEpisodesId.current) return
        setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === requeteEpisodesId.current) setChargementEpisodes(false)
      })
  }, [programmeId])

  const episodesPrets = useMemo(() => episodes.filter(estEpisodePret), [episodes])

  // Recalcule heure_fin sur la durée de l'épisode sélectionné — réagit à la
  // valeur (episodeId), pas seulement à l'événement onChange du <select>, pour
  // couvrir aussi la présélection automatique (programme à un seul épisode).
  // heureDebut est lu par closure (valeur du rendu courant, jamais périmée
  // puisque cet effet se redéclenche sur la sélection elle-même) sans figurer
  // dans les dépendances : un changement ultérieur de heureDebut seul ne doit
  // pas re-écraser une heure de fin déjà ajustée manuellement par l'utilisateur.
  useEffect(() => {
    const ep = episodes.find((e) => e.id === episodeId)
    if (!ep) return
    setHeureFin(minutesEnHeure(heureEnMinutes(heureDebut) + (ep.duree ?? DUREE_PAR_DEFAUT_MIN)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontaire, voir commentaire ci-dessus
  }, [episodeId, episodes])

  if (programmesDisponibles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun programme sur la chaîne « {chaineActive.nom} ». Créez d'abord un programme sur cette chaîne dans
        l'écran Programmes.
      </p>
    )
  }

  if (programmesProgrammables.length === 0) {
    return (
      <p className="text-sm text-amber-600">
        Aucun programme programmable à cette date sur la chaîne « {chaineActive.nom} » (droits fermés ou épuisés).
        Changez de date ou ajustez les fenêtres de droits depuis la fiche du titre.
      </p>
    )
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (!episodeId) {
      setErreur('Choisissez un épisode.')
      return
    }
    // Revalidation silencieuse juste avant l'écriture (état potentiellement
    // périmé si le formulaire est resté ouvert le temps qu'une donnée change)
    // — défense en profondeur, le contrôle réel a déjà eu lieu via les
    // options proposées (RG-03).
    const episodeChoisi = episodes.find((ep) => ep.id === episodeId)
    if (!estEpisodePret(episodeChoisi)) {
      setErreur('Cet épisode n’est plus prêt à diffuser (PAD).')
      return
    }
    const droits = estProgrammable(programmeId, fenetresDroits, date)
    if (!droits.ok) {
      setErreur(`Dépôt refusé — ${droits.motif}`)
      return
    }
    setEnregistrement(true)
    setErreur(null)
    const programme = programmesParId.get(programmeId)
    const episode = episodes.find((ep) => ep.id === episodeId)
    const champs = {
      programme_id: programmeId,
      episode_id: episodeId,
      episode_numero: episode?.numero ?? null,
      chaine: chaineActive.nom,
      chaine_id: chaineActive.id,
      grille_id: grilleId,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme?.genre || null,
      titre_cache: programme?.titre ?? null,
    }
    try {
      const cree = await creerDiffusionLineaire(champs)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        documentId: grilleId,
        libelle: `Création : ${cree.titre_cache}`,
        operations: [{ table: 'diffusion_lineaire', type: 'INSERT', id: cree.id, apres: cree }],
      })
      onCree(cree)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <div>
        <label htmlFor={idProgramme} className="mb-1 block text-sm font-medium text-slate-700">
          Programme *
        </label>
        <select
          id={idProgramme}
          value={programmeId}
          required
          onChange={(e) => setProgrammeId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {programmesProgrammables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={idEpisode} className="mb-1 block text-sm font-medium text-slate-700">
          Épisode *
        </label>
        <select
          id={idEpisode}
          value={episodeId}
          required
          disabled={chargementEpisodes || episodesPrets.length === 0}
          onChange={(e) => setEpisodeId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          {episodesPrets.length === 0 && (
            <option value="">{chargementEpisodes ? 'Chargement…' : 'Aucun épisode prêt à diffuser'}</option>
          )}
          {episodesPrets.map((ep) => (
            <option key={ep.id} value={ep.id}>
              ÉP.{String(ep.numero ?? '?').padStart(2, '0')} — {ep.titre || 'Sans titre'} ({ep.duree ?? '?'} min)
            </option>
          ))}
        </select>
        {!chargementEpisodes && episodes.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Ce programme n'a aucun épisode — ajoutez-en un dans sa fiche avant de créer une transmission.
          </p>
        )}
        {!chargementEpisodes && episodes.length > 0 && episodesPrets.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Aucun épisode de ce programme n'est prêt à diffuser (PAD) — RG-07.
          </p>
        )}
      </div>
      <div>
        <label htmlFor={idDate} className="mb-1 block text-sm font-medium text-slate-700">
          Date (jour d'antenne) *
        </label>
        <input
          id={idDate}
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={idDebut} className="mb-1 block text-sm font-medium text-slate-700">
            Heure début *
          </label>
          <input
            id={idDebut}
            type="time"
            required
            value={heureDebut}
            onChange={(e) => setHeureDebut(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={idFin} className="mb-1 block text-sm font-medium text-slate-700">
            Heure fin *
          </label>
          <input
            id={idFin}
            type="time"
            required
            value={heureFin}
            onChange={(e) => setHeureFin(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={enregistrement}
          className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
