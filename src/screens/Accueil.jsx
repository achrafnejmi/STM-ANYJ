import { useEffect, useId, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } from 'docx'
import BoutonExporter from '../components/BoutonExporter.jsx'
import {
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerToutesLesFenetresDroits,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleLiveParChaine,
  listerElementsSecondairesParPlanMedia,
  obtenirPlanMediaLiveParChaine,
  listerPublicationsReseauParChaine,
  listerPublicationsVodParChaine,
} from '../lib/db.js'
import { aujourdHuiISO, lundiDeLaSemaine, joursDeLaSemaine, formaterPlageSemaine } from '../lib/semaine.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { couleurPlateforme } from '../lib/couleursPlateforme.js'
import { estProgrammable } from '../lib/droits.js'
import {
  calculerIndicateursTete,
  calculerIndicateursApprofondis,
  calculerStatsNonLineaire,
  calculerRepartitionParGenre,
  calculerTitresFinsDeDroits,
  estProgrammeNonProgramme,
  formaterVolumeHeures,
} from '../lib/bilans.js'
import { construireDonneesBilan, construireLignesExcelBilan, construireNomFichierBilan } from '../lib/exportBilan.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

const STATUTS = [
  { code: 'TOUS', label: 'Tous' },
  { code: 'HORS_DROITS', label: 'Hors droits' },
  { code: 'FINS_DE_DROITS', label: 'Fins de droits proches' },
  { code: 'NON_PROGRAMMES', label: 'Non programmés sur la période' },
]

// Réseaux sociaux : chaque plateforme garde SA couleur de marque
// (couleursPlateforme.js, tokens index.css). Nom d'affichage à part.
const LIBELLE_PLATEFORME = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  YOUTUBE: 'YouTube',
}
// Cycle de publication : palette SNRT uniquement (vert = publié, bleu =
// programmé, orange = brouillon, rouge = annulé).
const STATUTS_NL = [
  { code: 'PUBLIE', label: 'Publié', couleur: 'bg-snrt-green' },
  { code: 'PROGRAMME', label: 'Programmé', couleur: 'bg-snrt-blue' },
  { code: 'BROUILLON', label: 'Brouillon', couleur: 'bg-snrt-orange' },
  { code: 'ANNULE', label: 'Annulé', couleur: 'bg-snrt-red' },
]

// Métrique d'un bloc secondaire : libellé + grande valeur, jauge optionnelle
// (ratio 0–100, couleur SNRT) et une précision en légende. Plus lisible qu'une
// simple ligne de texte, sans revenir à une grosse carte par indicateur.
function Metrique({ libelle, valeur, precision, jauge, tonJauge = 'bg-snrt-blue' }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{libelle}</span>
        <span className="text-base font-semibold tabular-nums text-slate-900">{valeur}</span>
      </div>
      {jauge != null && (
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div className={`h-1.5 rounded-full ${tonJauge}`} style={{ width: `${Math.min(100, Math.max(2, jauge))}%` }} />
        </div>
      )}
      {precision && <div className="mt-1 text-xs text-slate-400">{precision}</div>}
    </div>
  )
}

