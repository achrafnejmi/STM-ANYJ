import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleLiveParChaine,
  listerElementsSecondairesParPlanMedia,
  obtenirPlanMediaLiveParChaine,
  listerCampagnesParChaine,
  listerSpotsBibliotheque,
  supprimerElementSecondaire,
} from '../lib/db.js'
import { enregistrerAction } from '../lib/undoManager.js'
import { aujourdHuiISO, ajouterJours, lundiDeLaSemaine, joursDeLaSemaine, formaterDateLongue } from '../lib/semaine.js'
import { construireDerouleJour, calculerSynthese, SEUIL_ECART_AFFICHE_SECONDES, SEUIL_ECART_SIGNALE_SECONDES } from '../lib/conducteur.js'
import { secondesEnHeureHMS } from '../lib/planMedia.js'
import { construireLignesExportConducteur, ENTETE_CONDUCTEUR, construireNomFichierConducteur } from '../lib/exportConducteur.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import PanneauInsertionManuelle from '../components/PanneauInsertionManuelle.jsx'
import BoutonExporter from '../components/BoutonExporter.jsx'

const VECTEURS = [
  { code: 'UNIFIE', label: 'Unifié' },
  { code: 'TNT', label: 'TNT' },
  { code: 'SATELLITE', label: 'Satellite' },
]

const LIBELLES_TYPE = {
  BANDE_ANNONCE: 'Bande-annonce',
  ECRAN_PUBLICITAIRE: 'Écran publicitaire',
  HABILLAGE: 'Habillage',
  AUTOPROMOTION: 'Autopromotion',
  SPOT: 'Spot',
}

function EtiquetteEcart({ ecart }) {
  const abs = Math.abs(ecart)
  if (abs < SEUIL_ECART_AFFICHE_SECONDES) return null
  const signale = abs >= SEUIL_ECART_SIGNALE_SECONDES
  const minutes = Math.round(abs / 60)
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${signale ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
      title="Écart entre le timecode calculé (cumul des durées) et l'horaire annoncé"
    >
      {ecart > 0 ? '+' : '−'}
      {minutes} min
    </span>
  )
}

function EtiquetteOrigine({ origine }) {
  return origine === 'AUTOMATIQUE' ? (
    <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Auto</span>
  ) : (
    <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Manuel</span>
  )
}

