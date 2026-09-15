// Dashboard d'audit (P43 partie B) — « Respect de la grille type ».
// Rôle AUDIT (Taoufik, Ilyas). Par chaîne, sur la grille LIVE : KPI cliquables
// + tableau permanent des violations les plus récentes (P43b, toujours
// visible, exportable, lien vers la grille) + tableau dépliable par KPI pour
// filtrer un sous-ensemble précis (juste les overrides, juste hors-bloc).
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { ShieldCheck, Download, CalendarDays, ChevronDown } from 'lucide-react'
import {
  obtenirGrilleLiveParChaine,
  listerDiffusionsLineairesParGrille,
  obtenirGrilleTypeLiveParChaine,
  listerBlocsGrilleTypeParGrilleType,
  listerProgrammesParChaine,
} from '../lib/db.js'
import { analyserConformiteGrilleType } from '../lib/conformiteGrilleType.js'
import { formaterJourCourt, formaterDateLongue, aujourdHuiISO } from '../lib/semaine.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { lireUtilisateur } from '../lib/session.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

const TAILLE_PAGE = 30

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

export default function DashboardAudit({ chaineActive, onOuvrirProgramme, onOuvrirGrille }) {
  const [diffusions, setDiffusions] = useState([])
  const [blocsGrilleType, setBlocsGrilleType] = useState([])
  const [grilleType, setGrilleType] = useState(null)
  const [programmes, setProgrammes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  // KPI dont le tableau est déplié : 'tout' | 'ecarts' | 'horsBloc' | 'overrides' | null
  const [kpiActif, setKpiActif] = useState(null)
  // Tableau permanent des violations les plus récentes : combien de lignes
  // affichées, révélées par 30 au défilement (pas de re-fetch, tout est déjà
  // en mémoire — juste la fenêtre de rendu qui s'agrandit).
  const [nbAffichees, setNbAffichees] = useState(TAILLE_PAGE)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    setKpiActif(null)
    setNbAffichees(TAILLE_PAGE)
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

  // Tableau permanent (P43b) : écarts + hors bloc combinés, DU PLUS RÉCENT AU
  // PLUS ANCIEN (analyserConformiteGrilleType trie l'inverse pour les besoins
  // du calcul — tri dédié ici, rien retouché côté fonction pure).
  const violationsRecentes = useMemo(() => {
    const combinees = [
      ...analyse.lignesEcartGenre.map((l) => ({ ...l, horsBloc: false })),
      ...analyse.lignesHorsBloc.map((l) => ({ ...l, horsBloc: true, genreAttendu: null, blocNom: null })),
    ]
    return combinees.sort((a, b) => b.date.localeCompare(a.date) || b.heure.localeCompare(a.heure))
  }, [analyse])

  const violationsAffichees = violationsRecentes.slice(0, nbAffichees)
  const resteAAfficher = violationsRecentes.length > nbAffichees

  // Défilement dans le tableau : révèle 30 lignes de plus en approchant du bas
  // (pas de bouton « Charger plus » — tout est déjà en mémoire).
  function gererScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (resteAAfficher && scrollHeight - scrollTop - clientHeight < 150) {
      setNbAffichees((n) => Math.min(n + TAILLE_PAGE, violationsRecentes.length))
    }
  }

  function exporterViolations() {
    const lignes = violationsRecentes.map((l) => [
      formaterDateLongue(l.date),
      (l.heure ?? '').slice(0, 5),
      l.titre,
      l.genre ?? '—',
      l.genreAttendu ?? '—',
      l.horsBloc ? 'Hors grille type' : (l.blocNom ?? '—'),
      l.overrideAssume ? 'Oui' : 'Non',
    ])
    const feuille = XLSX.utils.aoa_to_sheet([
      [`Violations de la grille type — ${chaineActive.nom}`],
      [`Édité le ${formaterDateLongue(aujourdHuiISO())} par ${lireUtilisateur() ?? '—'}`],
      [],
      ['Date', 'Heure', 'Programme', 'Genre programmé', 'Genre attendu', 'Bloc', 'Override assumé'],
      ...lignes,
    ])
    const classeur = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(classeur, feuille, 'Violations')
    XLSX.writeFile(classeur, `violations-grille-type_${chaineActive.nom}_${aujourdHuiISO()}.xlsx`)
  }

  // Rien à évaluer (aucune diffusion dans un bloc avec un genre).
  const rienAEvaluer = analyse.nbEvaluees === 0

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
              ton="favorable"
              fort
              onClick={() => basculer('tout')}
              actif={kpiActif === 'tout'}
              description="Diffusions dont le genre correspond au bloc de grille type actif à leur heure de début."
            />
            <CarteIndicateur
              libelle="Écarts de genre"
              valeur={analyse.nbEcartsGenre}
              sousTexte="genre ≠ genre attendu du bloc"
              ton="alerte"
              fort
              onClick={() => basculer('ecarts')}
              actif={kpiActif === 'ecarts'}
              description="Programmé dans un bloc de grille type, mais d'un autre genre que celui attendu."
            />
            <CarteIndicateur
              libelle="Hors grille type"
              valeur={analyse.nbHorsBloc}
              sousTexte="aucun bloc à ce créneau"
              ton="vigilance"
              fort
              onClick={() => basculer('horsBloc')}
              actif={kpiActif === 'horsBloc'}
              description="Diffusion avec un genre mais programmée hors de tout bloc de grille type."
            />
            <CarteIndicateur
              libelle="Overrides assumés"
              valeur={analyse.nbOverridesAssumes}
              sousTexte="« programmer quand même » confirmé"
              ton="info"
              fort
              onClick={() => basculer('overrides')}
              actif={kpiActif === 'overrides'}
              description="Écarts que l'utilisateur a explicitement confirmés au moment du geste."
            />
          </div>

          {/* Tableau permanent (P43b) : les programmations hors grille type les
              plus récentes, toujours visibles — sans clic sur une carte KPI.
              30 lignes à la fois, 30 de plus au défilement ; export ; lien
              direct vers la grille pour chaque ligne. */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Programmations hors grille type — les plus récentes</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {violationsRecentes.length} programmation{violationsRecentes.length > 1 ? 's' : ''} au total (écarts de
                  genre + hors bloc), triées de la plus récente à la plus ancienne.
                </p>
              </div>
              <button
                type="button"
                onClick={exporterViolations}
                disabled={violationsRecentes.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-snrt-navy hover:bg-snrt-navy/5 hover:text-snrt-navy disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-600"
              >
                <Download size={14} />
                Exporter
              </button>
            </div>

            {violationsRecentes.length === 0 ? (
              <p className="text-sm text-slate-500">Rien à signaler : aucune programmation hors grille type actuellement.</p>
            ) : (
              <>
                <div
                  onScroll={gererScroll}
                  className="max-h-[32rem] overflow-y-auto rounded-md border border-slate-200"
                >
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[0_1px_0_0] shadow-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Heure</th>
                        <th className="px-3 py-2 font-medium">Programme</th>
                        <th className="px-3 py-2 font-medium">Genre programmé</th>
                        <th className="px-3 py-2 font-medium">Genre attendu</th>
                        <th className="px-3 py-2 font-medium">Bloc</th>
                        <th className="px-3 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {violationsAffichees.map((l) => (
                        <tr
                          key={l.id}
                          onClick={() => onOuvrirProgramme?.(l.programmeId)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formaterJourCourt(l.date)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">{(l.heure ?? '').slice(0, 5)}</td>
                          <td className="px-3 py-2 text-slate-800">{l.titre}</td>
                          <td className="px-3 py-2">
                            <PastilleGenre genre={l.genre} />
                          </td>
                          <td className="px-3 py-2">
                            {l.horsBloc ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                                hors grille type
                              </span>
                            ) : (
                              <PastilleGenre genre={l.genreAttendu} />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {l.horsBloc ? '—' : (l.blocNom ?? '—')}
                            {l.overrideAssume && (
                              <span className="ml-1.5 rounded-full bg-snrt-blue/10 px-2 py-0.5 text-[11px] font-medium text-snrt-blue">
                                override assumé
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {onOuvrirGrille && (
                              <button
                                type="button"
                                title="Consulter la grille"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOuvrirGrille(l.date, l.id)
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-snrt-navy hover:bg-snrt-navy/5 hover:text-snrt-navy"
                              >
                                <CalendarDays size={12} />
                                Grille
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {resteAAfficher && (
                        <tr>
                          <td colSpan={7} className="px-3 py-2 text-center text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <ChevronDown size={12} className="animate-bounce" />
                              Faites défiler pour voir la suite
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {violationsAffichees.length} / {violationsRecentes.length} affichées · cliquer une ligne ouvre la fiche du
                  programme.
                </p>
              </>
            )}
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
