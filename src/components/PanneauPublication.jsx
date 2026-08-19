// Panneau flottant de création/édition d'une publication (Grille
// non-linéaire, hors cahier, P20) — même gabarit que
// PanneauBlocGrilleType.jsx/InspecteurBloc.jsx. Générique : piloté par
// `config` (GrilleNonLineaire.jsx) pour fonctionner identiquement sur les 2
// onglets, seul le champ Format apparaît/disparaît selon `config.formats`.
import { useEffect, useId, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { listerDiffusionsLineairesParProgramme } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { aujourdHuiISO, formaterDateLongue } from '../lib/semaine.js'
import { STATUTS_PUBLICATION } from '../lib/statutsPublication.js'

export default function PanneauPublication({
  publication,
  programmeInitial,
  dateInitiale,
  programmes,
  chaineActive,
  config,
  onFermer,
  onCree,
  onModifie,
  onSupprime,
}) {
  const estEdition = !!publication
  const [form, setForm] = useState(() => ({
    programme_id: publication?.programme_id ?? programmeInitial ?? '',
    plateforme: publication?.plateforme ?? config.plateformes[0].code,
    format: publication?.format ?? '',
    date_publication: publication?.date_publication ?? dateInitiale ?? aujourdHuiISO(),
    heure_publication: publication?.heure_publication?.slice(0, 5) ?? '',
    titre: publication?.titre ?? '',
    description: publication?.description ?? '',
    lien: publication?.lien ?? '',
    visuel: publication?.visuel ?? '',
    statut: publication?.statut ?? 'BROUILLON',
  }))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [diffusionsLineaires, setDiffusionsLineaires] = useState([])
  const idProgramme = useId()
  const idPlateforme = useId()
  const idFormat = useId()
  const idDate = useId()
  const idHeure = useId()
  const idTitre = useId()
  const idDescription = useId()
  const idLien = useId()
  const idVisuel = useId()
  const idStatut = useId()

  // Indicateur lecture seule "déjà diffusé en linéaire" — aide au calage de
  // la promo, aucun couplage d'écriture entre les deux modèles.
  useEffect(() => {
    if (!form.programme_id) {
      setDiffusionsLineaires([])
      return
    }
    listerDiffusionsLineairesParProgramme(form.programme_id)
      .then(setDiffusionsLineaires)
      .catch(() => setDiffusionsLineaires([]))
  }, [form.programme_id])

  async function enregistrer(e) {
    e.preventDefault()
    if (!form.programme_id) {
      setErreur('Choisissez un Titre.')
      return
    }
    if (config.formats && !form.format) {
      setErreur('Choisissez un format.')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    const champs = {
      chaine_id: chaineActive.id,
      programme_id: form.programme_id,
      plateforme: form.plateforme,
      ...(config.formats ? { format: form.format } : {}),
      date_publication: form.date_publication,
      heure_publication: form.heure_publication || null,
      titre: form.titre.trim() || null,
      description: form.description.trim() || null,
      lien: form.lien.trim() || null,
      visuel: form.visuel.trim() || null,
      statut: form.statut,
    }
    try {
      if (estEdition) {
        const maj = await config.mettreAJour(publication.id, champs)
        onModifie(maj)
      } else {
        const cree = await config.creer({ ...champs, cree_par: lireUtilisateur() })
        onCree(cree)
      }
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer cette publication ${estEdition ? `(« ${publication.titre || 'sans titre'} »)` : ''} ?`)) return
    try {
      await config.supprimer(publication.id)
      onSupprime(publication.id)
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{estEdition ? 'Publication' : 'Nouvelle publication'}</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={enregistrer} className="space-y-3">
        <div>
          <label htmlFor={idProgramme} className="mb-1 block text-xs font-medium text-slate-700">
            Titre (programme) *
          </label>
          <select
            id={idProgramme}
            required
            value={form.programme_id}
            onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Choisir —</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titre}
              </option>
            ))}
          </select>
        </div>

        {diffusionsLineaires.length > 0 && (
          <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
            Déjà diffusé en linéaire :{' '}
            {diffusionsLineaires
              .slice(0, 5)
              .map((d) => formaterDateLongue(d.date))
              .join(', ')}
            {diffusionsLineaires.length > 5 ? ` (+${diffusionsLineaires.length - 5} autres)` : ''}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idPlateforme} className="mb-1 block text-xs font-medium text-slate-700">
              Plateforme
            </label>
            <select
              id={idPlateforme}
              value={form.plateforme}
              onChange={(e) => setForm({ ...form, plateforme: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {config.plateformes.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.libelle}
                </option>
              ))}
            </select>
          </div>
          {config.formats && (
            <div>
              <label htmlFor={idFormat} className="mb-1 block text-xs font-medium text-slate-700">
                Format *
              </label>
              <select
                id={idFormat}
                required
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Choisir —</option>
                {config.formats.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.libelle}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idDate} className="mb-1 block text-xs font-medium text-slate-700">
              Date de publication *
            </label>
            <input
              id={idDate}
              type="date"
              required
              value={form.date_publication}
              onChange={(e) => setForm({ ...form, date_publication: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor={idHeure} className="mb-1 block text-xs font-medium text-slate-700">
              Heure (optionnelle)
            </label>
            <input
              id={idHeure}
              type="time"
              value={form.heure_publication}
              onChange={(e) => setForm({ ...form, heure_publication: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor={idTitre} className="mb-1 block text-xs font-medium text-slate-700">
            Titre du post
          </label>
          <input
            id={idTitre}
            type="text"
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
            placeholder="Repli sur le titre du programme si vide"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={idDescription} className="mb-1 block text-xs font-medium text-slate-700">
            Description
          </label>
          <textarea
            id={idDescription}
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={idLien} className="mb-1 block text-xs font-medium text-slate-700">
            Lien (une fois publié)
          </label>
          <input
            id={idLien}
            type="text"
            value={form.lien}
            onChange={(e) => setForm({ ...form, lien: e.target.value })}
            placeholder="https://…"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={idVisuel} className="mb-1 block text-xs font-medium text-slate-700">
            Visuel (référence/URL)
          </label>
          <input
            id={idVisuel}
            type="text"
            value={form.visuel}
            onChange={(e) => setForm({ ...form, visuel: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={idStatut} className="mb-1 block text-xs font-medium text-slate-700">
            Statut
          </label>
          <select
            id={idStatut}
            value={form.statut}
            onChange={(e) => setForm({ ...form, statut: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {STATUTS_PUBLICATION.map((s) => (
              <option key={s.code} value={s.code}>
                {s.libelle}
              </option>
            ))}
          </select>
        </div>

        {erreur && <p className="text-xs text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={enregistrement}
          className="w-full rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Enregistrement…' : estEdition ? 'Enregistrer' : 'Créer'}
        </button>

        {estEdition && (
          <button
            type="button"
            onClick={supprimer}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        )}
      </form>
    </div>
  )
}
