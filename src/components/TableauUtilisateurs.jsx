// Administration — Utilisateurs & rôles (P30, étendu P35 : 8 rôles, nom
// affiché distinct de l'identifiant, chaîne d'affectation, création).
// Édition en ligne, écriture immédiate ; création via une ligne de saisie.
import { useState } from 'react'
import { creerUtilisateur, mettreAJourUtilisateur } from '../lib/db.js'
import { ROLES } from '../lib/roles.js'
import { CHAINES } from '../lib/chaines.js'

export default function TableauUtilisateurs({ utilisateurs, utilisateurActif, onRafraichir }) {
  const [nouveau, setNouveau] = useState({ nom_utilisateur: '', nom_affiche: '', role: 'UTILISATEUR', chaine_id: '' })
  const [erreur, setErreur] = useState(null)

  async function patch(nom, champs) {
    try {
      await mettreAJourUtilisateur(nom, champs)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
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
      setNouveau({ nom_utilisateur: '', nom_affiche: '', role: 'UTILISATEUR', chaine_id: '' })
      setErreur(null)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
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
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => (
              <tr key={u.nom_utilisateur} className="border-b border-slate-100">
                <td className="py-1.5 pl-3 pr-3 text-slate-700">
                  {u.nom_utilisateur}
                  {u.nom_utilisateur === utilisateurActif && (
                    <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">vous</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="text"
                    defaultValue={u.nom_affiche ?? ''}
                    onBlur={(e) => e.target.value !== (u.nom_affiche ?? '') && patch(u.nom_utilisateur, { nom_affiche: e.target.value })}
                    className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <select
                    value={u.role}
                    onChange={(e) => patch(u.nom_utilisateur, { role: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                    {!ROLES.some((r) => r.code === u.role) && <option value={u.role}>{u.role}</option>}
                  </select>
                </td>
                <td className="py-1.5 pr-3">
                  <select
                    value={u.chaine_id ?? ''}
                    onChange={(e) => patch(u.nom_utilisateur, { chaine_id: e.target.value || null })}
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
              </tr>
            ))}
            {utilisateurs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 pl-3 text-sm text-slate-500">
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
