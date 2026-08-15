import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { creerSpotBibliotheque, mettreAJourSpotBibliotheque, supprimerSpotBibliotheque } from '../lib/db.js'
import { CHAINES } from '../lib/chaines.js'
import Modal from './Modal.jsx'

const TYPES = [
  { valeur: 'BANDE_ANNONCE', libelle: 'Bande-annonce' },
  { valeur: 'ECRAN_PUBLICITAIRE', libelle: 'Écran publicitaire' },
  { valeur: 'HABILLAGE', libelle: 'Habillage' },
  { valeur: 'AUTOPROMOTION', libelle: 'Autopromotion' },
  { valeur: 'SPOT', libelle: 'Spot (Forja, sensibilisation, institutionnel…)' },
]

const SPOT_VIDE = { libelle: '', type: 'SPOT', duree_secondes: 30, chaine_id: '' }

// Bibliothèque de spots réutilisables (P16b) — distincte des éléments déjà
// placés (element_secondaire) : ici, des DÉFINITIONS (libellé, type, durée)
// réutilisables à volonté depuis l'insertion manuelle. chaine_id vide dans le
// formulaire = spot global (dispo sur toutes les chaînes).
export default function BibliothequeSpots({ spots, onFermer, onRafraichir }) {
  const [form, setForm] = useState(SPOT_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idLibelle = useId()
  const idDuree = useId()

  async function creer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerSpotBibliotheque({
        libelle: form.libelle.trim(),
        type: form.type,
        duree_secondes: Number(form.duree_secondes),
        chaine_id: form.chaine_id || null,
      })
      setForm(SPOT_VIDE)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function modifier(id, champs) {
    try {
      await mettreAJourSpotBibliotheque(id, champs)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function supprimer(id) {
    try {
      await supprimerSpotBibliotheque(id)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <Modal titre="Bibliothèque de spots" onFermer={onFermer}>
      <div className="space-y-4">
        <form onSubmit={creer} className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3">
          <div className="col-span-2">
            <label htmlFor={idLibelle} className="mb-1 block text-xs font-medium text-slate-700">
              Libellé *
            </label>
            <input
              id={idLibelle}
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              placeholder="ex. SPOT FORJA SNRT - MOBILE"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={idDuree} className="mb-1 block text-xs font-medium text-slate-700">
              Durée (secondes) *
            </label>
            <input
              id={idDuree}
              type="number"
              min="1"
              required
              value={form.duree_secondes}
              onChange={(e) => setForm({ ...form, duree_secondes: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Portée</label>
            <select
              value={form.chaine_id}
              onChange={(e) => setForm({ ...form, chaine_id: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Global (toutes les chaînes)</option>
              {CHAINES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          {erreur && <p className="col-span-2 text-xs text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={enregistrement}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Plus size={14} />
            {enregistrement ? 'Enregistrement…' : 'Ajouter à la bibliothèque'}
          </button>
        </form>

        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Libellé</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Durée</th>
                <th className="py-2 pr-3 font-medium">Portée</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {spots.map((s) => {
                const chaine = CHAINES.find((c) => c.id === s.chaine_id)
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-700">{s.libelle}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{TYPES.find((t) => t.valeur === s.type)?.libelle ?? s.type}</td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="number"
                        min="1"
                        defaultValue={s.duree_secondes}
                        onBlur={(e) => {
                          const valeur = Number(e.target.value)
                          if (valeur !== s.duree_secondes) modifier(s.id, { duree_secondes: valeur })
                        }}
                        className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{chaine ? chaine.nom : 'Global'}</td>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => supprimer(s.id)} className="text-red-500 hover:text-red-700" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {spots.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-sm text-slate-500">
                    Aucun spot dans la bibliothèque.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
