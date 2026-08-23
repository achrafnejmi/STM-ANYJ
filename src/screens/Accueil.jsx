import { useEffect, useId, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import { FileSpreadsheet, FileText, File } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerToutesLesFenetresDroits,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleLiveParChaine,
  listerCampagnesParChaine,
  listerElementsSecondairesParChaine,
} from '../lib/db.js'
import { aujourdHuiISO, lundiDeLaSemaine, joursDeLaSemaine, formaterPlageSemaine } from '../lib/semaine.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { estProgrammable } from '../lib/droits.js'
import {
  calculerIndicateursTete,
  calculerRepartitionParGenre,
  calculerTitresFinsDeDroits,
  estProgrammeNonProgramme,
  formaterVolumeHeures,
} from '../lib/bilans.js'
import { calculerCouverture, resumerCouverture } from '../lib/couverture.js'
import { construireDonneesBilan, construireLignesExcelBilan, construireNomFichierBilan } from '../lib/exportBilan.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

const STATUTS = [
  { code: 'TOUS', label: 'Tous' },
  { code: 'HORS_DROITS', label: 'Hors droits' },
  { code: 'FINS_DE_DROITS', label: 'Fins de droits proches' },
  { code: 'NON_PROGRAMMES', label: 'Non programmés sur la période' },
]

// Variable CSS Tailwind v4 correspondant à une classe `bg-snrt-*` (couleursGenre.js)
// — style inline, pas une classe Tailwind construite dynamiquement (le scanner JIT
// n'indexerait pas une classe assemblée à l'exécution).
function couleurCss(classeFond) {
  return `var(${classeFond.replace(/^bg-/, '--color-')})`
}

const RAYON_DONUT = 15.9155 // circonférence ≈ 100 : les pourcentages s'appliquent directement au dasharray
const GAP_DONUT = 0.8 // % de circonférence laissé vide entre deux secteurs

