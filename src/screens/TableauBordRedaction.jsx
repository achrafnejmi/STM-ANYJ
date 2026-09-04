import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { listerProgrammesParChaine, listerBibles } from '../lib/db.js'
import { calculerSuiviRedaction, pourcentage } from '../lib/suiviRedaction.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

// Tableau de bord rédaction (P39, rôle Rédacteur) : uniquement les KPI du
// périmètre synopsis (couverture bibles, avancement synopsis), pas les
// indicateurs généraux. Réutilise CarteIndicateur (comme PilotageDroitsStock).
export default function TableauBordRedaction({ chaineActive, onOuvrirSynopsis }) {
  const [programmes, setProgrammes] = useState([])
  const [bibles, setBibles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    setChargement(true)
    setErreur(null)
    Promise.all([listerProgrammesParChaine(chaineActive.id), listerBibles()])
      .then(([p, b]) => {
        setProgrammes(p)
        setBibles(b)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const { lignes, stats } = useMemo(() => calculerSuiviRedaction(programmes, bibles), [programmes, bibles])
  const aRediger = useMemo(
    () =>
      lignes
        .filter((l) => l.aRediger)
        .sort((a, b) => (a.programme.titre ?? '').localeCompare(b.programme.titre ?? ''))
        .slice(0, 10),
    [lignes]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tableau de bord rédaction — {chaineActive.nom}</h1>
        <p className="text-sm text-slate-500">Couverture des bibles et avancement des synopsis.</p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <Bloc couleur="bg-snrt-blue" titre="Bibles">
            <CarteIndicateur libelle="Programmes au catalogue" valeur={stats.total} ton="info" />
            <CarteIndicateur
              libelle="Bibles déposées"
              valeur={`${stats.avecBible} / ${stats.total}`}
              ton="favorable"
              sousTexte={`${pourcentage(stats.avecBible, stats.total)} % du catalogue`}
            />
            <CarteIndicateur
              libelle="Sans bible"
              valeur={stats.sansBible}
              ton={stats.sansBible > 0 ? 'vigilance' : 'favorable'}
              sousTexte={stats.sansBible > 0 ? 'PDF descriptif manquant' : 'catalogue complet'}
            />
          </Bloc>

          <Bloc couleur="bg-snrt-green" titre="Synopsis">
            <CarteIndicateur
              libelle="Synopsis rédigés"
              valeur={`${stats.traites} / ${stats.total}`}
              ton="favorable"
              sousTexte={`${pourcentage(stats.traites, stats.total)} % du catalogue`}
            />
            <CarteIndicateur
              libelle="À rédiger"
              valeur={stats.aRediger}
              ton={stats.aRediger > 0 ? 'vigilance' : 'favorable'}
              sousTexte="bible prête, synopsis manquant"
            />
            <CarteIndicateur libelle="FR seul" valeur={stats.frSeul} ton="neutre" />
            <CarteIndicateur libelle="AR seul" valeur={stats.arSeul} ton="neutre" />
            <CarteIndicateur
              libelle="Complets (FR + AR)"
              valeur={stats.complets}
              ton="favorable"
              sousTexte={`${pourcentage(stats.complets, stats.total)} % du catalogue`}
            />
          </Bloc>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-snrt-orange" />
              <h2 className="text-base font-semibold text-slate-900">
                À rédiger en priorité <span className="text-slate-400">({stats.aRediger})</span>
              </h2>
            </div>
            {aRediger.length === 0 ? (
              <p className="text-sm text-slate-500">Rien à rédiger — toutes les bibles déposées ont un synopsis.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {aRediger.map((l) => (
                  <li key={l.programme.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="min-w-0 truncate text-sm text-slate-700">
                      {l.programme.titre}
                      <span className="ml-2 text-xs text-slate-400">{l.programme.genre || '—'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOuvrirSynopsis?.(l.programme.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-snrt-navy hover:text-snrt-navy"
                    >
                      <FileText size={13} />
                      Rédiger
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Bloc({ couleur, titre, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-4 w-1 rounded-full ${couleur}`} />
        <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </div>
  )
}
