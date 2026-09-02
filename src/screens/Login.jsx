import { useEffect, useState } from 'react'
import { connecter } from '../lib/session.js'
import { listerUtilisateurs } from '../lib/db.js'
import { libelleRole } from '../lib/roles.js'
import Marque from '../components/Marque.jsx'
import FondLogin from '../components/FondLogin.jsx'

export default function Login({ onConnexion }) {
  const [utilisateurs, setUtilisateurs] = useState([])
  const [choisi, setChoisi] = useState('')
  const [nomLibre, setNomLibre] = useState('')
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
    const identifiant = utilisateurs.length > 0 ? choisi : nomLibre
    try {
      connecter(identifiant)
      onConnexion(identifiant.trim())
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
          {utilisateurs.length > 0 ? (
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
            <div>
              <label htmlFor="nom" className="mb-1 block text-sm font-medium text-slate-700">
                Nom d'utilisateur
              </label>
              <input
                id="nom"
                type="text"
                value={nomLibre}
                onChange={(e) => setNomLibre(e.target.value)}
                placeholder="ex. i.elalaoui"
                autoFocus
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={chargement}
            className="w-full rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
