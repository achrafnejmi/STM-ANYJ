import { useEffect, useState } from 'react'
import { connecter } from '../lib/session.js'
import { listerUtilisateurs } from '../lib/db.js'
import { libelleRole } from '../lib/roles.js'
import Marque from '../components/Marque.jsx'
import FondLogin from '../components/FondLogin.jsx'

export default function Login({ onConnexion }) {
  const [utilisateurs, setUtilisateurs] = useState([])
  const [choisi, setChoisi] = useState('')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    listerUtilisateurs()
      .then((lignes) => {
        setUtilisateurs(lignes)
        setChoisi(lignes[0]?.nom_utilisateur ?? '')
      })
      .catch(() => setUtilisateurs([]))
      .finally(() => setChargement(false))
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    // P38 : connexion réservée aux utilisateurs enregistrés (plus de saisie
    // libre ni de création implicite).
    if (!choisi) return
    try {
      connecter(choisi)
      onConnexion(choisi.trim())
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-snrt-navy px-6">
      <FondLogin />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white/95 p-8 shadow-2xl ring-1 ring-white/20 backdrop-blur-sm">
        <div className="mb-6">
          <Marque variante="login" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {chargement ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : utilisateurs.length > 0 ? (
            <div>
              <label htmlFor="utilisateur" className="mb-1 block text-sm font-medium text-slate-700">
                Utilisateur
              </label>
              <select
                id="utilisateur"
                value={choisi}
                onChange={(e) => setChoisi(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {utilisateurs.map((u) => (
                  <option key={u.nom_utilisateur} value={u.nom_utilisateur}>
                    {(u.nom_affiche ?? u.nom_utilisateur)} — {libelleRole(u.role)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Simulation de rôles pour la démo — pas de mot de passe.</p>
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Aucun utilisateur enregistré. Exécutez les migrations Supabase (jusqu'à
              <span className="font-mono"> migration-p38.sql</span>) pour amorcer les comptes de démonstration.
            </p>
          )}
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={chargement || !choisi}
            className="w-full rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
