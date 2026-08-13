import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { listerProgrammesParChaine, listerToutesLesFenetresDroits } from '../lib/db.js'
import { estProgrammable, fenetresProchesDeLaFermeture } from '../lib/droits.js'
import { aujourdHuiISO } from '../lib/semaine.js'

// Fenêtre la plus pertinente à afficher pour un titre : celle qui couvre
// aujourd'hui si elle existe, sinon la plus récente (date de fin la plus
// tardive) — juste pour donner un ordre de grandeur des passages dans le
// tableau, la vraie logique de contrôle reste dans droits.js.
function fenetrePertinente(fenetres, aujourdHui) {
  const active = fenetres.find((f) => aujourdHui >= f.date_debut && aujourdHui <= f.date_fin)
  if (active) return active
  return [...fenetres].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null
}

export default function Contrats({ chaineActive }) {
  const [programmes, setProgrammes] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Contrats & droits — {chaineActive.nom}</h2>
        <p className="text-sm text-slate-500">
          Tableau de bord des droits de diffusion par titre. La saisie des contrats reste dans le module
          Acquisitions (hors périmètre STM Next, cahier §1.5.2) — gérez les fenêtres de droits depuis la fiche du
          titre, dans l'écran Programmes.
        </p>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {chargement ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : programmes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun programme sur cette chaîne.</p>
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
              {programmes.map((p) => {
                const fenetresDuTitre = fenetresDroits.filter((f) => f.programme_id === p.id)
                const droits = estProgrammable(p.id, fenetresDroits, aujourdHui)
                const alerte = droits.ok && fenetresProchesDeLaFermeture(fenetresDuTitre, aujourdHui).length > 0
                const fenetre = fenetrePertinente(fenetresDuTitre, aujourdHui)

                let Icone = ShieldCheck
                let classeTexte = 'text-emerald-600'
                let libelle = 'OK'
                if (!droits.ok) {
                  Icone = ShieldX
                  classeTexte = 'text-red-600'
                  libelle = droits.motif
                } else if (alerte) {
                  Icone = ShieldAlert
                  classeTexte = 'text-amber-600'
                  libelle = 'Ferme bientôt / peu de passages'
                } else if (fenetresDuTitre.length === 0) {
                  libelle = 'Sans restriction (aucune fenêtre)'
                  classeTexte = 'text-slate-500'
                }

                return (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{p.titre}</td>
                    <td className="py-2 pr-4 text-slate-600">{p.genre || '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">{p.reference_contrat || '—'}</td>
                    <td className={`py-2 pr-4 ${classeTexte}`}>
                      <span className="flex items-center gap-1.5">
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
