import { useState } from 'react'
import { connecter } from '../lib/session.js'
import Marque from '../components/Marque.jsx'
import FondLogin from '../components/FondLogin.jsx'

export default function Login({ onConnexion }) {
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    try {
      connecter(nom)
      onConnexion(nom.trim())
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
          <div>
            <label htmlFor="nom" className="mb-1 block text-sm font-medium text-slate-700">
              Nom d'utilisateur
            </label>
            <input
              id="nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex. i.elalaoui"
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}
