import { useEffect, useId, useMemo, useState } from 'react'
import { Search, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { listerProgrammesParChaine, listerToutesLesFenetresDroits } from '../lib/db.js'
import { estProgrammable, fenetresProchesDeLaFermeture } from '../lib/droits.js'
import { aujourdHuiISO } from '../lib/semaine.js'
import CarteIndicateur from '../components/CarteIndicateur.jsx'

const STATUTS = [
  { code: 'TOUS', label: 'Tous' },
  { code: 'OK', label: 'Droits ouverts' },
  { code: 'ALERTE', label: 'Alerte (ferme bientôt)' },
  { code: 'HORS_DROITS', label: 'Hors droits' },
  { code: 'SANS_RESTRICTION', label: 'Sans restriction' },
]

// Info-bulle (title=) par catégorie — explique précisément le critère derrière
// chaque statut, sur les badges du tableau ET les cartes indicateurs.
const DESCRIPTIONS_STATUT = {
  OK: "Droits ouverts aujourd'hui : une fenêtre de droits couvre la date du jour avec des passages disponibles.",
  ALERTE: 'Droits ouverts, mais fenêtre proche de la fermeture ou peu de passages restants — à surveiller.',
  HORS_DROITS: 'Aucune fenêtre de droits valide aujourd\'hui (expirée, épuisée, ou hors période) — non programmable.',
  SANS_RESTRICTION:
    'Aucune fenêtre de droits définie pour ce titre — programmable par défaut, sans restriction (RG-03).',
}

// Fenêtre la plus pertinente à afficher pour un titre : celle qui couvre
// aujourd'hui si elle existe, sinon la plus récente (date de fin la plus
// tardive) — juste pour donner un ordre de grandeur des passages dans le
// tableau, la vraie logique de contrôle reste dans droits.js.
function fenetrePertinente(fenetres, aujourdHui) {
  const active = fenetres.find((f) => aujourdHui >= f.date_debut && aujourdHui <= f.date_fin)
  if (active) return active
  return [...fenetres].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null
}

// Classification à 4 catégories d'un titre (OK / alerte / hors droits / sans
// restriction) — source unique pour les cartes indicateurs ET le tableau.
function classifierDroits(programme, fenetresDroits, aujourdHui) {
  const fenetresDuTitre = fenetresDroits.filter((f) => f.programme_id === programme.id)
  const droits = estProgrammable(programme.id, fenetresDroits, aujourdHui)
  const alerte = droits.ok && fenetresProchesDeLaFermeture(fenetresDuTitre, aujourdHui).length > 0
  const fenetre = fenetrePertinente(fenetresDuTitre, aujourdHui)

  if (!droits.ok) {
    return { categorie: 'HORS_DROITS', Icone: ShieldX, classeTexte: 'text-red-600', libelle: droits.motif, fenetre }
  }
  if (alerte) {
    return {
      categorie: 'ALERTE',
      Icone: ShieldAlert,
      classeTexte: 'text-amber-600',
      libelle: 'Ferme bientôt / peu de passages',
      fenetre,
    }
  }
  if (fenetresDuTitre.length === 0) {
    return {
      categorie: 'SANS_RESTRICTION',
      Icone: ShieldCheck,
      classeTexte: 'text-slate-500',
      libelle: 'Sans restriction (aucune fenêtre)',
      fenetre,
    }
  }
  return { categorie: 'OK', Icone: ShieldCheck, classeTexte: 'text-emerald-600', libelle: 'Droits ouverts', fenetre }
}

export default function Contrats({ chaineActive, onOuvrirProgramme }) {
  const [programmes, setProgrammes] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('TOUS')
  const idRecherche = useId()
  const idFiltreStatut = useId()

  useEffect(() => {
    setChargement(true)
    Promise.all([listerProgrammesParChaine(chaineActive.id), listerToutesLesFenetresDroits()])
      .then(([lignesProgrammes, lignesFenetres]) => {
        setProgrammes(lignesProgrammes)
        setFenetresDroits(lignesFenetres)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const aujourdHui = aujourdHuiISO()

  const classificationParId = useMemo(() => {
    const map = new Map()
    for (const p of programmes) map.set(p.id, classifierDroits(p, fenetresDroits, aujourdHui))
    return map
  }, [programmes, fenetresDroits, aujourdHui])

  const compteurs = useMemo(() => {
    const c = { OK: 0, ALERTE: 0, HORS_DROITS: 0, SANS_RESTRICTION: 0 }
    for (const classification of classificationParId.values()) c[classification.categorie] += 1
    return c
  }, [classificationParId])

  const programmesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return programmes.filter((p) => {
      if (filtreStatut !== 'TOUS' && classificationParId.get(p.id)?.categorie !== filtreStatut) return false
      if (q && !p.titre.toLowerCase().includes(q) && !(p.reference_contrat ?? '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [programmes, recherche, filtreStatut, classificationParId])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Contrats & droits — {chaineActive.nom}</h2>
        <p className="text-sm text-slate-500">
          Tableau de bord des droits de diffusion par titre. La saisie des contrats reste dans le module
          Acquisitions (hors périmètre STM Next, cahier §1.5.2) — gérez les fenêtres de droits depuis la fiche du
          titre, dans l'écran Programmes.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
          <div>
            <label htmlFor={idRecherche} className="mb-1 block text-sm font-medium text-slate-700">
              Recherche
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={idRecherche}
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Titre ou référence contrat…"
                className="w-64 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor={idFiltreStatut} className="mb-1 block text-sm font-medium text-slate-700">
              Statut
            </label>
            <select
              id={idFiltreStatut}
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUTS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      {!chargement && programmes.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CarteIndicateur libelle="Droits ouverts" valeur={compteurs.OK} description={DESCRIPTIONS_STATUT.OK} />
          <CarteIndicateur libelle="En alerte" valeur={compteurs.ALERTE} description={DESCRIPTIONS_STATUT.ALERTE} />
          <CarteIndicateur
            libelle="Hors droits"
            valeur={compteurs.HORS_DROITS}
            description={DESCRIPTIONS_STATUT.HORS_DROITS}
          />
          <CarteIndicateur
            libelle="Sans restriction"
            valeur={compteurs.SANS_RESTRICTION}
            description={DESCRIPTIONS_STATUT.SANS_RESTRICTION}
          />
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {chargement ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : programmes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun programme sur cette chaîne.</p>
        ) : programmesFiltres.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun titre ne correspond aux filtres.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">Genre</th>
                <th className="py-2 pr-4 font-medium">Référence contrat</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Passages</th>
              </tr>
            </thead>
            <tbody>
              {programmesFiltres.map((p) => {
                const { categorie, Icone, classeTexte, libelle, fenetre } = classificationParId.get(p.id)
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOuvrirProgramme(p.id, 'DROITS')}
                    title="Ouvrir la fiche — onglet Droits (contrat, fenêtres de droits)"
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-800">{p.titre}</td>
                    <td className="py-2 pr-4 text-slate-600">{p.genre || '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">{p.reference_contrat || '—'}</td>
                    <td className={`py-2 pr-4 ${classeTexte}`}>
                      <span className="flex items-center gap-1.5" title={DESCRIPTIONS_STATUT[categorie]}>
                        <Icone size={15} />
                        {libelle}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {fenetre ? `${fenetre.passages_consommes}/${fenetre.passages_autorises}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
