// Administration — nomenclature Tranches d'antenne (table `tranche_antenne`,
// migration-p19a.sql). `code` est la clé stable référencée par
// campagne.tranches_ciblees (P16) : seul son renommage ou la suppression de
// la ligne risquent d'orphaner des campagnes existantes, d'où le garde-fou
// sur ces deux actions uniquement (libellés/horaires n'affectent aucune
// donnée existante).
import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  creerTrancheAntenne,
  mettreAJourTrancheAntenne,
  supprimerTrancheAntenne,
  compterCampagnesParTranche,
} from '../lib/db.js'
import { minutesEnHeure } from '../lib/semaine.js'
import { useNotification } from './NotificationProvider.jsx'

const TRANCHE_VIDE = { code: '', libelle_fr: '', libelle_ar: '', debut_minutes: 360, fin_minutes: 720 }

export default function TableauTranches({ tranches, onRafraichir }) {
  const [form, setForm] = useState(TRANCHE_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idCode = useId()
  const idFr = useId()
  const idAr = useId()
  const idDebut = useId()
  const idFin = useId()
  const { confirmer, erreur: notifierErreur } = useNotification()

  async function creer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerTrancheAntenne({
        code: form.code.trim().toUpperCase(),
        libelle_fr: form.libelle_fr.trim(),
        libelle_ar: form.libelle_ar.trim(),
        debut_minutes: Number(form.debut_minutes),
        fin_minutes: Number(form.fin_minutes),
        ordre: tranches.length,
      })
      setForm(TRANCHE_VIDE)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function renommerCode(tranche, nouveauCode) {
    if (!nouveauCode || nouveauCode === tranche.code) return
    const nb = await compterCampagnesParTranche(tranche.code)
    if (
      nb > 0 &&
      !(await confirmer({
        titre: 'Renommer la tranche',
        message: `${nb} campagne(s) ciblent la tranche « ${tranche.code} ». Renommer en « ${nouveauCode} » ?`,
        labelConfirmer: 'Renommer',
      }))
    ) {
      return
    }
    try {
      await mettreAJourTrancheAntenne(tranche.id, { code: nouveauCode })
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function modifier(id, champs) {
    try {
      await mettreAJourTrancheAntenne(id, champs)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function supprimer(tranche) {
    const nb = await compterCampagnesParTranche(tranche.code)
    if (nb > 0) {
      notifierErreur(`Impossible de supprimer « ${tranche.code} » : ${nb} campagne(s) la ciblent encore.`)
      return
    }
    const confirme = await confirmer({
      titre: 'Supprimer la tranche',
      message: `Supprimer la tranche « ${tranche.libelle_fr} » ?`,
      labelConfirmer: 'Supprimer',
    })
    if (!confirme) return
    try {
      await supprimerTrancheAntenne(tranche.id)
      onRafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Tranches d'antenne</h2>
      <p className="mb-3 text-sm text-slate-500">
        Utilisées par le Plan média et la couverture des campagnes (§4.6.3). Bornes en minutes depuis 06:00, début de
        la journée d'antenne.
      </p>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2 pl-3 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Libellé FR</th>
              <th className="py-2 pr-3 font-medium">Libellé AR</th>
              <th className="py-2 pr-3 font-medium">Début</th>
              <th className="py-2 pr-3 font-medium">Fin</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {tranches.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="py-1.5 pl-3 pr-3">
                  <input
                    defaultValue={t.code}
                    onBlur={(e) => renommerCode(t, e.target.value.trim().toUpperCase())}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    defaultValue={t.libelle_fr}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== t.libelle_fr) modifier(t.id, { libelle_fr: v })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3" dir="rtl">
                  <input
                    defaultValue={t.libelle_ar}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== t.libelle_ar) modifier(t.id, { libelle_ar: v })
                    }}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      defaultValue={t.debut_minutes}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (v !== t.debut_minutes) modifier(t.id, { debut_minutes: v })
                      }}
                      className="w-20 rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                    />
                    <span className="text-xs text-slate-400">({minutesEnHeure(t.debut_minutes)})</span>
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      defaultValue={t.fin_minutes}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (v !== t.fin_minutes) modifier(t.id, { fin_minutes: v })
                      }}
                      className="w-20 rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                    />
                    <span className="text-xs text-slate-400">({minutesEnHeure(t.fin_minutes)})</span>
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <button type="button" onClick={() => supprimer(t)} className="text-red-500 hover:text-red-700" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {tranches.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 pl-3 text-sm text-slate-500">
                  Aucune tranche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={creer} className="mt-3 grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-end gap-2">
        <div>
          <label htmlFor={idCode} className="mb-1 block text-xs font-medium text-slate-700">
            Code *
          </label>
          <input
            id={idCode}
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="ex. NUIT_TARDIVE"
            className="w-32 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor={idFr} className="mb-1 block text-xs font-medium text-slate-700">
            Libellé FR *
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
          <label htmlFor={idDebut} className="mb-1 block text-xs font-medium text-slate-700">
            Début (min)
          </label>
          <input
            id={idDebut}
            type="number"
            value={form.debut_minutes}
            onChange={(e) => setForm({ ...form, debut_minutes: e.target.value })}
            className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor={idFin} className="mb-1 block text-xs font-medium text-slate-700">
            Fin (min)
          </label>
          <input
            id={idFin}
            type="number"
            value={form.fin_minutes}
            onChange={(e) => setForm({ ...form, fin_minutes: e.target.value })}
            className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
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