// Camembert de répartition par genre (P21 Lot D) — anneau SVG, une piste par
// genre, technique stroke-dasharray (pas de calcul trigonométrique). Sert de
// vue proportionnelle complémentaire aux barres ; la liste de barres à côté fait
// office de légende commune (mêmes couleurs, mêmes noms de genre).
function Camembert({ repartition, volumeTotalMinutes }) {
  if (volumeTotalMinutes <= 0) {
    return (
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full">
          <circle cx="21" cy="21" r={RAYON_DONUT} fill="none" strokeWidth="6" className="stroke-slate-100" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-slate-400">
          Aucun volume disponible
        </div>
      </div>
    )
  }
  let cumul = 0
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
        <circle cx="21" cy="21" r={RAYON_DONUT} fill="none" strokeWidth="6" className="stroke-slate-100" />
        {repartition
          .filter((r) => r.volumeMinutes > 0)
          .map((r) => {
            const { fond } = couleurGenre(r.genre.fr)
            const pct = (r.volumeMinutes / volumeTotalMinutes) * 100
            const longueur = Math.max(0, pct - GAP_DONUT)
            const decalage = -cumul
            cumul += pct
            return (
              <circle
                key={r.genre.fr}
                cx="21"
                cy="21"
                r={RAYON_DONUT}
                fill="none"
                strokeWidth="6"
                strokeDasharray={`${longueur} ${100 - longueur}`}
                strokeDashoffset={decalage}
                style={{ stroke: couleurCss(fond) }}
              />
            )
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold text-slate-900">{formaterVolumeHeures(volumeTotalMinutes)}</span>
        <span className="text-[10px] text-slate-500">volume total</span>
      </div>
    </div>
  )
}

export default function Accueil({ chaineActive }) {
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [elementsSecondaires, setElementsSecondaires] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [filtreGenre, setFiltreGenre] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('TOUS')
  const idFiltreGenre = useId()
  const idFiltreStatut = useId()

  // P23 : « Non programmés sur la période » (M9) reflète l'antenne réelle —
  // seule la grille LIVE de la chaîne compte, pas les grilles parallèles.
  useEffect(() => {
    setChargement(true)
    setErreur(null)
    obtenirGrilleLiveParChaine(chaineActive.id)
      .then((grilleLive) =>
        Promise.all([
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes(),
          listerToutesLesFenetresDroits(),
          grilleLive ? listerDiffusionsLineairesParGrille(grilleLive.id) : Promise.resolve([]),
          listerCampagnesParChaine(chaineActive.id),
          listerElementsSecondairesParChaine(chaineActive.id),
        ])
      )
      .then(([lignesProgrammes, lignesEpisodes, lignesFenetres, lignesDiffusions, lignesCampagnes, lignesElements]) => {
        setProgrammes(lignesProgrammes)
        setEpisodes(lignesEpisodes)
        setFenetresDroits(lignesFenetres)
        setDiffusions(lignesDiffusions)
        setCampagnes(lignesCampagnes)
        setElementsSecondaires(lignesElements)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const dateReference = aujourdHuiISO()
  const lundi = lundiDeLaSemaine(dateReference)
  const joursSemaine = useMemo(() => joursDeLaSemaine(lundi), [lundi])

  const episodesParProgrammeId = useMemo(() => {
    const map = new Map()
    for (const ep of episodes) {
      if (!map.has(ep.programme_id)) map.set(ep.programme_id, [])
      map.get(ep.programme_id).push(ep)
    }
    return map
  }, [episodes])

  // EXG-M9-03 : « la période affichée » — cet écran n'a pas de sélecteur de
  // période propre (aucun dans la composition d'écran du cahier) ; la
  // semaine courante sert de référence par défaut.
  const diffusionsPeriode = useMemo(() => diffusions.filter((d) => joursSemaine.includes(d.date)), [diffusions, joursSemaine])

  const idsFinsDeDroits = useMemo(
    () => new Set(calculerTitresFinsDeDroits(programmes, episodesParProgrammeId, fenetresDroits, dateReference).map((f) => f.programmeId)),
    [programmes, episodesParProgrammeId, fenetresDroits, dateReference]
  )

  // Filtre statut seul (la répartition par genre reste la vue d'ensemble des
  // 9 genres — un filtre genre l'appliquerait à elle-même, peu utile).
  const programmesFiltresStatut = useMemo(() => {
    if (filtreStatut === 'TOUS') return programmes
    if (filtreStatut === 'HORS_DROITS') return programmes.filter((p) => !estProgrammable(p.id, fenetresDroits, dateReference).ok)
    if (filtreStatut === 'FINS_DE_DROITS') return programmes.filter((p) => idsFinsDeDroits.has(p.id))
    if (filtreStatut === 'NON_PROGRAMMES') return programmes.filter((p) => estProgrammeNonProgramme(p.id, diffusionsPeriode))
    return programmes
  }, [programmes, filtreStatut, fenetresDroits, dateReference, idsFinsDeDroits, diffusionsPeriode])
  // Filtre complet (genre + statut) — sert aux 4 indicateurs de tête.
  const programmesFiltres = useMemo(
    () => programmesFiltresStatut.filter((p) => !filtreGenre || p.genre === filtreGenre),
    [programmesFiltresStatut, filtreGenre]
  )

  const indicateurs = useMemo(
    () => calculerIndicateursTete(programmesFiltres, episodesParProgrammeId, fenetresDroits, dateReference),
    [programmesFiltres, episodesParProgrammeId, fenetresDroits, dateReference]
  )
  const repartition = useMemo(
    () => calculerRepartitionParGenre(programmesFiltresStatut, episodesParProgrammeId, fenetresDroits, dateReference),
    [programmesFiltresStatut, episodesParProgrammeId, fenetresDroits, dateReference]
  )
  const finsDeDroits = useMemo(
    () => calculerTitresFinsDeDroits(programmes, episodesParProgrammeId, fenetresDroits, dateReference),
    [programmes, episodesParProgrammeId, fenetresDroits, dateReference]
  )
  const volumeMaxGenre = Math.max(1, ...repartition.map((r) => r.volumeMinutes))
  const volumeTotalRepartition = useMemo(() => repartition.reduce((acc, r) => acc + r.volumeMinutes, 0), [repartition])
  const graduationsAxe = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(volumeMaxGenre * f))

  // Bonus (hors périmètre littéral du cahier M9) : couverture plan média,
  // peu coûteuse et toujours fraîche — pas le compteur d'anomalies (valeur
  // figée hors Grille linéaire, écartée).
  const couvertureMap = useMemo(() => calculerCouverture(campagnes, elementsSecondaires), [campagnes, elementsSecondaires])
  const couvertureResume = useMemo(() => resumerCouverture(couvertureMap), [couvertureMap])

  function donneesExport() {
    return construireDonneesBilan({ chaineNom: chaineActive.nom, dateReference, filtreGenre, filtreStatut, indicateurs, repartition, finsDeDroits })
  }

  function exporterExcel() {
    try {
      const donnees = donneesExport()
      const feuille = XLSX.utils.aoa_to_sheet(construireLignesExcelBilan(donnees))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Bilan')
      XLSX.writeFile(classeur, construireNomFichierBilan(chaineActive.nom, dateReference, 'xlsx'))
    } catch (err) {
      setErreur(`Échec de l'export Excel : ${err.message}`)
    }
  }

  function exporterPdf() {
    try {
      const donnees = donneesExport()
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(donnees.titre, 14, 16)
      doc.setFontSize(9)
      doc.text(donnees.filtresLabel, 14, 22)
      autoTable(doc, { startY: 28, head: [['Indicateur', 'Valeur']], body: donnees.indicateurs.map((i) => [i.libelle, i.valeur]) })
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Genre (FR/AR)', 'Volume', 'Épisodes prêts', 'Titres']],
        body: donnees.repartition.map((r) => [r.genre, r.volume, r.nbEpisodesPrets, r.nbTitres]),
      })
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [['Titre', 'Échéance', 'Épisodes prêts', 'Passages restants']],
        body: donnees.finsDeDroits.map((f) => [f.titre, f.dateFin, f.nbEpisodesPrets, f.passagesRestants]),
      })
      doc.save(construireNomFichierBilan(chaineActive.nom, dateReference, 'pdf'))
    } catch (err) {
      setErreur(`Échec de l'export PDF : ${err.message}`)
    }
  }

  async function exporterWord() {
    try {
      const donnees = donneesExport()
      const ligneEntete = (libelles) =>
        new TableRow({ children: libelles.map((l) => new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: l, bold: true })] })] })) })
      const ligne = (valeurs) =>
        new TableRow({ children: valeurs.map((v) => new TableCell({ children: [new Paragraph(String(v))] })) })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: donnees.titre, heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: donnees.filtresLabel }),
              new Paragraph({ text: 'Indicateurs', heading: HeadingLevel.HEADING_2 }),
              new Table({ rows: [ligneEntete(['Indicateur', 'Valeur']), ...donnees.indicateurs.map((i) => ligne([i.libelle, i.valeur]))] }),
              new Paragraph({ text: 'Répartition par genre', heading: HeadingLevel.HEADING_2 }),
              new Table({
                rows: [
                  ligneEntete(['Genre (FR/AR)', 'Volume', 'Épisodes prêts', 'Titres']),
                  ...donnees.repartition.map((r) => ligne([r.genre, r.volume, r.nbEpisodesPrets, r.nbTitres])),
                ],
              }),
              new Paragraph({ text: 'À consommer avant expiration', heading: HeadingLevel.HEADING_2 }),
              new Table({
                rows: [
                  ligneEntete(['Titre', 'Échéance', 'Épisodes prêts', 'Passages restants']),
                  ...donnees.finsDeDroits.map((f) => ligne([f.titre, f.dateFin, f.nbEpisodesPrets, f.passagesRestants])),
                ],
              }),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = construireNomFichierBilan(chaineActive.nom, dateReference, 'docx')
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErreur(`Échec de l'export Word : ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Stock et bilans — {chaineActive.nom}</h1>
            <p className="text-sm text-slate-500">Semaine du {formaterPlageSemaine(lundi)} (période de référence pour « non programmés »)</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exporterExcel} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50">
              <FileSpreadsheet size={15} />
              Excel
            </button>
            <button type="button" onClick={exporterWord} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50">
              <FileText size={15} />
              Word
            </button>
            <button type="button" onClick={exporterPdf} className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
              <File size={15} />
              PDF
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
          <div>
            <label htmlFor={idFiltreGenre} className="mb-1 block text-sm font-medium text-slate-700">Genre</label>
            <select id={idFiltreGenre} value={filtreGenre} onChange={(e) => setFiltreGenre(e.target.value)} className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">-- Tous --</option>
              {GENRES.map((g) => (
                <option key={g.fr} value={g.fr}>{g.fr} / {g.ar}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={idFiltreStatut} className="mb-1 block text-sm font-medium text-slate-700">Statut</label>
            <select id={idFiltreStatut} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm">
              {STATUTS.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CarteIndicateur libelle="Volume disponible" valeur={formaterVolumeHeures(indicateurs.volumeMinutes)} />
            <CarteIndicateur libelle="Titres retenus par les filtres" valeur={indicateurs.nbTitresRetenus} />
            <CarteIndicateur libelle="Fins de droits (< 45 j)" valeur={indicateurs.nbTitresFinsDeDroits} />
            <CarteIndicateur libelle="Titres hors droits" valeur={indicateurs.nbTitresHorsDroits} />
          </div>

          {couvertureResume.nbCampagnes > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">Couverture plan média (campagnes actives)</div>
              <div className="mt-1 text-sm text-slate-700">
                {couvertureResume.nbCampagnes} campagne(s) · taux moyen de couverture : <span className="font-semibold">{couvertureResume.tauxMoyenPct}%</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Répartition par genre (stock disponible)</h2>
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="mx-auto lg:mx-0">
                <Camembert repartition={repartition} volumeTotalMinutes={volumeTotalRepartition} />
              </div>
              <div className="flex-1">
                <div className="space-y-3">
                  {repartition.map((r) => {
                    const { fond } = couleurGenre(r.genre.fr)
                    const pct = Math.round((r.volumeMinutes / volumeMaxGenre) * 100)
                    return (
                      <div key={r.genre.fr}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{r.genre.fr} / {r.genre.ar}</span>
                          <span>{formaterVolumeHeures(r.volumeMinutes)} · {r.nbEpisodesPrets} ép. prêts · {r.nbTitres} titres</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100">
                          <div className={`h-2.5 rounded-full ${fond}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  {graduationsAxe.map((g, i) => (
                    <span key={i}>{formaterVolumeHeures(g)}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">À consommer avant expiration</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4 font-medium">Titre</th>
                    <th className="py-2 pr-4 font-medium">Échéance</th>
                    <th className="py-2 pr-4 font-medium">Épisodes prêts</th>
                    <th className="py-2 pr-4 font-medium">Passages restants</th>
                  </tr>
                </thead>
                <tbody>
                  {finsDeDroits.map((f) => (
                    <tr key={f.programmeId} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-700">{f.titre}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.dateFin}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.nbEpisodesPrets}</td>
                      <td className="py-2 pr-4 text-slate-700">{f.passagesRestants}</td>
                    </tr>
                  ))}
                  {finsDeDroits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-sm text-slate-500">Aucun titre en fin de droits proche.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
