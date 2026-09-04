import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { listerProgrammesParChaine, listerBibles } from '../lib/db.js'
import { calculerSuiviRedaction, traiteEnLangue, aRedigerEnLangue } from '../lib/suiviRedaction.js'

// Les filtres « À rédiger » / « Traités » tiennent compte de la langue du rôle
// (P40) — `langue` nulle ⇒ statut combiné.
function filtres(langue) {
  return [
    { code: 'TOUS', label: 'Tous', test: () => true },
    { code: 'AVEC_BIBLE', label: 'Avec bible', test: (l) => l.bibleDeposee },
    { code: 'SANS_BIBLE', label: 'Sans bible', test: (l) => !l.bibleDeposee },
    { code: 'A_REDIGER', label: 'À rédiger', test: (l) => aRedigerEnLangue(l, langue) },
    { code: 'TRAITES', label: 'Traités', test: (l) => traiteEnLangue(l, langue) },
  ]
}

function Pastille({ actif, children }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        actif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {children}
    </span>
  )
}

// Tableau « Bibles & synopsis » (P39, rôle Rédacteur) : vue d'ensemble de tous
// les programmes de la chaîne avec l'état bible / OCR / synopsis, et un raccourci
// pour aller rédiger.
export default function BiblesSynopsis({ chaineActive, onOuvrirSynopsis, langue }) {
  const [programmes, setProgrammes] = useState([])
  const [bibles, setBibles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtre, setFiltre] = useState('TOUS')

  const FILTRES = useMemo(() => filtres(langue), [langue])
  const titreLangue = langue === 'AR' ? ' (arabe)' : langue === 'FR' ? ' (français)' : ''

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

  const { lignes } = useMemo(() => calculerSuiviRedaction(programmes, bibles), [programmes, bibles])
  const lignesTriees = useMemo(
    () => [...lignes].sort((a, b) => (a.programme.titre ?? '').localeCompare(b.programme.titre ?? '')),
    [lignes]
  )
  const testFiltre = FILTRES.find((f) => f.code === filtre)?.test ?? (() => true)
  const lignesFiltrees = lignesTriees.filter(testFiltre)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Bibles &amp; synopsis{titreLangue} — {chaineActive.nom}
        </h1>
        <p className="text-sm text-slate-500">
          État de la bible et du synopsis pour chaque programme du catalogue.
        </p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {FILTRES.map((f) => {
              const n = lignesTriees.filter(f.test).length
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => setFiltre(f.code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    filtre === f.code
                      ? 'bg-snrt-navy text-white'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label} ({n})
                </button>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Titre</th>
                  <th className="py-2 pr-4 font-medium">Genre</th>
                  <th className="py-2 pr-4 font-medium">Bible</th>
                  <th className="py-2 pr-4 font-medium">OCR</th>
                  <th className="py-2 pr-4 font-medium">Synopsis</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {lignesFiltrees.map((l) => (
                  <tr key={l.programme.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-700">{l.programme.titre}</td>
                    <td className="py-2 pr-4 text-slate-500">{l.programme.genre || '—'}</td>
                    <td className="py-2 pr-4">
                      <Pastille actif={l.bibleDeposee}>{l.bibleDeposee ? 'Déposée' : '—'}</Pastille>
                    </td>
                    <td className="py-2 pr-4">
                      <Pastille actif={l.ocrAnalyse}>{l.ocrAnalyse ? 'Analysé' : '—'}</Pastille>
                    </td>
                    <td className="py-2 pr-4">
                      {langue === 'FR' ? (
                        <Pastille actif={l.synopsisFr}>{l.synopsisFr ? 'Rédigé' : '—'}</Pastille>
                      ) : langue === 'AR' ? (
                        <Pastille actif={l.synopsisAr}>{l.synopsisAr ? 'Rédigé' : '—'}</Pastille>
                      ) : l.synopsisFr || l.synopsisAr ? (
                        <span className="flex gap-1">
                          <Pastille actif={l.synopsisFr}>FR</Pastille>
                          <Pastille actif={l.synopsisAr}>AR</Pastille>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOuvrirSynopsis?.(l.programme.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-snrt-navy hover:text-snrt-navy"
                      >
                        <FileText size={13} />
                        Rédiger
                      </button>
                    </td>
                  </tr>
                ))}
                {lignesFiltrees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-sm text-slate-500">
                      Aucun programme pour ce filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
