import { useEffect, useId, useMemo, useState } from 'react'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import {
  listerEpisodes,
  creerEpisode,
  mettreAJourEpisode,
  supprimerEpisode,
  listerDiffusionsLineairesParProgramme,
  creerDemandePad,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { calculerParEpisode } from '../lib/historique.js'
import { formaterDateLongue } from '../lib/semaine.js'
import Placeholder from '../components/Placeholder.jsx'
import { useNotification, useGardeModifications } from '../components/NotificationProvider.jsx'

const ONGLETS = [
  { id: 'INFOS', label: 'Informations générales' },
  { id: 'SUPPORTS', label: 'Supports' },
  { id: 'EVENEMENTS', label: 'Événements secondaires' },
]

const EPISODE_VIDE = {
  numero: '',
  titre: '',
  titre_ar: '',
  duree: '',
  date_production: '',
  code: '',
  description: '',
  pad: false,
}

function versFormulaire(episode) {
  return {
    numero: episode.numero ?? '',
    titre: episode.titre ?? '',
    titre_ar: episode.titre_ar ?? '',
    duree: episode.duree ?? '',
    date_production: episode.date_production ?? '',
    code: episode.code ?? '',
    description: episode.description ?? '',
    pad: episode.pad ?? false,
  }
}

export default function EpisodesPanel({ programmeId, chaineActive, onEpisodesChange }) {
  const [episodes, setEpisodes] = useState([])
  const [diffusions, setDiffusions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [episodeId, setEpisodeId] = useState(null)
  const [onglet, setOnglet] = useState('INFOS')
  const [form, setForm] = useState(null)
  const [valeurInitiale, setValeurInitiale] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [demandePad, setDemandePad] = useState(false)
  const idDescription = useId()
  const idPad = useId()
  const notifier = useNotification()
  const { demanderConfirmation } = useGardeModifications(form, valeurInitiale)

  useEffect(() => {
    rafraichir()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de programme, pas à onEpisodesChange (identité instable côté parent)
  }, [programmeId])

  async function rafraichir() {
    setChargement(true)
    try {
      const [lignes, lignesDiffusions] = await Promise.all([
        listerEpisodes(programmeId),
        listerDiffusionsLineairesParProgramme(programmeId),
      ])
      setEpisodes(lignes)
      setDiffusions(lignesDiffusions)
      onEpisodesChange?.(lignes)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  // "Dernière diffusion" / "Nombre de diffusions" dynamiques (P14b) —
  // remplacent la lecture des colonnes statiques episode.derniere_diffusion /
  // nombre_diffusions, jamais recalculées depuis la suppression de l'import xlsx.
  const historiqueParEpisode = useMemo(() => calculerParEpisode(diffusions), [diffusions])

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : changer d'épisode
  // sélectionné ou ouvrir "nouvel épisode" abandonnerait silencieusement la
  // saisie en cours sinon.
  async function selectionner(episode) {
    if (!(await demanderConfirmation())) return
    setEpisodeId(episode.id)
    setForm(versFormulaire(episode))
    setValeurInitiale(versFormulaire(episode))
    setOnglet('INFOS')
    setErreur(null)
  }

  async function nouvelEpisode() {
    if (!(await demanderConfirmation())) return
    const vide = { ...EPISODE_VIDE, numero: episodes.length + 1 }
    setEpisodeId('NOUVEAU')
    setForm(vide)
    setValeurInitiale(vide)
    setOnglet('INFOS')
    setErreur(null)
  }

  async function supprimer(id) {
    try {
      await supprimerEpisode(id)
      if (episodeId === id) {
        setEpisodeId(null)
        setForm(null)
        setValeurInitiale(null)
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      const champs = {
        numero: form.numero === '' ? null : Number(form.numero),
        titre: form.titre.trim(),
        titre_ar: form.titre_ar.trim() || null,
        duree: form.duree === '' ? null : Number(form.duree),
        date_production: form.date_production || null,
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        pad: form.pad,
        programme_id: programmeId,
      }
      if (episodeId === 'NOUVEAU') {
        const cree = await creerEpisode(champs)
        notifier.succes(`Épisode « ${cree.titre || 'sans titre'} » enregistré.`)
        // Referme le formulaire : sans ça, episodeId reste sur la ligne qu'on
        // vient de créer et la saisie suivante la modifie au lieu d'en créer
        // une nouvelle (c'était la cause de la perte de données).
        setEpisodeId(null)
        setForm(null)
        setValeurInitiale(null)
      } else {
        await mettreAJourEpisode(episodeId, champs)
        notifier.succes('Épisode modifié.')
        setValeurInitiale(form)
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  // Demande de validation PAD (P35c) — envoyée au rôle Contrôle PAD, qui
  // l'accepte (episode.pad = true) ou la refuse. Ne modifie rien ici.
  async function demanderValidationPad() {
    const motif = window.prompt('Motif de la demande de validation PAD (optionnel) :', '')
    if (motif === null) return
    setDemandePad(true)
    setErreur(null)
    try {
      await creerDemandePad({
        chaine_id: chaineActive.id,
        programme_id: programmeId,
        episode_id: episodeId,
        demandeur: lireUtilisateur(),
        motif: motif.trim() || null,
      })
      notifier.succes('Demande de validation PAD envoyée au Contrôle PAD.')
    } catch (err) {
      setErreur(err.message)
    } finally {
      setDemandePad(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Épisodes</h2>
        <button
          type="button"
          onClick={nouvelEpisode}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700"
          title="Ajouter un épisode"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">N°</th>
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">PAD</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep) => (
                <tr
                  key={ep.id}
                  onClick={() => selectionner(ep)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    episodeId === ep.id ? 'bg-snrt-navy/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 pr-4 text-slate-700">{ep.numero ?? '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{ep.titre || '—'}</td>
                  <td className="py-2 pr-4">{ep.pad && <CheckCircle2 size={16} className="text-snrt-success" />}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        supprimer(ep.id)
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!chargement && episodes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-slate-500">
                    Aucun épisode pour ce programme.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {!form ? (
            <p className="text-sm text-slate-500">Sélectionnez un épisode ou ajoutez-en un.</p>
          ) : (
            <>
              <div className="mb-4 flex gap-4 border-b border-slate-200">
                {ONGLETS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOnglet(o.id)}
                    className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
                      onglet === o.id
                        ? 'border-snrt-navy text-snrt-navy'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {onglet === 'SUPPORTS' && <Placeholder titre="Supports" />}
              {onglet === 'EVENEMENTS' && <Placeholder titre="Événements secondaires" />}
              {onglet === 'INFOS' && (
                <form onSubmit={enregistrer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Champ label="N°" type="number" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} />
                    <Champ
                      label="Durée (minutes) *"
                      type="number"
                      required
                      value={form.duree}
                      onChange={(v) => setForm({ ...form, duree: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Champ label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} />
                    <Champ
                      label="Titre (arabe)"
                      dir="rtl"
                      value={form.titre_ar}
                      onChange={(v) => setForm({ ...form, titre_ar: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Champ
                      label="Date de production"
                      type="date"
                      value={form.date_production}
                      onChange={(v) => setForm({ ...form, date_production: v })}
                    />
                    <Champ label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
                  </div>
                  <div>
                    <label htmlFor={idDescription} className="mb-1 block text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      id={idDescription}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <label htmlFor={idPad} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      id={idPad}
                      type="checkbox"
                      checked={form.pad}
                      onChange={(e) => setForm({ ...form, pad: e.target.checked })}
                    />
                    PAD (prêt à diffuser)
                  </label>
                  {episodeId !== 'NOUVEAU' && !form.pad && chaineActive && (
                    <div>
                      <button
                        type="button"
                        onClick={demanderValidationPad}
                        disabled={demandePad}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {demandePad ? 'Envoi…' : 'Demander la validation PAD'}
                      </button>
                    </div>
                  )}
                  {episodeId !== 'NOUVEAU' && (
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                      <div>
                        Dernière diffusion :{' '}
                        {historiqueParEpisode.get(episodeId)?.derniere
                          ? formaterDateLongue(historiqueParEpisode.get(episodeId).derniere)
                          : '—'}
                      </div>
                      <div>Nombre de diffusions : {historiqueParEpisode.get(episodeId)?.nb ?? 0}</div>
                    </div>
                  )}
                  {erreur && <p className="text-sm text-red-600">{erreur}</p>}
                  <button
                    type="submit"
                    disabled={enregistrement}
                    className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
                  >
                    {enregistrement ? 'Enregistrement…' : 'Enregistrer l\'épisode'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Champ({ label, type = 'text', value, onChange, required, dir }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}
