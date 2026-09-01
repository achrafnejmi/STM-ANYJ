// Administration — Utilisateurs & rôles (retouche post-P29). Miroir de
// TableauGenres.jsx (édition en ligne, écriture immédiate au changement,
// pas de bouton « Enregistrer » séparé pour un changement aussi simple).
import { mettreAJourRoleUtilisateur } from '../lib/db.js'

const ROLES = [
  { code: 'UTILISATEUR', label: 'Utilisateur' },
  { code: 'ADMIN', label: 'Administrateur' },
]

export default function TableauUtilisateurs({ utilisateurs, utilisateurActif, onRafraichir }) {
  async function changerRole(nom, role) {
    await mettreAJourRoleUtilisateur(nom, role)
    onRafraichir()
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Utilisateurs & rôles</h2>
      <p className="mb-3 text-sm text-slate-500">
        Gestion des accès (démonstration) — la sécurité par mot de passe sera ajoutée en production.
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 pl-3 pr-3 font-medium">Nom d'utilisateur</th>
              <th className="py-2 pr-3 font-medium">Rôle</th>
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
                  <select
                    value={u.role}
                    onChange={(e) => changerRole(u.nom_utilisateur, e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {utilisateurs.length === 0 && (
              <tr>
                <td colSpan={2} className="py-3 pl-3 text-sm text-slate-500">
                  Aucun utilisateur connu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