// Distinction visuelle programme vs élément secondaire : bordure + fond +
// indentation (l'élément apparaît « dans » la coupure de sa transmission).
function LigneConducteur({ ligne, onSupprimer }) {
  if (ligne.categorie === 'PROGRAMME') {
    const { fond, texte } = couleurGenre(ligne.genre)
    return (
      <div className="flex items-center gap-3 border-l-4 border-snrt-navy bg-white py-2 pl-3 pr-2 text-sm">
        <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{secondesEnHeureHMS(ligne.timecode)}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${fond} ${texte}`}>{ligne.genre || '—'}</span>
        <span className="flex-1 truncate font-medium text-slate-800">{ligne.titre || '—'}</span>
        <span className="w-16 shrink-0 font-mono text-xs text-slate-500">
          {ligne.episodeNumero != null ? `ÉP.${String(ligne.episodeNumero).padStart(2, '0')}` : '—'}
        </span>
        <span className="w-14 shrink-0 text-center text-xs text-slate-300" title="Support (non renseigné)">
          —
        </span>
        <span className="w-16 shrink-0 font-mono text-xs text-slate-500">{secondesEnHeureHMS(ligne.dureeSecondes)}</span>
        <EtiquetteOrigine origine={ligne.origine} />
        <EtiquetteEcart ecart={ligne.ecart} />
      </div>
    )
  }

  return (
    <div className="ml-8 flex items-center gap-3 border-l-2 border-slate-300 bg-slate-50 py-1.5 pl-3 pr-2 text-xs">
      <span className="w-20 shrink-0 font-mono text-slate-500">{secondesEnHeureHMS(ligne.timecode)}</span>
      <span className="flex-1 truncate text-slate-700">{ligne.libelle || '—'}</span>
      <span className="w-32 shrink-0 text-slate-500">{LIBELLES_TYPE[ligne.type] ?? ligne.type}</span>
      <span className="w-16 shrink-0 font-mono text-slate-500">{ligne.dureeSecondes}s</span>
      <EtiquetteOrigine origine={ligne.origine} />
      <EtiquetteEcart ecart={ligne.ecart} />
      <button type="button" onClick={() => onSupprimer(ligne.elementId)} className="shrink-0 text-red-500 hover:text-red-700" title="Supprimer">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// Point d'insertion (§4.8.2) : zone cliquable discrète entre deux lignes.
function PointInsertion({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Insérer un élément ici"
      className="flex h-3 w-full items-center justify-center text-slate-300 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
    >
      <Plus size={12} />
    </button>
  )
}

export default function Conducteur({ chaineActive }) {
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [vecteur, setVecteur] = useState('UNIFIE')
  const [programmes, setProgrammes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [elementsSecondaires, setElementsSecondaires] = useState([])
  const [planMediaLive, setPlanMediaLive] = useState(null)
  const [campagnes, setCampagnes] = useState([])
  const [spots, setSpots] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [insertion, setInsertion] = useState(null) // { coupureId } | null

  // P23 : le Conducteur (M7) pilote l'antenne réelle — lit uniquement la
  // grille LIVE de la chaîne, jamais les grilles parallèles (brouillons).
  // P24 : idem pour le plan média — uniquement le document live.
  useEffect(() => {
    setChargement(true)
    setErreur(null)
    Promise.all([obtenirGrilleLiveParChaine(chaineActive.id), obtenirPlanMediaLiveParChaine(chaineActive.id)])
      .then(([grilleLive, planMediaLiveTrouve]) =>
        Promise.all([
          listerProgrammesParChaine(chaineActive.id),
          grilleLive ? listerDiffusionsLineairesParGrille(grilleLive.id) : Promise.resolve([]),
          planMediaLiveTrouve ? listerElementsSecondairesParPlanMedia(planMediaLiveTrouve.id) : Promise.resolve([]),
          listerCampagnesParChaine(chaineActive.id),
          listerSpotsBibliotheque(chaineActive.id),
          Promise.resolve(planMediaLiveTrouve),
        ])
      )
      .then(([lignesProgrammes, lignesDiffusions, lignesElements, lignesCampagnes, lignesSpots, planMediaLiveTrouve]) => {
        setProgrammes(lignesProgrammes)
        setDiffusions(lignesDiffusions)
        setElementsSecondaires(lignesElements)
        setCampagnes(lignesCampagnes)
        setSpots(lignesSpots)
        setPlanMediaLive(planMediaLiveTrouve)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])

  const lundi = lundiDeLaSemaine(dateReference)
  const joursSemaine = useMemo(() => joursDeLaSemaine(lundi), [lundi])

  function naviguerJour(delta) {
    setDateReference((d) => ajouterJours(d, delta))
  }

  // EXG-M7-07/RG-13 : vue Unifié = versions communes (NULL) + TNT ; vue
  // Satellite = communes + Satellite. Pas de signalement croisé d'exception
  // (pas de colonne de liaison entre les 2 lignes scindées, limite déjà
  // assumée en P11).
  const diffusionsDuJour = useMemo(() => {
    return diffusions.filter((d) => {
      if (d.date !== dateReference) return false
      if (vecteur === 'SATELLITE') return d.vecteur == null || d.vecteur === 'SATELLITE'
      return d.vecteur == null || d.vecteur === 'TNT'
    })
  }, [diffusions, dateReference, vecteur])

  const elementsDuJour = useMemo(() => elementsSecondaires.filter((e) => e.date === dateReference), [elementsSecondaires, dateReference])

  // EXG-M7-01 : dérivé du plan de diffusion + du plan média, jamais saisi
  // indépendamment — pure fusion + recalcul, aucune écriture ici.
  const lignes = useMemo(() => construireDerouleJour(diffusionsDuJour, elementsDuJour), [diffusionsDuJour, elementsDuJour])
  const synthese = useMemo(() => calculerSynthese(lignes), [lignes])

  async function supprimerElement(id) {
    const element = elementsSecondaires.find((e) => e.id === id)
    try {
      await supprimerElementSecondaire(id)
      if (element && planMediaLive) {
        await enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'PLAN_MEDIA',
          documentId: planMediaLive.id,
          libelle: `Suppression : ${element.libelle ?? element.type}`,
          operations: [{ table: 'element_secondaire', type: 'DELETE', id, avant: element }],
        })
      }
      setElementsSecondaires((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setErreur(err.message)
    }
  }

  function ajouterElementLocal(nouveau) {
    setElementsSecondaires((prev) => [...prev, nouveau])
  }

  // EXG-M7-06 : « exportable et transmissible au système de diffusion » —
  // aucune régie réelle dans ce PoC, l'export EST la transmission (retouche
  // P31 : le bouton s'appelle désormais « Exporter », plus honnête sur
  // l'absence de vraie régie connectée, et propose aussi Word/PDF).
  const titreExport = `Conducteur — ${chaineActive.nom} — ${formaterDateLongue(dateReference)}`

  function exporterExcel() {
    try {
      const feuilleAOA = [[titreExport], ENTETE_CONDUCTEUR, ...construireLignesExportConducteur(lignes)]
      const feuille = XLSX.utils.aoa_to_sheet(feuilleAOA)
      feuille['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ENTETE_CONDUCTEUR.length - 1 } }]
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Conducteur')
      XLSX.writeFile(classeur, construireNomFichierConducteur(dateReference))
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  function exporterPdf() {
    try {
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(titreExport, 14, 16)
      autoTable(doc, { startY: 24, head: [ENTETE_CONDUCTEUR], body: construireLignesExportConducteur(lignes) })
      doc.save(construireNomFichierConducteur(dateReference, 'pdf'))
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    }
  }

  async function exporterWord() {
    try {
      const ligneEntete = (libelles) =>
        new TableRow({ children: libelles.map((l) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: l, bold: true })] })] })) })
      const ligne = (valeurs) => new TableRow({ children: valeurs.map((v) => new TableCell({ children: [new Paragraph(String(v))] })) })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: titreExport, heading: HeadingLevel.HEADING_1 }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [ligneEntete(ENTETE_CONDUCTEUR), ...construireLignesExportConducteur(lignes).map(ligne)],
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = construireNomFichierConducteur(dateReference, 'docx')
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => naviguerJour(-1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <select
              value={dateReference}
              onChange={(e) => setDateReference(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {joursSemaine.map((j) => (
                <option key={j} value={j}>
                  {formaterDateLongue(j)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => naviguerJour(1)} className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50">
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

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-300 text-sm">
              {VECTEURS.map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => setVecteur(v.code)}
                  className={`px-3 py-1.5 ${vecteur === v.code ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <BoutonExporter onExcel={exporterExcel} onWord={exporterWord} onPdf={exporterPdf} />
          </div>
        </div>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {chargement && <p className="p-2 text-sm text-slate-500">Chargement…</p>}
          {!chargement && lignes.length === 0 && <p className="p-2 text-sm text-slate-500">Aucune ligne ce jour-là.</p>}
          {!chargement && lignes.length > 0 && (
            <div>
              {lignes.map((ligne) => (
                <div key={ligne.cle}>
                  <LigneConducteur ligne={ligne} onSupprimer={supprimerElement} />
                  <PointInsertion onClick={() => setInsertion({ coupureId: ligne.apresTransmissionId })} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Synthèse</h2>
          <dl className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <dt>Date</dt>
              <dd>{formaterDateLongue(dateReference)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Lignes</dt>
              <dd>{synthese.nbLignes}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Programmes</dt>
              <dd>{synthese.nbProgrammes}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Éléments auto</dt>
              <dd>{synthese.nbElementsAuto}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Éléments manuels</dt>
              <dd>{synthese.nbElementsManuels}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Volume total</dt>
              <dd>{secondesEnHeureHMS(synthese.volumeTotalSecondes)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Écart maximal</dt>
              <dd>{Math.round(synthese.ecartMaximalSecondes / 60)} min</dd>
            </div>
          </dl>
        </div>
      </div>

      {insertion && planMediaLive && (
        <PanneauInsertionManuelle
          chaineActive={chaineActive}
          planMediaId={planMediaLive.id}
          dates={[dateReference]}
          diffusions={diffusionsDuJour}
          elementsSecondaires={elementsDuJour}
          campagnes={campagnes}
          spots={spots}
          programmesParId={programmesParId}
          dateInitiale={dateReference}
          coupureIdInitiale={insertion.coupureId}
          onFermer={() => setInsertion(null)}
          onElementCree={ajouterElementLocal}
        />
      )}
    </div>
  )
}
