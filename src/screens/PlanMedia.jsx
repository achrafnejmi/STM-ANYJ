import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, Library, PlusSquare, FileSpreadsheet } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerDiffusionsLineairesParChaine,
  listerCampagnesParChaine,
  listerElementsSecondairesParChaine,
  listerSpotsBibliotheque,
  creerElementsSecondaires,
  supprimerElementsSecondairesParRun,
  supprimerElementsSecondairesAutomatiquesParPeriode,
} from '../lib/db.js'
import { aujourdHuiISO, ajouterJours, lundiDeLaSemaine, joursDeLaSemaine, formaterPlageSemaine, formaterDateLongue } from '../lib/semaine.js'
import { calculerIntervalles, genererElementsSecondaires, DUREE_ECRAN_DEFAUT_SECONDES } from '../lib/planMedia.js'
import { calculerCouverture } from '../lib/couverture.js'
import { construireLignesPlanMedia, construireNomFichierPlanMedia, TITRE_FEUILLE_PLAN_MEDIA, ENTETE_PLAN_MEDIA } from '../lib/exportPlanMedia.js'
import { TRANCHES } from '../lib/tranches.js'
import TableauCampagnes from '../components/TableauCampagnes.jsx'
import PanneauReglesHabillage from '../components/PanneauReglesHabillage.jsx'
import PanneauApercuPlanMedia from '../components/PanneauApercuPlanMedia.jsx'
import PanneauCouvertureCampagnes from '../components/PanneauCouvertureCampagnes.jsx'
import BibliothequeSpots from '../components/BibliothequeSpots.jsx'
import PanneauInsertionManuelle from '../components/PanneauInsertionManuelle.jsx'

const OPTS_DEFAUT = {
  habillageActif: true,
  ecranPubActif: true,
  bandesAnnoncesActives: true,
  dureeEcranSecondes: DUREE_ECRAN_DEFAUT_SECONDES,
  tranchesCommercialisees: TRANCHES.map((t) => t.code),
}

export default function PlanMedia({ chaineActive }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [programmes, setProgrammes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [elementsSecondaires, setElementsSecondaires] = useState([])
  const [spots, setSpots] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [opts, setOpts] = useState(OPTS_DEFAUT)
  const [proposition, setProposition] = useState(null)
  const [rapportEcrit, setRapportEcrit] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [annulation, setAnnulation] = useState(false)
  const [bibliothequeOuverte, setBibliothequeOuverte] = useState(false)
  const [insertionOuverte, setInsertionOuverte] = useState(false)

  async function chargerTout() {
    setChargement(true)
    setErreur(null)
    try {
      const [lignesProgrammes, lignesDiffusions, lignesCampagnes, lignesElements, lignesSpots] = await Promise.all([
        listerProgrammesParChaine(chaineActive.id),
        listerDiffusionsLineairesParChaine(chaineActive.id),
        listerCampagnesParChaine(chaineActive.id),
        listerElementsSecondairesParChaine(chaineActive.id),
        listerSpotsBibliotheque(chaineActive.id),
      ])
      setProgrammes(lignesProgrammes)
      setDiffusions(lignesDiffusions)
      setCampagnes(lignesCampagnes)
      setElementsSecondaires(lignesElements)
      setSpots(lignesSpots)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    setProposition(null)
    setRapportEcrit(null)
    chargerTout()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne
  }, [chaineActive])

  const lundi = lundiDeLaSemaine(dateReference)
  const dates = useMemo(() => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]), [vue, lundi, dateReference])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const campagnesParId = useMemo(() => new Map(campagnes.map((c) => [c.id, c])), [campagnes])
  const couverture = useMemo(() => calculerCouverture(campagnes, elementsSecondaires), [campagnes, elementsSecondaires])

  function naviguer(delta) {
    setDateReference((d) => ajouterJours(d, vue === 'SEMAINE' ? 7 * delta : delta))
  }

  // Aucune écriture ici — pure lecture + calcul (planMedia.js). L'écriture
  // n'a lieu qu'après confirmation explicite dans confirmer().
  function generer() {
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
      elementsExistants: elementsSecondaires,
      opts,
      runId,
      chaineActive,
    })
    const nbAutomatiquesRemplaces = elementsSecondaires.filter(
      (e) => e.origine === 'AUTOMATIQUE' && e.date >= dateDebut && e.date <= dateFin
    ).length
    setRapportEcrit(null)
    setProposition({ ...resultat, runId, nbAutomatiquesRemplaces })
  }

  // RG-M5-06 : inconditionnel, pas de case « Écraser » — chaque confirmation
  // recalcule systématiquement les éléments AUTOMATIQUE de la période, ne
  // touche jamais les MANUELLE.
  async function confirmer(retenues) {
    setEnregistrement(true)
    setErreur(null)
    try {
      const dateDebut = dates[0]
      const dateFin = dates[dates.length - 1]
      const supprimes = await supprimerElementsSecondairesAutomatiquesParPeriode(chaineActive.id, dateDebut, dateFin)
      const creees = retenues.length > 0 ? await creerElementsSecondaires(retenues) : []
      const idsSupprimes = new Set(supprimes.map((e) => e.id))
      setElementsSecondaires((prev) => [...prev.filter((e) => !idsSupprimes.has(e.id)), ...creees])
      setRapportEcrit({ causesNonCouvertes: proposition.rapport.causesNonCouvertes, runId: proposition.runId })
      setProposition(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // EXG-M5-02/RG-16 : retire en une seule opération tout ce que ce run a créé.
  async function annulerGeneration() {
    if (!rapportEcrit) return
    setAnnulation(true)
    setErreur(null)
    try {
      const runId = rapportEcrit.runId
      await supprimerElementsSecondairesParRun(runId)
      setElementsSecondaires((prev) => prev.filter((e) => e.run_id !== runId))
      setRapportEcrit(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setAnnulation(false)
    }
  }

  function ajouterElementLocal(nouveau) {
    setElementsSecondaires((prev) => [...prev, nouveau])
  }

  // Export Plan média (P16b) — remplace le fichier PM réel : feuille "PM",
  // titre "Plan Média Autopromotion", H.FIN/DUREE en cellules numériques
  // (fraction de journée, format hh:mm:ss) pour un rendu identique au
  // fichier d'origine à l'ouverture dans Excel/LibreOffice.
  function exporterPlanMedia() {
    try {
      const { lignes, cellulesHeure } = construireLignesPlanMedia(dates, diffusions, elementsSecondaires, programmesParId, campagnesParId)
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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
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

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setBibliothequeOuverte(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Library size={15} />
            Bibliothèque de spots
          </button>
          <button
            type="button"
            onClick={() => setInsertionOuverte(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <PlusSquare size={15} />
            Insertion manuelle
          </button>
          <button
            type="button"
            onClick={exporterPlanMedia}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet size={15} />
            Exporter (Excel)
          </button>
        </div>

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

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
              onConfirmer={confirmer}
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

      {bibliothequeOuverte && (
        <BibliothequeSpots spots={spots} onFermer={() => setBibliothequeOuverte(false)} onRafraichir={chargerTout} />
      )}

      {insertionOuverte && (
        <PanneauInsertionManuelle
          chaineActive={chaineActive}
          dates={dates}
          diffusions={diffusions}
          elementsSecondaires={elementsSecondaires}
          campagnes={campagnes}
          spots={spots}
          programmesParId={programmesParId}
          onFermer={() => setInsertionOuverte(false)}
          onElementCree={ajouterElementLocal}
        />
      )}
    </div>
  )
}
