import { useEffect, useId, useState } from 'react'
import { ArrowLeft, Paperclip, Loader2 } from 'lucide-react'
import {
  obtenirProgramme,
  creerProgramme,
  mettreAJourProgramme,
  televerserAttestation,
  urlAttestation,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { CHAINES, chaineParNom } from '../lib/chaines.js'
import { GENRES } from '../lib/genres.js'
import EpisodesPanel from './EpisodesPanel.jsx'

const TAILLE_MAX_ATTESTATION = 5 * 1024 * 1024 // 5 Mo

const FORM_VIDE = {
  titre: '',
  titre_ar: '',
  genre: '',
  sous_genre: '',
  thematique: '',
  chaine: '',
  date_production: '',
  code: '',
  description: '',
  auteur: '',
  exclusivite: false,
}

function versFormulaire(programme) {
  return {
    titre: programme.titre ?? '',
    titre_ar: programme.titre_ar ?? '',
    genre: programme.genre ?? '',
    sous_genre: programme.sous_genre ?? '',
    thematique: programme.thematique ?? '',
    chaine: programme.chaine ?? '',
    date_production: programme.date_production ?? '',
    code: programme.code ?? '',
    description: programme.description ?? '',
    auteur: programme.auteur ?? '',
    exclusivite: programme.exclusivite ?? false,
  }
}

export default function FicheProgramme({ programmeId: idInitial, chaineActive, onRetour }) {
  const [id, setId] = useState(idInitial)
  const [form, setForm] = useState(() => (idInitial ? FORM_VIDE : { ...FORM_VIDE, chaine: chaineActive.nom }))
  const [programme, setProgramme] = useState(null)
  const [chargement, setChargement] = useState(Boolean(idInitial))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [messageSucces, setMessageSucces] = useState(null)
  const [nombreEpisodes, setNombreEpisodes] = useState(0)
  const [televersementEnCours, setTeleversementEnCours] = useState(false)
  const idDescription = useId()
  const idExclusivite = useId()

  useEffect(() => {
    if (!idInitial) return
    obtenirProgramme(idInitial).then((p) => {
      setProgramme(p)
      setForm(versFormulaire(p))
      setChargement(false)
    })
  }, [idInitial])

  function afficherSucces(texte) {
    setMessageSucces(texte)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    setMessageSucces(null)
    const champs = {
      titre: form.titre.trim(),
      titre_ar: form.titre_ar.trim() || null,
      genre: form.genre.trim() || null,
      sous_genre: form.sous_genre.trim() || null,
      thematique: form.thematique.trim() || null,
      chaine: form.chaine.trim(),
      chaine_id: chaineParNom(form.chaine.trim())?.id ?? null,
      date_production: form.date_production || null,
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      auteur: form.auteur.trim() || null,
      exclusivite: form.exclusivite,
    }
    try {
      if (id) {
        const maj = await mettreAJourProgramme(id, champs)
        setProgramme(maj)
        afficherSucces('Programme modifié.')
      } else {
        const cree = await creerProgramme({ ...champs, cree_par: lireUtilisateur() })
        setProgramme(cree)
        setId(cree.id)
        afficherSucces('Programme créé.')
      }
    } catch (err) {
      if (err.code === '23505') {
        setErreur('Un programme avec ce titre existe déjà sur cette chaîne (titre + chaîne doivent être uniques).')
      } else {
        setErreur(err.message)
      }
    } finally {
      setEnregistrement(false)
    }
  }

  async function handleAttestation(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier || !id) return
    if (fichier.size > TAILLE_MAX_ATTESTATION) {
      setErreur('Fichier trop volumineux (5 Mo maximum).')
      return
    }
    setErreur(null)
    setTeleversementEnCours(true)
    try {
      const chemin = await televerserAttestation(id, fichier)
      const maj = await mettreAJourProgramme(id, { attestation_chemin: chemin })
      setProgramme(maj)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setTeleversementEnCours(false)
    }
  }

  if (chargement) {
    return <p className="text-sm text-slate-500">Chargement…</p>
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onRetour}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Retour à la liste
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Définition de programme</h2>
        <form onSubmit={enregistrer} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Champ label="Titre *" required value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} />
            <Champ label="Titre (arabe)" value={form.titre_ar} onChange={(v) => setForm({ ...form, titre_ar: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ChampSelect
              label="Chaîne *"
              required
              value={form.chaine}
              onChange={(v) => setForm({ ...form, chaine: v })}
              options={CHAINES.map((c) => ({ valeur: c.nom, libelle: c.nom }))}
            />
            <Champ label="Date de production" type="date" value={form.date_production} onChange={(v) => setForm({ ...form, date_production: v })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <ChampSelect
              label="Genre"
              value={form.genre}
              onChange={(v) => setForm({ ...form, genre: v })}
              options={GENRES.map((g) => ({ valeur: g.fr, libelle: `${g.fr} — ${g.ar}` }))}
              vide="— Choisir un genre —"
            />
            <Champ label="Sous-genre" value={form.sous_genre} onChange={(v) => setForm({ ...form, sous_genre: v })} />
            <Champ label="Thématique" value={form.thematique} onChange={(v) => setForm({ ...form, thematique: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Champ label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Champ label="Auteur" value={form.auteur} onChange={(v) => setForm({ ...form, auteur: v })} />
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
          <label htmlFor={idExclusivite} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              id={idExclusivite}
              type="checkbox"
              checked={form.exclusivite}
              onChange={(e) => setForm({ ...form, exclusivite: e.target.checked })}
            />
            Exclusivité
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Attestation</span>
            {!id ? (
              <p className="text-sm text-slate-500">Enregistrez d'abord le programme pour joindre une attestation.</p>
            ) : (
              <div className="flex items-center gap-3">
                <label
                  className={`flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white ${
                    televersementEnCours ? 'opacity-60' : 'cursor-pointer hover:bg-slate-700'
                  }`}
                >
                  {televersementEnCours ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                  {televersementEnCours ? 'Envoi…' : 'Choisir un fichier'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleAttestation}
                    disabled={televersementEnCours}
                  />
                </label>
                {programme?.attestation_chemin && (
                  <a
                    href={urlAttestation(programme.attestation_chemin)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-snrt-blue hover:underline"
                  >
                    {programme.attestation_chemin.split('/').pop()}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <div>Créé par : {programme?.cree_par || '—'}</div>
            <div>Créé le : {programme?.cree_le ? new Date(programme.cree_le).toLocaleString('fr-FR') : '—'}</div>
            <div>Nombre d'épisodes : {nombreEpisodes}</div>
          </div>

          {messageSucces && <p className="text-sm text-emerald-600">{messageSucces}</p>}
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            type="submit"
            disabled={enregistrement}
            className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>

      {id && <EpisodesPanel programmeId={id} onEpisodesChange={(episodes) => setNombreEpisodes(episodes.length)} />}
    </div>
  )
}

function Champ({ label, type = 'text', value, onChange, required }) {
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

function ChampSelect({ label, value, onChange, required, options, vide }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {!required && <option value="">{vide ?? '—'}</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}
