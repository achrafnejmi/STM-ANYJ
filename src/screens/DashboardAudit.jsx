// Dashboard d'audit (P43 partie B) — « Respect de la grille type ».
// Rôle AUDIT (Taoufik). Par chaîne, sur la grille LIVE : KPI cliquables +
// tableau dépliable des diffusions programmées hors du genre prévu.
import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  obtenirGrilleLiveParChaine,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleTypeLiveParChaine,
  listerBlocsGrilleTypeParGrilleType,
  listerProgrammesParChaine,
} from '../lib/db.js'
import { analyserConformiteGrilleType } from '../lib/conformiteGrilleType.js'
import { formaterJourCourt } from '../lib/semaine.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

// Colonnes du tableau dépliable selon le KPI ouvert.
const COLONNES = {
  ecarts: ['Date', 'Heure', 'Titre', 'Genre programmé', 'Genre attendu', 'Bloc', ''],
  horsBloc: ['Date', 'Heure', 'Titre', 'Genre programmé'],
}

function PastilleGenre({ genre }) {
  if (!genre) return <span className="text-slate-400">—</span>
  const { fond, texte } = couleurGenre(genre)
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${fond} ${texte}`}>{genre}</span>
}

export default function DashboardAudit({ chaineActive, onOuvrirProgramme }) {
  const [diffusions, setDiffusions] = useState([])
  const [blocsGrilleType, setBlocsGrilleType] = useState([])
  const [grilleType, setGrilleType] = useState(null)
  const [programmes, setProgrammes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  // KPI dont le tableau est déplié : 'tout' | 'ecarts' | 'horsBloc' | 'overrides' | null
  const [kpiActif, setKpiActif] = useState(null)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setKpiActif(null)
    Promise.all([obtenirGrilleLiveParChaine(chaineActive.id), obtenirGrilleTypeLiveParChaine(chaineActive.id)])
      .then(([grilleLive, grilleTypeLive]) =>
        Promise.all([
          grilleLive ? listerDiffusionsLineairesParGrille(grilleLive.id) : Promise.resolve([]),
          grilleTypeLive ? listerBlocsGrilleTypeParGrilleType(grilleTypeLive.id) : Promise.resolve([]),
          listerProgrammesParChaine(chaineActive.id),
        ]).then(([lignesDiffusions, lignesBlocs, lignesProgrammes]) => {
          setDiffusions(lignesDiffusions)
          setBlocsGrilleType(lignesBlocs)
          setGrilleType(grilleTypeLive)
          setProgrammes(lignesProgrammes)
        })
      )
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const analyse = useMemo(
    () => analyserConformiteGrilleType({ diffusions, blocsGrilleType, programmesParId }),
    [diffusions, blocsGrilleType, programmesParId]
  )

  function basculer(kpi) {
    setKpiActif((actuel) => (actuel === kpi ? null : kpi))
  }

  // Lignes affichées dans le tableau dépliable selon le KPI ouvert.
  const { titreTableau, colonnes, lignes, mode } = useMemo(() => {
    if (kpiActif === 'ecarts')
      return { titreTableau: 'Écarts de genre', colonnes: COLONNES.ecarts, lignes: analyse.lignesEcartGenre, mode: 'ecarts' }
    if (kpiActif === 'overrides')
      return {
        titreTableau: 'Écarts confirmés « programmer quand même »',
        colonnes: COLONNES.ecarts,
        lignes: analyse.lignesEcartGenre.filter((l) => l.overrideAssume),
        mode: 'ecarts',
      }
    if (kpiActif === 'horsBloc')
      return { titreTableau: 'Hors grille type', colonnes: COLONNES.horsBloc, lignes: analyse.lignesHorsBloc, mode: 'horsBloc' }
    if (kpiActif === 'tout')
      return {
        titreTableau: 'Toutes les diffusions évaluées (écarts + hors bloc)',
        colonnes: COLONNES.ecarts,
        lignes: [...analyse.lignesEcartGenre, ...analyse.lignesHorsBloc.map((l) => ({ ...l, genreAttendu: '—', blocNom: '— (hors bloc)' }))],
        mode: 'ecarts',
      }
    return { titreTableau: null, colonnes: [], lignes: [], mode: null }
  }, [kpiActif, analyse])

  // Rien à évaluer (aucune diffusion dans un bloc avec un genre) → pas un écart,
  // la carte reste verte.
  const rienAEvaluer = analyse.nbEvaluees === 0
  const tonTaux = rienAEvaluer || analyse.tauxConformite >= 90 ? 'favorable' : analyse.tauxConformite >= 70 ? 'vigilance' : 'alerte'

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-snrt-navy" />
          <h1 className="text-lg font-semibold text-slate-900">Respect de la grille type — {chaineActive.nom}</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {grilleType
            ? `Grille type LIVE : « ${grilleType.nom} » · ${analyse.nbTotal} diffusion${analyse.nbTotal > 1 ? 's' : ''} sur la grille LIVE`
            : 'Aucune grille type LIVE définie pour cette chaîne — rien à contrôler.'}
        </p>
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
      </div>

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <CarteIndicateur
              libelle="Taux de conformité"
              valeur={rienAEvaluer ? '—' : `${analyse.tauxConformite} %`}
              sousTexte={
                rienAEvaluer ? 'aucune diffusion à évaluer' : `${analyse.nbConformes} conformes / ${analyse.nbEvaluees} évaluées`
              }
              ton={tonTaux}
              onClick={() => basculer('tout')}
              actif={kpiActif === 'tout'}
              description="Diffusions dont le genre correspond au bloc de grille type actif à leur heure de début."
            />
            <CarteIndicateur
              libelle="Écarts de genre"
              valeur={analyse.nbEcartsGenre}
              sousTexte="genre ≠ genre attendu du bloc"
              ton="alerte"
              onClick={() => basculer('ecarts')}
              actif={kpiActif === 'ecarts'}
              description="Programmé dans un bloc de grille type, mais d'un autre genre que celui attendu."
            />
            <CarteIndicateur
              libelle="Hors grille type"
              valeur={analyse.nbHorsBloc}
              sousTexte="aucun bloc à ce créneau"
              ton="vigilance"
              onClick={() => basculer('horsBloc')}
              actif={kpiActif === 'horsBloc'}
              description="Diffusion avec un genre mais programmée hors de tout bloc de grille type."
            />
            <CarteIndicateur
              libelle="Overrides assumés"
              valeur={analyse.nbOverridesAssumes}
              sousTexte="« programmer quand même » confirmé"
              ton="info"
              onClick={() => basculer('overrides')}
              actif={kpiActif === 'overrides'}
              description="Écarts que l'utilisateur a explicitement confirmés au moment du geste."
            />
          </div>

          {kpiActif && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  {titreTableau} — {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
                </h2>
                <button type="button" onClick={() => setKpiActif(null)} className="text-xs text-slate-500 hover:text-slate-700">
                  Fermer
                </button>
              </div>
              {lignes.length === 0 ? (
                <p className="text-sm text-slate-500">Rien à signaler.</p>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {colonnes.map((c, i) => (
                          <th key={i} className="px-3 py-2 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l) => (
                        <tr
                          key={l.id}
                          onClick={() => onOuvrirProgramme?.(l.programmeId)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-slate-600">{formaterJourCourt(l.date)}</td>
                          <td className="px-3 py-2 text-slate-600">{(l.heure ?? '').slice(0, 5)}</td>
                          <td className="px-3 py-2 text-slate-800">{l.titre}</td>
                          <td className="px-3 py-2">
                            <PastilleGenre genre={l.genre} />
                          </td>
                          {mode === 'ecarts' && (
                            <>
                              <td className="px-3 py-2">
                                <PastilleGenre genre={l.genreAttendu} />
                              </td>
                              <td className="px-3 py-2 text-slate-600">{l.blocNom}</td>
                              <td className="px-3 py-2">
                                {l.overrideAssume && (
                                  <span className="rounded-full bg-snrt-blue/10 px-2 py-0.5 text-xs font-medium text-snrt-blue">
                                    override assumé
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-400">Cliquer une ligne ouvre la fiche du programme.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
