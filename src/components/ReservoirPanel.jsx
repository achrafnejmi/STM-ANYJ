import { useEffect, useState } from 'react'
import { mettreAJourProgramme } from '../lib/db.js'
import { estProgrammable } from '../lib/droits.js'
import { aujourdHuiISO } from '../lib/semaine.js'
import { reglesEffectives } from '../lib/autoprog.js'

// Réservoir de contenus (§4.5.2) : une ligne par titre, colonnes de règles
// éditables directement (EXG-M4-05 : « modifiables sans quitter l'écran,
// prises en compte à l'exécution suivante »). Pattern nouveau dans ce
// projet — les autres écrans éditent via un panneau latéral, jamais en
// ligne — mais explicitement demandé ici par le cahier.
export default function ReservoirPanel({ chaineActive, programmes, episodesParProgramme, fenetresDroits }) {
  // Copie locale éditable (répond immédiatement à la saisie ; les champs
  // numériques ne sont persistés qu'au blur pour éviter une requête par
  // frappe — checkbox/select se persistent immédiatement, ce sont des choix
  // discrets).
  const [regles, setRegles] = useState(() => new Map(programmes.map((p) => [p.id, versChamps(p)])))

  useEffect(() => {
    setRegles(new Map(programmes.map((p) => [p.id, versChamps(p)])))
  }, [programmes])

  function versChamps(p) {
    return {
      autoprog_actif: p.autoprog_actif ?? true,
      autoprog_separation_jours: p.autoprog_separation_jours ?? '',
      autoprog_diffusions_max: p.autoprog_diffusions_max ?? '',
      autoprog_ordre: p.autoprog_ordre ?? '',
    }
  }

  function modifierLocal(id, champ, valeur) {
    setRegles((prev) => {
      const copie = new Map(prev)
      copie.set(id, { ...copie.get(id), [champ]: valeur })
      return copie
    })
  }

  async function persister(id, champ, valeurBrute) {
    const valeur = valeurBrute === '' ? null : valeurBrute
    try {
      await mettreAJourProgramme(id, { [champ]: valeur })
    } catch {
      // PoC : pas de remontée d'erreur dédiée ici, le prochain rechargement
      // de la chaîne resynchronise l'affichage avec la base.
    }
  }

  const aujourdHui = aujourdHuiISO()
  const passagesConsommesParProgramme = new Map()
  for (const f of fenetresDroits) {
    passagesConsommesParProgramme.set(
      f.programme_id,
      (passagesConsommesParProgramme.get(f.programme_id) ?? 0) + (f.passages_consommes ?? 0)
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Réservoir de contenus</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Actif</th>
              <th className="py-2 pr-4 font-medium">Titre</th>
              <th className="py-2 pr-4 font-medium">Genre</th>
              <th className="py-2 pr-4 font-medium">Séparation (j)</th>
              <th className="py-2 pr-4 font-medium">Diff. max / période</th>
              <th className="py-2 pr-4 font-medium">Passages consommés</th>
              <th className="py-2 pr-4 font-medium">Ordre des épisodes</th>
              <th className="py-2 pr-4 font-medium">Stock PAD</th>
              <th className="py-2 pr-4 font-medium">Droits</th>
            </tr>
          </thead>
          <tbody>
            {programmes.map((p) => {
              const champs = regles.get(p.id) ?? versChamps(p)
              const effectives = reglesEffectives(p)
              const stock = (episodesParProgramme.get(p.id) ?? []).filter((e) => e.pad).length
              const droits = estProgrammable(p.id, fenetresDroits, aujourdHui)
              return (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={champs.autoprog_actif}
                      onChange={(e) => {
                        modifierLocal(p.id, 'autoprog_actif', e.target.checked)
                        persister(p.id, 'autoprog_actif', e.target.checked)
                      }}
                    />
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{p.titre}</td>
                  <td className="py-2 pr-4 text-slate-500">{p.genre || '—'}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={champs.autoprog_separation_jours}
                      placeholder={String(effectives.separationJours)}
                      onChange={(e) => modifierLocal(p.id, 'autoprog_separation_jours', e.target.value)}
                      onBlur={(e) => persister(p.id, 'autoprog_separation_jours', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={champs.autoprog_diffusions_max}
                      placeholder={String(effectives.diffusionsMax)}
                      onChange={(e) => modifierLocal(p.id, 'autoprog_diffusions_max', e.target.value)}
                      onBlur={(e) => persister(p.id, 'autoprog_diffusions_max', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{passagesConsommesParProgramme.get(p.id) ?? 0}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={champs.autoprog_ordre}
                      onChange={(e) => {
                        modifierLocal(p.id, 'autoprog_ordre', e.target.value)
                        persister(p.id, 'autoprog_ordre', e.target.value)
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">— Défaut ({effectives.ordre === 'SEQUENTIEL' ? 'Séquentiel' : 'Aléatoire'}) —</option>
                      <option value="SEQUENTIEL">Séquentiel</option>
                      <option value="RECENCE">Aléatoire</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{stock}</td>
                  <td className="py-2 pr-4">
                    {droits.ok ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">OK</span>
                    ) : (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700" title={droits.motif}>
                        Hors droits
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {programmes.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-sm text-slate-500">
                  Aucun programme sur {chaineActive.nom}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Aléatoire : épisode le moins récemment diffusé — remplissage déterministe, jamais tiré au sort.
      </p>
    </div>
  )
}
