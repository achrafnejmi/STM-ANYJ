// Administration (§6.2, P19a) : nomenclatures communes éditables sans
// intervention technique. Genres et Tranches d'antenne sont migrées en base
// (table `genre`/`tranche_antenne`) — les autres nomenclatures du cahier
// restent codées en dur, pour des raisons structurelles listées ci-dessous
// (transparence plutôt qu'une fonctionnalité manquante cachée).
import { useEffect, useState } from 'react'
import { listerGenres, listerTranchesAntenne } from '../lib/db.js'
import { chargerGenres } from '../lib/genres.js'
import { chargerTranches } from '../lib/tranches.js'
import TableauGenres from '../components/TableauGenres.jsx'
import TableauTranches from '../components/TableauTranches.jsx'

const NOMENCLATURES_NON_MIGREES = [
  {
    nom: 'Types de bloc (grille type)',
    raison:
      "contrainte d'intégrité en base (CHECK) et correspondance couleur exacte (couleursType.js) à maintenir manuellement pour toute nouvelle valeur — un type ajouté depuis l'UI resterait gris tant que le code n'est pas mis à jour.",
  },
  {
    nom: 'Vecteurs (TNT / Satellite)',
    raison: "mécanisme structurel binaire (scission/fusion, RG-10 à RG-14), pas une liste ouverte à laquelle ajouter une ligne.",
  },
  {
    nom: "Types d'éléments secondaires",
    raison:
      "contrainte CHECK dupliquée sur 2 tables et chaînes comparées en dur dans le moteur de génération (planMedia.js) — un renommage ou une suppression depuis l'UI casserait silencieusement le moteur.",
  },
]

export default function Administration() {
  const [genres, setGenres] = useState([])
  const [tranches, setTranches] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    rafraichir()
  }, [])

  async function rafraichir() {
    setChargement(true)
    setErreur(null)
    try {
      const [lignesGenres, lignesTranches] = await Promise.all([listerGenres(), listerTranchesAntenne()])
      setGenres(lignesGenres)
      setTranches(lignesTranches)
      // Resynchronise les caches utilisés partout ailleurs (GENRES/TRANCHES,
      // genres.js/tranches.js) sur l'état qui vient d'être enregistré.
      await Promise.all([chargerGenres(), chargerTranches()])
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  if (chargement) return <p className="text-sm text-slate-500">Chargement…</p>

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500">Nomenclatures communes, éditables sans intervention technique (cahier §6.2).</p>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <TableauGenres genres={genres} onRafraichir={rafraichir} />
      <TableauTranches tranches={tranches} onRafraichir={rafraichir} />

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Nomenclatures non administrables (par conception)</h2>
        <ul className="space-y-1.5 text-sm text-slate-600">
          {NOMENCLATURES_NON_MIGREES.map((n) => (
            <li key={n.nom}>
              <span className="font-medium text-slate-700">{n.nom}</span> — {n.raison}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
