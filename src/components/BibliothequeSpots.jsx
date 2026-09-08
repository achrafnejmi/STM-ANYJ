import { useEffect, useId, useMemo, useState } from 'react'
import { Plus, CirclePlus, Trash2, CheckCircle2, BadgeCheck } from 'lucide-react'
import {
  creerSpotBibliotheque,
  mettreAJourSpotBibliotheque,
  supprimerSpotBibliotheque,
  listerDemandesPadParChaine,
  creerDemandePad,
  creerNotifications,
} from '../lib/db.js'
import { CHAINES } from '../lib/chaines.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { peutMettreEnPad, peutDemanderPad } from '../lib/roles.js'
import { lireUtilisateur } from '../lib/session.js'
import { messageDemandePadSpot } from '../lib/notifications.js'
import Modal from './Modal.jsx'

const TYPES = [
  { valeur: 'BANDE_ANNONCE', libelle: 'Bande-annonce', court: 'BA' },
  { valeur: 'ECRAN_PUBLICITAIRE', libelle: 'Écran publicitaire', court: 'Écran pub.' },
  { valeur: 'HABILLAGE', libelle: 'Habillage', court: 'Habillage' },
  { valeur: 'AUTOPROMOTION', libelle: 'Autopromotion', court: 'Autopromo' },
  { valeur: 'SPOT', libelle: 'Spot (Forja, sensibilisation, institutionnel…)', court: 'Spot' },
]

const SPOT_VIDE = { libelle: '', type: 'SPOT', duree_secondes: 30, chaine_id: '', genre: '', validite_debut: '', validite_fin: '', pad: false }

