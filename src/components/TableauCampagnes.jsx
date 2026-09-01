import { useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { creerCampagne, mettreAJourCampagne, supprimerCampagne } from '../lib/db.js'
import { TRANCHES } from '../lib/tranches.js'
import Modal from './Modal.jsx'
import { aujourdHuiISO } from '../lib/semaine.js'

const CAMPAGNE_VIDE = {
  programme_id: '',
  date_debut: aujourdHuiISO(),
  date_fin: aujourdHuiISO(),
  objectif: 10,
  priorite: 'NORMALE',
  max_par_jour: 3,
  separation_minutes: 30,
  tranches_ciblees: [],
}

// Tableau des campagnes (§4.6.2) : une ligne par campagne, règles éditables
// en ligne (même pattern que ReservoirPanel.jsx — nouveau dans ce projet mais
// explicitement demandé par le cahier), couverture affichée en continu.
export default function TableauCampagnes({ chaineActive, campagnes, programmes, couverture, onRafraichir }) {
  const [modaleOuverte, setModaleOuverte] = useState(false)
  const [form, setForm] = useState(CAMPAGNE_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [regles, setRegles] = useState(() => new Map(campagnes.map((c) => [c.id, versChamps(c)])))
  const idProgramme = useId()
  const idDebut = useId()
  const idFin = useId()
  const idObjectif = useId()

  useEffect(() => {
    setRegles(new Map(campagnes.map((c) => [c.id, versChamps(c)])))
  }, [campagnes])

  function versChamps(c) {
    return {
      objectif: c.objectif,
      priorite: c.priorite,
      max_par_jour: c.max_par_jour,
      separation_minutes: c.separation_minutes,
      tranches_ciblees: c.tranches_ciblees ?? [],
    }
  }

  function modifierLocal(id, champ, valeur) {
    setRegles((prev) => {
      const copie = new Map(prev)
      copie.set(id, { ...copie.get(id), [champ]: valeur })
      return copie
    })
  }

  async function persister(id, champ, valeur) {
    try {
      await mettreAJourCampagne(id, { [champ]: valeur })
      onRafraichir()
    } catch {
      // PoC : pas de remontée dédiée, le prochain rechargement resynchronise.
    }
  }

  function basculerTranche(id, code) {
    const actuelles = regles.get(id)?.tranches_ciblees ?? []
    const nouvelles = actuelles.includes(code) ? actuelles.filter((t) => t !== code) : [...actuelles, code]
    modifierLocal(id, 'tranches_ciblees', nouvelles)
    persister(id, 'tranches_ciblees', nouvelles)
  }

  async function supprimer(id) {
    try {
      await supprimerCampagne(id)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function creer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerCampagne({
        chaine_id: chaineActive.id,
        programme_id: form.programme_id,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        objectif: Number(form.objectif),
        priorite: form.priorite,
        max_par_jour: Number(form.max_par_jour),
        separation_minutes: Number(form.separation_minutes),
        tranches_ciblees: form.tranches_ciblees,
      })
      setModaleOuverte(false)
      setForm(CAMPAGNE_VIDE)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Campagnes</h2>
        <button
          type="button"
          onClick={() => setModaleOuverte(true)}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700"
          title="Nouvelle campagne"
        >
          <Plus size={16} />
        </button>
      </div>

      {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Programme promu</th>
              <th className="py-2 pr-4 font-medium">Période</th>
              <th className="py-2 pr-4 font-medium">Objectif</th>
              <th className="py-2 pr-4 font-medium">Priorité</th>
              <th className="py-2 pr-4 font-medium">Max/jour</th>
              <th className="py-2 pr-4 font-medium">Séparation (min)</th>
              <th className="py-2 pr-4 font-medium">Tranches ciblées</th>
              <th className="py-2 pr-4 font-medium">Couverture</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {campagnes.map((c) => {
              const champs = regles.get(c.id) ?? versChamps(c)
              const cov = couverture.get(c.id) ?? { placees: 0, objectif: c.objectif }
              const pct = cov.objectif > 0 ? Math.min(100, Math.round((cov.placees / cov.objectif) * 100)) : 0
              const programme = programmes.find((p) => p.id === c.programme_id)
              return (
                <tr key={c.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 text-slate-700">{programme?.titre ?? '—'}</td>
                  <td className="py-2 pr-4 text-slate-500">
                    {c.date_debut} → {c.date_fin}
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={champs.objectif}
                      onChange={(e) => modifierLocal(c.id, 'objectif', e.target.value)}
                      onBlur={(e) => persister(c.id, 'objectif', Number(e.target.value))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={champs.priorite}
                      onChange={(e) => {
                        modifierLocal(c.id, 'priorite', e.target.value)
                        persister(c.id, 'priorite', e.target.value)
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="HAUTE">Haute</option>
                      <option value="NORMALE">Normale</option>
                      <option value="BASSE">Basse</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={champs.max_par_jour}
                      onChange={(e) => modifierLocal(c.id, 'max_par_jour', e.target.value)}
                      onBlur={(e) => persister(c.id, 'max_par_jour', Number(e.target.value))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={champs.separation_minutes}
                      onChange={(e) => modifierLocal(c.id, 'separation_minutes', e.target.value)}
                      onBlur={(e) => persister(c.id, 'separation_minutes', Number(e.target.value))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {TRANCHES.map((t) => (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() => basculerTranche(c.id, t.code)}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            champs.tranches_ciblees.includes(t.code)
                              ? 'bg-snrt-navy text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="w-24">
                      <div className="mb-0.5 text-xs text-slate-500">
                        {cov.placees}/{cov.objectif}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-snrt-navy'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <button type="button" onClick={() => supprimer(c.id)} className="text-red-500 hover:text-red-700" title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {campagnes.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-sm text-slate-500">
                  Aucune campagne sur {chaineActive.nom}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modaleOuverte && (
        <Modal titre="Nouvelle campagne" onFermer={() => setModaleOuverte(false)}>
          <form onSubmit={creer} className="space-y-4">
            <div>
              <label htmlFor={idProgramme} className="mb-1 block text-sm font-medium text-slate-700">
                Programme promu *
              </label>
              <select
                id={idProgramme}
                required
                value={form.programme_id}
                onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir un titre —</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={idDebut} className="mb-1 block text-sm font-medium text-slate-700">
                  Date de début *
                </label>
                <input
                  id={idDebut}
                  type="date"
                  required
                  value={form.date_debut}
                  onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor={idFin} className="mb-1 block text-sm font-medium text-slate-700">
                  Date de fin *
                </label>
                <input
                  id={idFin}
                  type="date"
                  required
                  value={form.date_fin}
                  onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor={idObjectif} className="mb-1 block text-sm font-medium text-slate-700">
                Objectif (nombre de bandes-annonces) *
              </label>
              <input
                id={idObjectif}
                type="number"
                min="1"
                required
                value={form.objectif}
                onChange={(e) => setForm({ ...form, objectif: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <button
              type="submit"
              disabled={enregistrement}
              className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
            >
              {enregistrement ? 'Enregistrement…' : 'Créer la campagne'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