// Une barre empilée du cycle de publication (brouillon → programmé → publié →
// annulé) pour un canal — la légende est mutualisée au niveau du panneau.
function BarreCycle({ bilan }) {
  const total = bilan.total || 1
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
      {STATUTS_NL.map((s) => {
        const nb = bilan.parStatut[s.code] ?? 0
        if (nb === 0) return null
        return <div key={s.code} className={s.couleur} style={{ width: `${(nb / total) * 100}%` }} title={`${s.label} : ${nb}`} />
      })}
    </div>
  )
}

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
  const [elementsSecondaires, setElementsSecondaires] = useState([])
  const [publicationsReseau, setPublicationsReseau] = useState([])
  const [publicationsVod, setPublicationsVod] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [filtreGenre, setFiltreGenre] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('TOUS')
  const idFiltreGenre = useId()
  const idFiltreStatut = useId()

  // P23 : « Non programmés sur la période » (M9) reflète l'antenne réelle —
  // seule la grille LIVE de la chaîne compte, pas les grilles parallèles.
  // P24 : idem pour les éléments plan média — seul le document LIVE compte.
  useEffect(() => {
    setChargement(true)
    setErreur(null)
    Promise.all([obtenirGrilleLiveParChaine(chaineActive.id), obtenirPlanMediaLiveParChaine(chaineActive.id)])
      .then(([grilleLive, planMediaLive]) =>
        Promise.all([
          listerProgrammesParChaine(chaineActive.id),
          listerTousLesEpisodes(),
          listerToutesLesFenetresDroits(),
          grilleLive ? listerDiffusionsLineairesParGrille(grilleLive.id) : Promise.resolve([]),
          planMediaLive ? listerElementsSecondairesParPlanMedia(planMediaLive.id) : Promise.resolve([]),
          listerPublicationsReseauParChaine(chaineActive.id),
          listerPublicationsVodParChaine(chaineActive.id),
        ])
      )
      .then(([lignesProgrammes, lignesEpisodes, lignesFenetres, lignesDiffusions, lignesElements, lignesReseau, lignesVod]) => {
        setProgrammes(lignesProgrammes)
        setEpisodes(lignesEpisodes)
        setFenetresDroits(lignesFenetres)
        setDiffusions(lignesDiffusions)
        setElementsSecondaires(lignesElements)
        setPublicationsReseau(lignesReseau)
        setPublicationsVod(lignesVod)
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
  const approfondis = useMemo(
    () =>
      calculerIndicateursApprofondis({
        programmes,
        programmesFiltres,
        episodesParProgrammeId,
        fenetresDroits,
        diffusionsPeriode,
        elementsSecondaires,
        dateReference,
      }),
    [programmes, programmesFiltres, episodesParProgrammeId, fenetresDroits, diffusionsPeriode, elementsSecondaires, dateReference]
  )
  const statsNonLineaire = useMemo(
    () => calculerStatsNonLineaire(publicationsReseau, publicationsVod, joursSemaine),
    [publicationsReseau, publicationsVod, joursSemaine]
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
            <BoutonExporter onExcel={exporterExcel} onWord={exporterWord} onPdf={exporterPdf} />
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
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-orange" />
              <h2 className="text-sm font-semibold text-slate-900">Stock &amp; droits</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <CarteIndicateur
                libelle="Volume disponible"
                valeur={formaterVolumeHeures(indicateurs.volumeMinutes)}
                ton="favorable"
                sousTexte={`${approfondis.nbEpisodesPrets} épisode${approfondis.nbEpisodesPrets > 1 ? 's' : ''} prêt${approfondis.nbEpisodesPrets > 1 ? 's' : ''}`}
              />
              <CarteIndicateur
                libelle="Titres retenus par les filtres"
                valeur={indicateurs.nbTitresRetenus}
                ton="info"
                sousTexte={`sur ${approfondis.nbTitresTotal} au catalogue`}
              />
              {/* Cartes de risque : le liseré marque la NATURE du risque
                  (orange = échéances, rouge = hors droits), pas l'état courant —
                  la valeur et le sous-texte disent si c'est effectivement un
                  problème. */}
              <CarteIndicateur
                libelle="Fins de droits (< 45 j)"
                valeur={indicateurs.nbTitresFinsDeDroits}
                ton="vigilance"
                sousTexte={
                  indicateurs.nbTitresFinsDeDroits > 0 && approfondis.joursAvantEcheance != null
                    ? `prochaine échéance dans ${approfondis.joursAvantEcheance} j`
                    : 'aucune échéance proche'
                }
              />
              <CarteIndicateur
                libelle="Titres hors droits"
                valeur={indicateurs.nbTitresHorsDroits}
                ton="alerte"
                sousTexte={indicateurs.nbTitresHorsDroits > 0 ? 'à régulariser' : 'tout le catalogue est couvert'}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-snrt-cyan" />
                <h2 className="text-sm font-semibold text-slate-900">Antenne — semaine du {formaterPlageSemaine(lundi)}</h2>
              </div>
              <Metrique
                libelle="Rotation du catalogue"
                valeur={`${approfondis.tauxRotation} %`}
                jauge={approfondis.tauxRotation}
                tonJauge="bg-snrt-cyan"
                precision={`${approfondis.nbTitresAntenne}/${approfondis.nbTitresTotal} titres à l'antenne`}
              />
              <Metrique
                libelle="Titres dormants"
                valeur={approfondis.nbTitresDormants}
                precision="jamais programmés sur la période"
              />
              <Metrique
                libelle="Passages programmés"
                valeur={approfondis.nbPassagesSemaine}
                precision={`${formaterVolumeHeures(approfondis.chargeAntenneMinutes)} d'antenne cumulées`}
              />
              <Metrique
                libelle="Maturité PAD"
                valeur={`${approfondis.tauxPad} %`}
                jauge={approfondis.tauxPad}
                tonJauge={
                  approfondis.tauxPad >= 80 ? 'bg-snrt-green' : approfondis.tauxPad >= 50 ? 'bg-snrt-orange' : 'bg-snrt-red'
                }
                precision={`${approfondis.nbEpisodesPrets}/${approfondis.nbEpisodesTotal} épisodes prêts`}
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-snrt-blue" />
                <h2 className="text-sm font-semibold text-slate-900">Droits &amp; plan média</h2>
              </div>
              <Metrique
                libelle="Passages restants (droits)"
                valeur={approfondis.passagesRestantsCumul.toLocaleString('fr-FR')}
                precision={
                  approfondis.nbFenetresIllimitees > 0
                    ? `+ ${approfondis.nbFenetresIllimitees} fenêtre(s) à passages illimités`
                    : 'cumul de toutes les fenêtres de droits'
                }
              />
              <Metrique
                libelle="Éléments plan média (live)"
                valeur={elementsSecondaires.length}
                precision={`${formaterVolumeHeures(approfondis.volumeSecondaireMinutes)} de contenu secondaire placé`}
              />
              <Metrique
                libelle="Bandes-annonces"
                valeur={approfondis.parTypeSecondaire.BANDE_ANNONCE ?? 0}
                precision="dans le plan média live"
              />
              <Metrique
                libelle="Écrans publicitaires"
                valeur={approfondis.parTypeSecondaire.ECRAN_PUBLICITAIRE ?? 0}
                precision={`${approfondis.parTypeSecondaire.HABILLAGE ?? 0} habillage(s) d'inter-programme`}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-navy" />
              <h2 className="text-base font-semibold text-slate-900">Non-linéaire</h2>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-baseline justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Réseaux sociaux</h3>
                  <span className="text-xs text-slate-400">
                    {statsNonLineaire.reseau.total} publication{statsNonLineaire.reseau.total > 1 ? 's' : ''} · {statsNonLineaire.reseau.tauxPublie} % publié
                  </span>
                </div>
                {statsNonLineaire.reseau.total === 0 ? (
                  <p className="text-sm text-slate-500">Aucune publication réseaux sociaux.</p>
                ) : (
                  <div className="space-y-2.5">
                    {statsNonLineaire.reseau.parPlateforme.map(({ plateforme, nb }) => {
                      const pct = Math.round((nb / statsNonLineaire.reseau.total) * 100)
                      return (
                        <div key={plateforme}>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>{LIBELLE_PLATEFORME[plateforme] ?? plateforme}</span>
                            <span className="tabular-nums text-slate-400">{nb} · {pct}%</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100">
                            <div
                              className={`h-2.5 rounded-full ${couleurPlateforme(plateforme).fond}`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-baseline justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-700">VOD — Forja</h3>
                  <span className="text-xs text-slate-400">
                    {statsNonLineaire.vod.total} mise{statsNonLineaire.vod.total > 1 ? 's' : ''} en ligne · {statsNonLineaire.vod.tauxPublie} % publié
                  </span>
                </div>
                {statsNonLineaire.vod.total === 0 ? (
                  <p className="text-sm text-slate-500">Aucune mise en ligne VOD.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { v: statsNonLineaire.vod.total, l: 'Total' },
                      { v: statsNonLineaire.vod.publieesPeriode, l: 'Publié cette semaine' },
                      { v: statsNonLineaire.vod.enPreparation, l: 'En préparation' },
                    ].map((c) => (
                      <div key={c.l} className="rounded-md bg-slate-50 p-3">
                        <div className="text-lg font-semibold text-slate-900">{c.v}</div>
                        <div className="text-xs text-slate-500">{c.l}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {statsNonLineaire.reseau.total + statsNonLineaire.vod.total > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h3 className="text-sm font-semibold text-slate-700">Cycle de publication</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {STATUTS_NL.map((s) => (
                      <span key={s.code} className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${s.couleur}`} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { l: 'Réseaux sociaux', b: statsNonLineaire.reseau },
                    { l: 'VOD — Forja', b: statsNonLineaire.vod },
                  ].map(({ l, b }) => (
                    <div key={l} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3">
                      <span className="text-xs text-slate-500">{l}</span>
                      {b.total > 0 ? <BarreCycle bilan={b} /> : <div className="h-2.5 rounded-full bg-slate-100" />}
                      <span className="text-right text-xs tabular-nums text-slate-400">{b.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-green" />
              <h2 className="text-base font-semibold text-slate-900">Répartition par genre (stock disponible)</h2>
            </div>
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
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-red" />
              <h2 className="text-base font-semibold text-slate-900">À consommer avant expiration</h2>
            </div>
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
