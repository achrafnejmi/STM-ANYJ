// Administration (§6.2, P19a) : nomenclatures communes éditables sans
// intervention technique. Genres et Tranches d'antenne sont migrées en base
// (table `genre`/`tranche_antenne`) — les autres nomenclatures du cahier
// restent codées en dur, pour des raisons structurelles listées ci-dessous
// (transparence plutôt qu'une fonctionnalité manquante cachée).
import { useEffect, useState } from 'react'
import { listerGenres, listerTranchesAntenne, listerUtilisateurs, listerChaines } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { chargerGenres } from '../lib/genres.js'
import { chargerTranches } from '../lib/tranches.js'
import { chargerChaines } from '../lib/chaines.js'
import TableauGenres from '../components/TableauGenres.jsx'
import TableauTranches from '../components/TableauTranches.jsx'
import TableauUtilisateurs from '../components/TableauUtilisateurs.jsx'
import TableauChaines from '../components/TableauChaines.jsx'

const NOMENCLATURES_NON_MIGREES = [
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

export default function Administration({ roleUtilisateur }) {
  const [genres, setGenres] = useState([])
  const [tranches, setTranches] = useState([])
  const [chaines, setChaines] = useState([])
  const [utilisateurs, setUtilisateurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  // P35 : la gestion des utilisateurs & rôles est réservée au Super
  // Administrateur (l'Administrateur de chaîne voit le reste d'Administration).
  const estSuperAdmin = roleUtilisateur === 'SUPER_ADMIN'

  useEffect(() => {
    rafraichir()
  }, [])

  // Chargée sans condition sur `estAdmin` (permis par les RLS de toute façon,
  // coût négligeable) — seul l'AFFICHAGE de la section est gardé par le rôle,
  // ce qui évite toute dépendance sur l'ordre d'arrivée du rôle (chargé de
  // façon async par App.jsx après la connexion, potentiellement après le
  // premier rendu de cet écran).
  async function rafraichir() {
    setChargement(true)
    setErreur(null)
    try {
      const [lignesGenres, lignesTranches, lignesChaines, lignesUtilisateurs] = await Promise.all([
        listerGenres(),
        listerTranchesAntenne(),
        listerChaines(),
        listerUtilisateurs(),
      ])
      setGenres(lignesGenres)
      setTranches(lignesTranches)
      setChaines(lignesChaines)
      setUtilisateurs(lignesUtilisateurs)
      // Resynchronise les caches utilisés partout ailleurs (GENRES/TRANCHES/
      // CHAINES, genres.js/tranches.js/chaines.js) sur l'état qui vient
      // d'être enregistré.
      await Promise.all([chargerGenres(), chargerTranches(), chargerChaines()])
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
      <TableauChaines chaines={chaines} onRafraichir={rafraichir} />

      {estSuperAdmin && (
        <TableauUtilisateurs utilisateurs={utilisateurs} utilisateurActif={lireUtilisateur()} onRafraichir={rafraichir} />
      )}

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
