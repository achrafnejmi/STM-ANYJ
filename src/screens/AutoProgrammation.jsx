import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import {
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerDiffusionsLineairesParChaine,
  listerBlocsGrilleTypeParChaine,
  listerToutesLesFenetresDroits,
  creerDiffusionsLineaires,
  supprimerDiffusionsLineairesParRun,
  supprimerDiffusionsLineairesAutomatiquesParPeriode,
} from '../lib/db.js'
import { aujourdHuiISO, ajouterJours, lundiDeLaSemaine, joursDeLaSemaine, formaterPlageSemaine, formaterDateLongue } from '../lib/semaine.js'
import { genererOccurrencesAPourvoir, genererProposition } from '../lib/autoprog.js'
import ReservoirPanel from '../components/ReservoirPanel.jsx'
import PanneauApercuGeneration from '../components/PanneauApercuGeneration.jsx'
import PanneauRapportGeneration from '../components/PanneauRapportGeneration.jsx'

export default function AutoProgrammation({ chaineActive }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [blocsGrilleType, setBlocsGrilleType] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [respecterGenre, setRespecterGenre] = useState(true)
  const [ecraser, setEcraser] = useState(false)
  // Aperçu = proposition pas encore écrite ({ propositions, rapport, runId,
  // nbAutomatiquesRemplacees }). rapportEcrit = résultat réel après
  // confirmation ({ rapport, runId }) — les deux sont mutuellement exclusifs.
  const [proposition, setProposition] = useState(null)
  const [rapportEcrit, setRapportEcrit] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [annulation, setAnnulation] = useState(false)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setProposition(null)
    setRapportEcrit(null)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      listerDiffusionsLineairesParChaine(chaineActive.id),
      listerBlocsGrilleTypeParChaine(chaineActive.id),
      listerToutesLesFenetresDroits(),
    ])
      .then(([lignesProgrammes, lignesEpisodes, lignesDiffusions, lignesBlocs, lignesFenetres]) => {
        setProgrammes(lignesProgrammes)
        setEpisodes(lignesEpisodes)
        setDiffusions(lignesDiffusions)
        setBlocsGrilleType(lignesBlocs)
        setFenetresDroits(lignesFenetres)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const lundi = lundiDeLaSemaine(dateReference)
  const dates = useMemo(() => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]), [vue, lundi, dateReference])

  const episodesParProgramme = useMemo(() => {
    const map = new Map()
    for (const e of episodes) {
      if (!map.has(e.programme_id)) map.set(e.programme_id, [])
      map.get(e.programme_id).push(e)
    }
    return map
  }, [episodes])

  function naviguer(delta) {
    setDateReference((d) => ajouterJours(d, vue === 'SEMAINE' ? 7 * delta : delta))
  }

  // Aucune écriture ici — pure lecture + calcul (autoprog.js). L'écriture
  // n'a lieu qu'après confirmation explicite dans confirmer().
  function generer() {
    setErreur(null)
    const dateDebut = dates[0]
    const dateFin = dates[dates.length - 1]
    const { occurrences, diffusionsProtegees } = genererOccurrencesAPourvoir(dates, blocsGrilleType, diffusions, {
      ecraser,
      dateDebut,
      dateFin,
    })
    const runId = crypto.randomUUID()
    const resultat = genererProposition({
      dates,
      occurrences,
      diffusionsProtegees,
      programmes,
      episodesParProgramme,
      fenetresDroits,
      respecterGenre,
      runId,
      chaineActive,
    })
    const nbAutomatiquesRemplacees = diffusions.filter(
      (d) => ecraser && d.origine === 'AUTOMATIQUE' && d.date >= dateDebut && d.date <= dateFin
    ).length
    setRapportEcrit(null)
    setProposition({ ...resultat, runId, nbAutomatiquesRemplacees })
  }

  async function confirmer(retenues) {
    setEnregistrement(true)
    setErreur(null)
    try {
      let supprimees = []
      if (ecraser) {
        const dateDebut = dates[0]
        const dateFin = dates[dates.length - 1]
        supprimees = await supprimerDiffusionsLineairesAutomatiquesParPeriode(chaineActive.id, dateDebut, dateFin)
      }
      const creees = retenues.length > 0 ? await creerDiffusionsLineaires(retenues) : []
      const idsSupprimes = new Set(supprimees.map((d) => d.id))
      setDiffusions((prev) => [...prev.filter((d) => !idsSupprimes.has(d.id)), ...creees])
      setRapportEcrit({
        runId: proposition.runId,
        rapport: {
          placements: creees,
          nonPourvus: proposition.rapport.nonPourvus,
          echeancesProches: proposition.rapport.echeancesProches,
        },
      })
      setProposition(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // EXG-M4-02/RG-16 : retire en une seule opération tout ce que ce run a créé
  // — uniquement le run qui vient d'être écrit dans cette session.
  async function annulerGeneration() {
    if (!rapportEcrit) return
    setAnnulation(true)
    setErreur(null)
    try {
      const runId = rapportEcrit.runId
      await supprimerDiffusionsLineairesParRun(runId)
      setDiffusions((prev) => prev.filter((d) => d.run_id !== runId))
      setRapportEcrit(null)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setAnnulation(false)
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

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
          <label className="flex items-center gap-2" title="RG-01/RG-05, EXG-M4-04 : contrôle des droits non négociable, jamais désactivable">
            <input type="checkbox" checked disabled />
            Uniquement les contrats valides
          </label>
          <label className="flex items-center gap-2" title="Un titre appartient structurellement à une seule chaîne (chaine_id), cette règle ne peut jamais se déclencher">
            <input type="checkbox" checked disabled />
            Respecter l'exclusivité de chaîne
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={respecterGenre} onChange={(e) => setRespecterGenre(e.target.checked)} />
            Respecter le genre de la grille type
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ecraser} onChange={(e) => setEcraser(e.target.checked)} />
            Écraser la programmation existante
          </label>
          <button
            type="button"
            onClick={generer}
            disabled={chargement}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Play size={16} />
            Générer
          </button>
        </div>

        {ecraser && (
          <p className="mt-3 text-xs text-amber-700">
            Écraser ne recalcule que les anciennes générations automatiques — les diffusions saisies manuellement ne
            sont jamais modifiées ni supprimées.
          </p>
        )}
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      {!chargement && !proposition && (
        <ReservoirPanel chaineActive={chaineActive} programmes={programmes} episodesParProgramme={episodesParProgramme} fenetresDroits={fenetresDroits} />
      )}

      {proposition && (
        <PanneauApercuGeneration
          proposition={proposition}
          ecraser={ecraser}
          nbAutomatiquesRemplacees={proposition.nbAutomatiquesRemplacees}
          onConfirmer={confirmer}
          onAnnuler={() => setProposition(null)}
          enregistrement={enregistrement}
        />
      )}

      {rapportEcrit && (
        <PanneauRapportGeneration
          rapport={rapportEcrit.rapport}
          onFermer={() => setRapportEcrit(null)}
          onAnnulerGeneration={annulerGeneration}
          annulation={annulation}
        />
      )}
    </div>
  )
}
