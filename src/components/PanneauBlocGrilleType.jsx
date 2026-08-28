import { useEffect, useId, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { mettreAJourBlocGrilleType, supprimerBlocGrilleType } from '../lib/db.js'
import { enregistrerAction } from '../lib/undoManager.js'
import { GENRES } from '../lib/genres.js'
import { minutesDepuisDebutAntenne, formaterDureeMinutes } from '../lib/semaine.js'
import { useGardeModifications, useSignalerModifications } from './NotificationProvider.jsx'

const JOURS_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] // 0=lundi..6=dimanche

function formaterDuree(heureDebut, heureFin) {
  const minutes = minutesDepuisDebutAntenne(heureFin) - minutesDepuisDebutAntenne(heureDebut)
  return formaterDureeMinutes(minutes)
}

// Panneau flottant (même gabarit que InspecteurBloc, P11) — édite toujours un
// bloc déjà persisté : la création (glisser-déposer ou bouton « Ajouter »)
// écrit directement en base côté GrilleType.jsx avant d'ouvrir ce panneau, pas
// de mode « brouillon non enregistré » ici.
export default function PanneauBlocGrilleType({ bloc, chaineActive, grilleTypeId, onFermer, onModifie, onSupprime, onModifieChange }) {
  const [form, setForm] = useState(null)
  const [valeurInitiale, setValeurInitiale] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idNom = useId()
  const idDebut = useId()
  const idFin = useId()

  useEffect(() => {
    const initial = {
      nom: bloc.nom,
      heure_debut: bloc.heure_debut.slice(0, 5),
      heure_fin: bloc.heure_fin.slice(0, 5),
      jours: bloc.jours,
      frequence: bloc.frequence,
      genre_attendu: bloc.genre_attendu,
    }
    setForm(initial)
    setValeurInitiale(initial)
    setErreur(null)
  }, [bloc])

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : `bloc` change de
  // référence après un enregistrement réussi (appliquerModification côté
  // GrilleType.jsx), donc l'effet ci-dessus rebascule automatiquement
  // valeurInitiale sur les valeurs fraîchement sauvegardées.
  const { estModifie } = useGardeModifications(form, valeurInitiale)
  useSignalerModifications(estModifie, onModifieChange)

  if (!form) return null

  function basculerJour(i) {
    setForm((f) => ({
      ...f,
      jours: f.jours.includes(i) ? f.jours.filter((j) => j !== i) : [...f.jours, i].sort(),
    }))
  }

  // "Tous les jours" (même pattern que l'onglet Répéter de l'Inspecteur,
  // P27b) : bascule entre les 7 jours cochés et aucun, en un clic.
  function toggleTousLesJours() {
    setForm((f) => ({ ...f, jours: f.jours.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6] }))
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (form.jours.length === 0) {
      setErreur('Choisissez au moins un jour d’application.')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    try {
      const champs = { ...form, nom: form.nom.trim() }
      const maj = await mettreAJourBlocGrilleType(bloc.id, champs)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_TYPE',
        documentId: grilleTypeId,
        libelle: `Édition : ${bloc.nom || bloc.genre_attendu || 'bloc'}`,
        operations: [{ table: 'bloc_grille_type', type: 'UPDATE', id: bloc.id, avant: bloc, apres: maj }],
      })
      onModifie(maj)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function supprimer() {
    try {
      await supprimerBlocGrilleType(bloc.id)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_TYPE',
        documentId: grilleTypeId,
        libelle: `Suppression : ${bloc.nom || bloc.genre_attendu || 'bloc'}`,
        operations: [{ table: 'bloc_grille_type', type: 'DELETE', id: bloc.id, avant: bloc }],
      })
      onSupprime(bloc.id)
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="animer-entree-panneau fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Bloc de grille type</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={enregistrer} className="space-y-4">
        <div>
          <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
            Nom
          </label>
          <input
            id={idNom}
            type="text"
            placeholder={form.genre_attendu || 'Optionnel — genre attendu par défaut si vide'}
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={idDebut} className="mb-1 block text-sm font-medium text-slate-700">
              Heure début *
            </label>
            <input
              id={idDebut}
              type="time"
              required
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={idFin} className="mb-1 block text-sm font-medium text-slate-700">
              Heure fin *
            </label>
            <input
              id={idFin}
              type="time"
              required
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">Durée : {formaterDuree(form.heure_debut, form.heure_fin)}</p>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="block text-sm font-medium text-slate-700">Jours d'application *</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={form.jours.length === 7} onChange={toggleTousLesJours} />
              Tous les jours
            </label>
          </div>
          <div className="flex gap-1">
            {JOURS_ABBR.map((j, i) => (
              <button
                key={i}
                type="button"
                onClick={() => basculerJour(i)}
                className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${
                  form.jours.includes(i)
                    ? 'border-snrt-navy bg-snrt-navy text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Fréquence</span>
          <div className="flex gap-2">
            {['Quotidien', 'Hebdo'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForm({ ...form, frequence: f })}
                className={`flex-1 rounded-md border py-1.5 text-sm ${
                  form.frequence === f
                    ? 'border-snrt-navy bg-snrt-navy text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Genre attendu *</span>
          <select
            value={form.genre_attendu}
            onChange={(e) => setForm({ ...form, genre_attendu: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {GENRES.map((g) => (
              <option key={g.fr} value={g.fr}>
                {g.fr} — {g.ar}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Détermine la couleur du bloc et sert au contrôle de cohérence (écart de genre).
          </p>
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button
          type="submit"
          disabled={enregistrement}
          className="w-full rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <button
        type="button"
        onClick={supprimer}
        className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} />
        Supprimer le bloc
      </button>
    </div>
  )
}
