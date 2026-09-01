// Administration — Chaînes (retouche post-P29, table `chaine`,
// migration-p9.sql). Édition seulement — jamais d'ajout/suppression : les 5
// espaces de travail (M1) sont une liste fermée, leurs id/code sont
// référencés en dur dans src/lib/chaines.js et tout le scoping de l'app.
// Miroir de TableauGenres.jsx pour le style (édition en ligne, onBlur pour
// le texte, select immédiat pour la couleur), sans le formulaire d'ajout.
import { mettreAJourChaine } from '../lib/db.js'

// Tokens littéraux (jamais construits par concaténation — le scanner JIT
// Tailwind n'indexe que des classes complètes présentes telles quelles dans
// le code source, même discipline que couleursGenre.js) : les 5 couleurs de
// marque SNRT réellement définies pour les chaînes (index.css).
const COULEURS_CHAINE = [
  { token: 'red', fond: 'bg-snrt-red' },
  { token: 'green', fond: 'bg-snrt-green' },
  { token: 'cyan', fond: 'bg-snrt-cyan' },
  { token: 'orange', fond: 'bg-snrt-orange' },
  { token: 'blue', fond: 'bg-snrt-blue' },
]

export default function TableauChaines({ chaines, onRafraichir }) {
  async function modifier(id, champs) {
    await mettreAJourChaine(id, champs)
    onRafraichir()
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Chaînes</h2>
      <p className="mb-3 text-sm text-slate-500">
        Les 5 espaces de travail (M1) — nom, ligne éditoriale et couleur. Code et logo restent fixes (structurels).
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 pl-3 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Nom</th>
              <th className="py-2 pr-3 font-medium">Nom (arabe)</th>
              <th className="py-2 pr-3 font-medium">Ligne éditoriale</th>
              <th className="py-2 pr-3 font-medium">Couleur</th>
            </tr>
          </thead>
          <tbody>
            {chaines.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-1.5 pl-3 pr-3 font-mono text-xs text-slate-500">{c.code}</td>
                <td className="py-1.5 pr-3">
                  <input
                    defaultValue={c.nom}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== c.nom) modifier(c.id, { nom: v })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3" dir="rtl">
                  <input
                    defaultValue={c.nom_ar ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (c.nom_ar ?? '')) modifier(c.id, { nom_ar: v || null })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    defaultValue={c.ligne_editoriale ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (c.ligne_editoriale ?? '')) modifier(c.id, { ligne_editoriale: v || null })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-4 w-4 shrink-0 rounded ${COULEURS_CHAINE.find((t) => t.token === c.couleur_token)?.fond ?? 'bg-slate-300'}`} />
                    <select
                      value={c.couleur_token}
                      onChange={(e) => modifier(c.id, { couleur_token: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {COULEURS_CHAINE.map((t) => (
                        <option key={t.token} value={t.token}>
                          {t.token}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {chaines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 pl-3 text-sm text-slate-500">
                  Aucune chaîne.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