// Bibliothèque de spots réutilisables (P16b) — distincte des éléments déjà
// placés (element_secondaire) : ici, des DÉFINITIONS (libellé, type, durée,
// + P38 : genre, fenêtre de validité, statut PAD) réutilisables à volonté
// depuis l'insertion manuelle. chaine_id vide = spot global (toutes chaînes).
//
// `onAjouterAuPlan` (P26bis, optionnel) : raccourci « + » par ligne — ne fait
// AUCUNE écriture ici ; signale juste au parent d'ouvrir l'insertion manuelle
// avec ce spot présélectionné.
export default function BibliothequeSpots({ spots, roleUtilisateur, chaineActive, onFermer, onRafraichir, onAjouterAuPlan }) {
  const [form, setForm] = useState(SPOT_VIDE)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [filtreGenre, setFiltreGenre] = useState('')
  const [demandesPad, setDemandesPad] = useState([])
  const [envoiPad, setEnvoiPad] = useState(null)
  const idLibelle = useId()
  const idDuree = useId()
  const modifiablePad = peutMettreEnPad(roleUtilisateur)
  const demandeurPad = peutDemanderPad(roleUtilisateur)

  useEffect(() => {
    if (!chaineActive) return
    listerDemandesPadParChaine(chaineActive.id).then(setDemandesPad).catch(() => {})
  }, [chaineActive])

  const demandeEnAttenteParSpot = useMemo(
    () =>
      new Map(
        demandesPad
          .filter((d) => d.spot_bibliotheque_id && d.statut === 'EN_ATTENTE')
          .map((d) => [d.spot_bibliotheque_id, d])
      ),
    [demandesPad]
  )

  const spotsAffiches = useMemo(
    () => (filtreGenre ? spots.filter((s) => s.genre === filtreGenre) : spots),
    [spots, filtreGenre]
  )

  async function demanderPadSpot(spot) {
    if (!chaineActive) return
    const motif = window.prompt('Motif de la demande de validation PAD (optionnel) :', '')
    if (motif === null) return
    setEnvoiPad(spot.id)
    setErreur(null)
    try {
      await creerDemandePad({
        chaine_id: chaineActive.id,
        spot_bibliotheque_id: spot.id,
        programme_id: null,
        episode_id: null,
        demandeur: lireUtilisateur(),
        motif: motif.trim() || null,
      })
      await creerNotifications(
        ['CONTROLE_PAD', 'GESTION_DROITS_STOCK'].map((destinataire_role) => ({
          chaine_id: chaineActive.id,
          type: 'DEMANDE_PAD',
          destinataire_role,
          programme_id: null,
          message: messageDemandePadSpot(spot.libelle),
          lu: false,
        }))
      )
      const lignes = await listerDemandesPadParChaine(chaineActive.id)
      setDemandesPad(lignes)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnvoiPad(null)
    }
  }

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
        genre: form.genre || null,
        validite_debut: form.validite_debut || null,
        validite_fin: form.validite_fin || null,
        pad: form.pad,
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
    <Modal titre="Bibliothèque de spots" onFermer={onFermer} large>
      <div className="space-y-4">
        <form onSubmit={creer} className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-3">
          <div className="col-span-full">
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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Genre</label>
            <select
              value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">— Aucun genre —</option>
              {GENRES.map((g) => (
                <option key={g.fr} value={g.fr}>
                  {g.fr}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.pad}
                disabled={!modifiablePad}
                onChange={(e) => setForm({ ...form, pad: e.target.checked })}
                className="h-4 w-4"
              />
              Prêt à diffuser (PAD)
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Validité — début</label>
            <input
              type="date"
              value={form.validite_debut}
              onChange={(e) => setForm({ ...form, validite_debut: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Validité — fin</label>
            <input
              type="date"
              value={form.validite_fin}
              onChange={(e) => setForm({ ...form, validite_fin: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-full">
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
          {erreur && <p className="col-span-full text-xs text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={enregistrement}
            className="col-span-full flex items-center justify-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Plus size={14} />
            {enregistrement ? 'Enregistrement…' : 'Ajouter à la bibliothèque'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Filtrer par genre</label>
          <select
            value={filtreGenre}
            onChange={(e) => setFiltreGenre(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">Tous les genres</option>
            {GENRES.map((g) => (
              <option key={g.fr} value={g.fr}>
                {g.fr}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-80 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Libellé</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Genre</th>
                <th className="py-2 pr-3 font-medium">Durée</th>
                <th className="py-2 pr-3 font-medium">Validité</th>
                <th className="py-2 pr-3 font-medium">PAD</th>
                <th className="py-2 pr-3 font-medium">Portée</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {spotsAffiches.map((s) => {
                const chaine = CHAINES.find((c) => c.id === s.chaine_id)
                const { fond, texte } = s.genre ? couleurGenre(s.genre) : {}
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-700">{s.libelle}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{TYPES.find((t) => t.valeur === s.type)?.court ?? s.type}</td>
                    <td className="py-1.5 pr-3">
                      {s.genre ? (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${fond} ${texte}`}>{s.genre}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
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
                    <td className="py-1.5 pr-3 text-xs text-slate-500">
                      {s.validite_debut || s.validite_fin ? `${s.validite_debut ?? '…'} → ${s.validite_fin ?? '…'}` : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      {s.pad ? (
                        modifiablePad ? (
                          <input
                            type="checkbox"
                            checked
                            onChange={(e) => modifier(s.id, { pad: e.target.checked })}
                            className="h-4 w-4"
                            title="Marquer prêt à diffuser (PAD)"
                          />
                        ) : (
                          <CheckCircle2 size={16} className="text-snrt-success" />
                        )
                      ) : modifiablePad ? (
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => modifier(s.id, { pad: e.target.checked })}
                          className="h-4 w-4"
                          title="Marquer prêt à diffuser (PAD)"
                        />
                      ) : demandeEnAttenteParSpot.has(s.id) ? (
                        <span className="text-xs text-amber-600">Demande PAD en attente</span>
                      ) : demandeurPad && chaineActive ? (
                        <button
                          type="button"
                          onClick={() => demanderPadSpot(s)}
                          disabled={envoiPad === s.id}
                          className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <BadgeCheck size={13} />
                          {envoiPad === s.id ? 'Envoi…' : 'Demander PAD'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Non PAD</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{chaine ? chaine.nom : 'Global'}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2">
                        {onAjouterAuPlan && (
                          <button
                            type="button"
                            onClick={() => onAjouterAuPlan(s)}
                            className="text-snrt-navy hover:text-snrt-navy-hover"
                            title="Ajouter au plan média"
                          >
                            <CirclePlus size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => supprimer(s.id)} className="text-red-500 hover:text-red-700" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {spotsAffiches.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 text-sm text-slate-500">
                    Aucun spot {filtreGenre ? `de genre « ${filtreGenre} »` : 'dans la bibliothèque'}.
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
