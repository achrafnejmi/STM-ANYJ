// Administration — nomenclature Genres (table `genre`, migration-p19a.sql).
// Même structure que BibliothequeSpots.jsx : édition en ligne (onBlur) +
// petit formulaire de création. Garde-fou avant renommage/suppression :
// compte les programmes qui portent aujourd'hui ce libellé (RG implicite du
// cahier — "ajout sans intervention technique", jamais une donnée orpheline
// silencieuse).
import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  creerGenre,
  mettreAJourGenre,
  supprimerGenre,
  compterProgrammesParGenre,
} from '../lib/db.js'
import { TOKENS_PALETTE, couleurDuToken } from '../lib/couleursGenre.js'

const GENRE_VIDE = { libelle_fr: '', libelle_ar: '', couleur_token: TOKENS_PALETTE[0], ordre: 0 }

export default function TableauGenres({ genres, onRafraichir }) {
  const [form, setForm] = useState(GENRE_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idFr = useId()
  const idAr = useId()

  async function creer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerGenre({
        libelle_fr: form.libelle_fr.trim(),
        libelle_ar: form.libelle_ar.trim(),
        couleur_token: form.couleur_token,
        ordre: genres.length,
      })
      setForm({ ...GENRE_VIDE, couleur_token: TOKENS_PALETTE[genres.length % TOKENS_PALETTE.length] })
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // Renommer le libellé FR est la seule modification qui risque d'orphaner
  // des programmes (c'est la clé de correspondance avec programme.genre) —
  // couleur/libellé AR n'affectent aucune donnée existante.
  async function renommer(genre, nouveauLibelle) {
    if (!nouveauLibelle || nouveauLibelle === genre.libelle_fr) return
    const nb = await compterProgrammesParGenre(genre.libelle_fr)
    if (nb > 0 && !window.confirm(`${nb} titre(s) utilisent le genre « ${genre.libelle_fr} ». Renommer en « ${nouveauLibelle} » ?`)) {
      return
    }
    try {
      await mettreAJourGenre(genre.id, { libelle_fr: nouveauLibelle })
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function modifier(id, champs) {
    try {
      await mettreAJourGenre(id, champs)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function supprimer(genre) {
    const nb = await compterProgrammesParGenre(genre.libelle_fr)
    if (nb > 0) {
      window.alert(`Impossible de supprimer « ${genre.libelle_fr} » : ${nb} titre(s) l'utilisent encore.`)
      return
    }
    if (!window.confirm(`Supprimer le genre « ${genre.libelle_fr} » ?`)) return
    try {
      await supprimerGenre(genre.id)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Genres</h2>
      <p className="mb-3 text-sm text-slate-500">
        Utilisés pour la classification des titres, la couleur des blocs de grille et les bilans (§3.3/§6.2).
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 pl-3 pr-3 font-medium">Libellé FR</th>
              <th className="py-2 pr-3 font-medium">Libellé AR</th>
              <th className="py-2 pr-3 font-medium">Couleur</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {genres.map((g) => (
              <tr key={g.id} className="border-b border-slate-100">
                <td className="py-1.5 pl-3 pr-3">
                  <input
                    defaultValue={g.libelle_fr}
                    onBlur={(e) => renommer(g, e.target.value.trim())}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3" dir="rtl">
                  <input
                    defaultValue={g.libelle_ar}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== g.libelle_ar) modifier(g.id, { libelle_ar: v })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-4 w-4 shrink-0 rounded ${couleurDuToken(g.couleur_token).fond}`} />
                    <select
                      value={g.couleur_token}
                      onChange={(e) => modifier(g.id, { couleur_token: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {TOKENS_PALETTE.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <button type="button" onClick={() => supprimer(g)} className="text-red-500 hover:text-red-700" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {genres.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 pl-3 text-sm text-slate-500">
                  Aucun genre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={creer} className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2">
        <div>
          <label htmlFor={idFr} className="mb-1 block text-xs font-medium text-slate-700">
            Nouveau libellé FR *
          </label>
          <input
            id={idFr}
            required
            value={form.libelle_fr}
            onChange={(e) => setForm({ ...form, libelle_fr: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor={idAr} className="mb-1 block text-xs font-medium text-slate-700">
            Libellé AR *
          </label>
          <input
            id={idAr}
            required
            dir="rtl"
            value={form.libelle_ar}
            onChange={(e) => setForm({ ...form, libelle_ar: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Couleur</label>
          <select
            value={form.couleur_token}
            onChange={(e) => setForm({ ...form, couleur_token: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {TOKENS_PALETTE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={enregistrement}
          className="flex items-center justify-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </form>
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
    </section>
  )
}
