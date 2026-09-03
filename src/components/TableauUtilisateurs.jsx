// Administration — Utilisateurs & rôles (P30, étendu P35 : 8 rôles, nom
// affiché distinct de l'identifiant, chaîne d'affectation, création).
// Édition en brouillon : les champs se modifient librement, rien n'est écrit
// tant que l'utilisateur ne clique pas « Enregistrer » sur la ligne (un seul
// appel, un seul toast). Création et suppression restent des actions directes.
import { useState } from 'react'
import { Trash2, Save, Undo2 } from 'lucide-react'
import { creerUtilisateur, mettreAJourUtilisateur, supprimerUtilisateur } from '../lib/db.js'
import { ROLES } from '../lib/roles.js'
import { CHAINES } from '../lib/chaines.js'
import { useNotification } from './NotificationProvider.jsx'

export default function TableauUtilisateurs({ utilisateurs, utilisateurActif, onRafraichir }) {
  const [nouveau, setNouveau] = useState({ nom_utilisateur: '', nom_affiche: '', role: 'PROGRAMMATEUR', chaine_id: '' })
  const [erreur, setErreur] = useState(null)
  // Brouillons par identifiant : { [nom]: { nom_affiche?, role?, chaine_id? } }
  // ne contient que les champs touchés.
  const [brouillons, setBrouillons] = useState({})
  const notifier = useNotification()

  function original(u, champ) {
    if (champ === 'chaine_id') return u.chaine_id ?? ''
    return u[champ] ?? ''
  }

  function valeur(u, champ) {
    const b = brouillons[u.nom_utilisateur]
    return b && champ in b ? b[champ] : original(u, champ)
  }

  function setChamp(u, champ, val) {
    setBrouillons((prev) => ({
      ...prev,
      [u.nom_utilisateur]: { ...prev[u.nom_utilisateur], [champ]: val },
    }))
  }

  function estModifie(u) {
    const b = brouillons[u.nom_utilisateur]
    if (!b) return false
    return Object.entries(b).some(([champ, val]) => String(val ?? '') !== String(original(u, champ)))
  }

  function oublierBrouillon(nom) {
    setBrouillons((prev) => {
      const copie = { ...prev }
      delete copie[nom]
      return copie
    })
  }

  async function enregistrer(u) {
    const b = brouillons[u.nom_utilisateur]
    if (!b) return
    const champs = {}
    if ('nom_affiche' in b) champs.nom_affiche = b.nom_affiche.trim() || null
    if ('role' in b) champs.role = b.role
    if ('chaine_id' in b) champs.chaine_id = b.chaine_id || null
    try {
      await mettreAJourUtilisateur(u.nom_utilisateur, champs)
      notifier.succes(`Modifications de « ${u.nom_utilisateur} » enregistrées.`)
      oublierBrouillon(u.nom_utilisateur)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    }
  }

  async function ajouter(e) {
    e.preventDefault()
    const identifiant = nouveau.nom_utilisateur.trim().replace(/\s+/g, '.')
    if (!identifiant) return
    try {
      await creerUtilisateur({
        nom_utilisateur: identifiant,
        nom_affiche: nouveau.nom_affiche.trim() || identifiant,
        role: nouveau.role,
        chaine_id: nouveau.chaine_id || null,
      })
      setNouveau({ nom_utilisateur: '', nom_affiche: '', role: 'PROGRAMMATEUR', chaine_id: '' })
      setErreur(null)
      notifier.succes(`Utilisateur « ${identifiant} » créé.`)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    }
  }

  async function supprimer(nom) {
    const ok = await notifier.confirmer({
      titre: 'Supprimer l\'utilisateur',
      message: `Supprimer définitivement « ${nom} » ? (compte de démonstration, sans incidence sur les données métier)`,
      labelConfirmer: 'Supprimer',
    })
    if (!ok) return
    try {
      await supprimerUtilisateur(nom)
      notifier.succes(`Utilisateur « ${nom} » supprimé.`)
      oublierBrouillon(nom)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
      notifier.erreur(err.message)
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Utilisateurs & rôles</h2>
      <p className="mb-3 text-sm text-slate-500">
        Gestion des accès (démonstration) — la sécurité par mot de passe sera ajoutée en production.
      </p>

      {erreur && <p className="mb-2 text-sm text-red-600">{erreur}</p>}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 pl-3 pr-3 font-medium">Identifiant</th>
              <th className="py-2 pr-3 font-medium">Nom affiché</th>
              <th className="py-2 pr-3 font-medium">Rôle</th>
              <th className="py-2 pr-3 font-medium">Chaîne</th>
              <th className="py-2 pr-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => {
              const modifie = estModifie(u)
              return (
                <tr key={u.nom_utilisateur} className={`border-b border-slate-100 ${modifie ? 'bg-amber-50/60' : ''}`}>
                  <td className="py-1.5 pl-3 pr-3 text-slate-700">
                    {u.nom_utilisateur}
                    {u.nom_utilisateur === utilisateurActif && (
                      <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">vous</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="text"
                      value={valeur(u, 'nom_affiche')}
                      onChange={(e) => setChamp(u, 'nom_affiche', e.target.value)}
                      className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={valeur(u, 'role')}
                      onChange={(e) => setChamp(u, 'role', e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                      {!ROLES.some((r) => r.code === valeur(u, 'role')) && (
                        <option value={valeur(u, 'role')}>{valeur(u, 'role')}</option>
                      )}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={valeur(u, 'chaine_id')}
                      onChange={(e) => setChamp(u, 'chaine_id', e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">— (toutes)</option>
                      {CHAINES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => enregistrer(u)}
                        disabled={!modifie}
                        title={modifie ? 'Enregistrer les modifications' : 'Aucune modification'}
                        className="rounded-md p-1 text-snrt-navy hover:bg-snrt-navy/10 disabled:text-slate-300 disabled:hover:bg-transparent"
                      >
                        <Save size={15} />
                      </button>
                      {modifie && (
                        <button
                          type="button"
                          onClick={() => oublierBrouillon(u.nom_utilisateur)}
                          title="Annuler les modifications"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Undo2 size={15} />
                        </button>
                      )}
                      {u.nom_utilisateur !== utilisateurActif && (
                        <button
                          type="button"
                          onClick={() => supprimer(u.nom_utilisateur)}
                          title="Supprimer cet utilisateur"
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {utilisateurs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 pl-3 text-sm text-slate-500">
                  Aucun utilisateur connu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={ajouter} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="text"
          value={nouveau.nom_utilisateur}
          onChange={(e) => setNouveau((n) => ({ ...n, nom_utilisateur: e.target.value }))}
          placeholder="identifiant (ex. j.dupont)"
          className="w-44 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={nouveau.nom_affiche}
          onChange={(e) => setNouveau((n) => ({ ...n, nom_affiche: e.target.value }))}
          placeholder="Nom affiché"
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <select
          value={nouveau.role}
          onChange={(e) => setNouveau((n) => ({ ...n, role: e.target.value }))}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={nouveau.chaine_id}
          onChange={(e) => setNouveau((n) => ({ ...n, chaine_id: e.target.value }))}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">— chaîne (toutes)</option>
          {CHAINES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-snrt-navy px-3 py-1 text-sm font-medium text-white hover:bg-snrt-navy-hover"
        >
          + Nouvel utilisateur
        </button>
      </form>
    </section>
  )
}
